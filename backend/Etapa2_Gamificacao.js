/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EHS SMART ENTERPRISE · Etapa 2 — Gamificação Data-Driven Anti-Fraude
 * Modernização ES6+ (arrow, template literals, const/let).
 * Reaproveita: CFG, _lerTudo, calcularBonusMentor (Motor_Regras.js),
 *   _listarMentorias (Motor_Regras.js).
 *
 * REGRA CORPORATIVA (Etapa 2 · item 4):
 *   · Métricas de "Bom Funcionário": conservação de vida útil do EPI, NRs em
 *     dia, zero ocorrências. Lidas de dados reais (Movimentacoes_Trocas).
 *   · APADRINHAMENTO (anti-fraude): "Bom" apadrinha "Ruim". O mentor NÃO ganha
 *     pontos de graça — recebe yield de 20% a 30% dos pontos que o mentorado
 *     EFETIVAMENTE ganhar, via comprovação de melhoria real (aumento da vida
 *     útil do EPI). Foco em premiações (bimestral, anual, 14º salário).
 *   · CLÁUSULA DE PROTEÇÃO: o mentor JAMAIS perde pontos se o apadrinhado
 *     falhar. O piso zero em calcularBonusMentor garante saldo >= 0 sempre.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const PREMIACAO = {
  // 1 ponto de gamificação = R$ X (ajustável por RH/Folha)
  PONTOS_POR_REAL: 0.5,
  // Distribuição do saldo de bônus em premiações (soma = 100%)
  FATOR_BIMESTRAL: 0.20,   // 20% vira prêmio bimestral
  FATOR_ANUAL: 0.50,       // 50% vira prêmio anual
  FATOR_DECIMO_QUARTO: 0.30 // 30% vira 14º salário
};

/**
 * Comprovação de melhoria REAL: média de % de vida útil aproveitada nas
 * movimentações do mentorado. É a base auditável do ganho do mentor — não há
 * "pontos de graça", só o que os dados atestam.
 */
function _comprovarVidaUtilMedia(matricula) {
  const cm = CFG.COL_MOVIMENTACOES;
  const alvo = String(matricula).trim().toUpperCase();

  const movs = _lerTudo(CFG.ABAS.MOVIMENTACOES)
    .filter(m => String(m[cm.matricula - 1] || '').trim().toUpperCase() === alvo);

  let soma = 0, n = 0;
  movs.forEach(m => {
    const perc = Number(m[cm.perc_vida_util_aproveitada - 1]) || 0;
    if (perc > 0) { soma += perc; n++; }
  });
  return n ? Math.round((soma / n) * 10) / 10 : 0;
}

/**
 * Calcula o yield do mentor e projeta as PREMIAÇÕES.
 * 'vinculo' = { pontos_acumulados_mentorado, pontos_base_inicial,
 *               percentual_repasse_mentor, matricula_mentorado }.
 *
 * O saldo do mentor vem de calcularBonusMentor, que já aplica o piso zero
 * (saldo >= 0) — logo o mentor NUNCA fica negativo, nem se o apadrinhado
 * regredir. O yield é 20%–30% (CFG: GAMIFICACAO.REPASSE_MINIMO/MAXIMO).
 */
function calcularPremiacoes(vinculo) {
  const calc = calcularBonusMentor(vinculo);    // saldo_bonus_mentor >= 0
  const saldo = calc.saldo_bonus_mentor;
  const emReal = saldo / PREMIACAO.PONTOS_POR_REAL;

  return {
    saldo_bonus_mentor: saldo,
    evolucao_liquida_mentorado: calc.evolucao_liquida,
    percentual_aplicado: calc.percentual_aplicado,
    // Base auditável: média real de vida útil do EPI do mentorado
    comprovacao_vida_util_media: _comprovarVidaUtilMedia(vinculo.matricula_mentorado),
    premio_bimestral:  Math.round(emReal * PREMIACAO.FATOR_BIMESTRAL * 100) / 100,
    premio_anual:      Math.round(emReal * PREMIACAO.FATOR_ANUAL * 100) / 100,
    decimo_quarto:     Math.round(emReal * PREMIACAO.FATOR_DECIMO_QUARTO * 100) / 100,
    // Cláusula de proteção explícita no payload
    mentor_perde_pontos: false
  };
}

/**
 * Relatório do supervisor/gestor: saldo, yield e premiações de cada vínculo
 * ativo no seu escopo. Respeita RBAC (GESTOR+ / nível mínimo GESTOR).
 */
function api_RelatorioGamificacao(matriculaSolicitante) {
  const u = _exigirAcesso(matriculaSolicitante, {
    perfis: CFG.PERFIS_SENSIVEIS, nivelMinimo: 'GESTOR', contexto: 'RELATORIO_GAMIFICACAO'
  });

  const escopo = _resolverEscopo(u);

  const vinculos = _listarMentorias(escopo.ids_setores).map(v => {
    const emReal = v.saldo_bonus_mentor / PREMIACAO.PONTOS_POR_REAL;
    return Object.assign({}, v, {
      comprovacao_vida_util_media: _comprovarVidaUtilMedia(v.mentorado),
      premio_bimestral:  Math.round(emReal * PREMIACAO.FATOR_BIMESTRAL * 100) / 100,
      premio_anual:      Math.round(emReal * PREMIACAO.FATOR_ANUAL * 100) / 100,
      decimo_quarto:     Math.round(emReal * PREMIACAO.FATOR_DECIMO_QUARTO * 100) / 100,
      mentor_perde_pontos: false
    });
  });

  return { supervisor: u.matricula, setores: escopo.ids_setores, vinculos: vinculos };
}
