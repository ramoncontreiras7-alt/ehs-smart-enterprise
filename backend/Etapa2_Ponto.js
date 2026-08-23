/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EHS SMART ENTERPRISE · Etapa 2 — Módulo de Ponto (Chão de Fábrica)
 * Modernização ES6+ (arrow, template literals, const/let, for..of).
 * Reaproveita: CFG, _identificarUsuario, validarColaborador, _listarEpisDevidos,
 *   _obterUsuario, _resolverGestorDoSetor, registrarLog, _gravarLogSemTrava.
 *
 * REGRA CORPORATIVA (Etapa 2 · item 2):
 *   · Registro ultra-rápido via CREDENCIAL ou CPF.
 *   · Ao bater o ponto, devolve painel temporário com status de NRs/EPIs
 *     (pendentes/em dia) e alertas de vencimento de EPI (gamificação).
 *   · Gatilho de comunicação: pendência CRÍTICA (NR vencida / EPI faltante)
 *     dispara alerta imediato ao Supervisor/Gestor responsável (via token —
 *     o front faz polling em api_BuscarAlertasSupervisor).
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Bate o ponto: identifica, valida conformidade e monta o painel.
 * origem do dispositivo: RELOGIO_PONTO / TOTEM.
 */
function api_BaterPonto(identificador, idTotem) {
  const u = _identificarUsuario(identificador);

  if (!u) {
    registrarLog({
      matricula_usuario: 'DESCONHECIDO', acao_realizada: 'PONTO_BLOQUEADO',
      tabela_afetada: CFG.ABAS.FUNCIONARIOS, id_registro_afetado: String(identificador || ''),
      origem_acao: 'RELOGIO_PONTO', id_dispositivo: idTotem || 'PONTO',
      resultado: 'NEGADO_REGRA', criticidade: 'AVISO',
      justificativa: 'Identificador (credencial/CPF) não reconhecido no ponto'
    });
    return { status: 'BLOQUEADO', erro: 'Crachá/CPF não reconhecido.' };
  }

  const v = validarColaborador(u.matricula);

  registrarLog({
    matricula_usuario: u.matricula, perfil_rbac_no_momento: u.perfil_rbac,
    nivel_hierarquico_no_momento: u.nivel_hierarquico,
    acao_realizada: v.liberado ? 'PONTO_ENTRADA' : 'PONTO_BLOQUEADO',
    tabela_afetada: CFG.ABAS.FUNCIONARIOS, id_registro_afetado: u.matricula,
    origem_acao: 'RELOGIO_PONTO', id_dispositivo: idTotem || 'PONTO',
    resultado: v.liberado ? 'SUCESSO' : 'NEGADO_REGRA',
    criticidade: v.liberado ? 'INFO' : 'CRITICO',
    justificativa: v.motivos.join(' | ')
  });

  const painel = _montarPainelPonto(v);
  const agora = new Date();
  const timestampBrasilia = Utilities.formatDate(agora, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');

  const token = {
    timestamp: timestampBrasilia,
    timestamp_iso: agora.toISOString(),
    local: idTotem || 'RELOGIO_PONTO',
    empresa: u.empresa || 'NÃO INFORMADA',
    matricula: u.matricula,
    nome: u.nome_completo,
    tipo_vinculo: u.tipo_vinculo,
    status: v.liberado ? 'LIBERADO' : 'BLOQUEADO',
    painel: painel
  };

  registrarLog({
    matricula_usuario: u.matricula, perfil_rbac_no_momento: u.perfil_rbac,
    nivel_hierarquico_no_momento: u.nivel_hierarquico,
    acao_realizada: v.liberado ? 'PONTO_ENTRADA' : 'PONTO_BLOQUEADO',
    tabela_afetada: CFG.ABAS.FUNCIONARIOS, id_registro_afetado: u.matricula,
    origem_acao: 'RELOGIO_PONTO', id_dispositivo: idTotem || 'PONTO',
    resultado: v.liberado ? 'SUCESSO' : 'NEGADO_REGRA',
    criticidade: v.liberado ? 'INFO' : 'CRITICO',
    justificativa: v.motivos.join(' | ')
  });

  const criticas = v.motivos.filter(m => /vencida|faltante|bloque/i.test(m));
  if (criticas.length) _dispararAlertaSupervisor(u.setor, u.matricula, criticas);

  return token;
}

/** Painel temporário exibido no quiosque: NRs, EPIs e gamificação. */
function _montarPainelPonto(v) {
  const f = v.funcao;
  const epis = (v.liberado && f) ? _listarEpisDevidos(f) : [];

  return {
    matricula: v.pessoa.matricula,
    nome: v.pessoa.nome_completo,
    liberado: v.liberado,
    nrs: {
      pendentes: v.motivos,
      avisos: v.alertas
    },
    epis: epis.map(e => ({
      codigo_epi: e.codigo_epi,
      nome: e.nome,
      status_ca: e.status_ca,
      vida_util_dias: e.vida_util_dias,
      alertas_vencimento: e.bloqueios,
      liberavel: e.liberavel
    })),
    gamificacao: _snapshotGamificacao(v.pessoa.matricula)
  };
}

/** Snapshot de gamificação do colaborador: conservação de vida útil + vínculo. */
function _snapshotGamificacao(matricula) {
  const cm = CFG.COL_MOVIMENTACOES;
  const alvo = String(matricula).trim().toUpperCase();

  const movs = _lerTudo(CFG.ABAS.MOVIMENTACOES)
    .filter(m => String(m[cm.matricula - 1] || '').trim().toUpperCase() === alvo);

  let soma = 0, n = 0, pos = 0, neg = 0;
  movs.forEach(m => {
    const perc = Number(m[cm.perc_vida_util_aproveitada - 1]) || 0;
    if (perc > 0) { soma += perc; n++; }
    const imp = String(m[cm.impacto_gamificacao - 1]).toUpperCase();
    if (imp === 'POSITIVO') pos++; else if (imp === 'NEGATIVO') neg++;
  });

  const cg = CFG.COL_GAMIFICACAO;
  const mentoria = _lerTudo(CFG.ABAS.GAMIFICACAO).filter(v =>
    String(v[cg.matricula_mentorado - 1] || '').trim().toUpperCase() === alvo &&
    String(v[cg.status_vinculo - 1]).toUpperCase() === 'ATIVO')[0];

  return {
    conservacao_vida_util_media: n ? Math.round((soma / n) * 10) / 10 : 0,
    trocas_positivas: pos,
    trocas_negativas: neg,
    apadrinhado_mentor: mentoria ? mentoria[cg.matricula_mentor - 1] : null
  };
}

/**
 * GATILHO DE COMUNICAÇÃO: grava alerta crítico endereçado ao supervisor do
 * setor (append-only em Acoes_Preventivas) + log CRITICO. O front faz
 * polling em api_BuscarAlertasSupervisor para o pop-up via token.
 */
function _dispararAlertaSupervisor(idSetor, matricula, motivos) {
  const supervisor = _resolverGestorDoSetor(idSetor, '');
  const cap = CFG.COL_ACOES_PREVENTIVAS;
  const alvo = _obterUsuario(matricula);
  const agora = new Date();

  const idLog = registrarLog({
    matricula_usuario: 'SISTEMA', perfil_rbac_no_momento: 'SISTEMA',
    nivel_hierarquico_no_momento: 'SISTEMA',
    acao_realizada: 'ALERTA_PONTO_CRITICO', tabela_afetada: CFG.ABAS.FUNCIONARIOS,
    id_registro_afetado: matricula, origem_acao: 'RELOGIO_PONTO',
    resultado: 'SUCESSO', criticidade: 'CRITICO',
    justificativa: 'Pendência crítica no ponto. Supervisor alvo: ' +
                   supervisor + '. ' + motivos.join(' | ')
  });

  const sh = _aba(CFG.ABAS.ACOES_PREVENTIVAS);
  const seq = sh.getLastRow();
  const idAcao = 'AP-' + Utilities.formatDate(agora, Session.getScriptTimeZone(), 'yyyyMMdd') +
                 '-' + ('0000' + seq).slice(-4);

  const linha = new Array(cap.id_log).fill('');
  linha[cap.id_acao - 1]                      = idAcao;
  linha[cap.timestamp - 1]                    = agora;
  linha[cap.matricula_alvo - 1]               = matricula;
  linha[cap.nome_alvo_snapshot - 1]           = alvo ? alvo.nome_completo : matricula;
  linha[cap.matricula_solicitante - 1]        = 'SISTEMA';
  linha[cap.perfil_rbac_solicitante - 1]      = 'SISTEMA';
  linha[cap.nivel_hierarquico_solicitante - 1] = 'SISTEMA';
  linha[cap.origem_identificacao - 1]         = 'RELOGIO_PONTO';
  linha[cap.alerta_disparo - 1]               = motivos.join(' | ');
  linha[cap.recomendacao_registrada - 1]      = 'Acionar supervisor responsável (' + supervisor + ') imediatamente.';
  linha[cap.status_acao - 1]                  = 'ALERTA_SUPERVISOR';
  linha[cap.observacoes - 1]                  = 'setor=' + idSetor;
  linha[cap.id_log - 1]                       = idLog;
  sh.appendRow(linha);
}

/**
 * Consulta dos alertas críticos pendentes do supervisor (pop-up via token).
 * Escopo respeita _resolverEscopo — só os setores sob sua gestão.
 */
function api_BuscarAlertasSupervisor(matriculaSolicitante) {
  const u = _exigirAcesso(matriculaSolicitante, {
    perfis: CFG.PERFIS_SENSIVEIS, nivelMinimo: 'GESTOR', contexto: 'ALERTAS_SUPERVISOR'
  });

  const escopo = _resolverEscopo(u);
  const cap = CFG.COL_ACOES_PREVENTIVAS;

  const pendentes = _lerTudo(CFG.ABAS.ACOES_PREVENTIVAS)
    .filter(a => String(a[cap.status_acao - 1]).toUpperCase() === 'ALERTA_SUPERVISOR')
    .filter(a => {
      const mat = String(a[cap.matricula_alvo - 1] || '');
      if (!mat) return false;
      const fu = _obterUsuario(mat);
      return fu && escopo.ids_setores.indexOf(String(fu.setor)) !== -1;
    })
    .map(a => ({
      id_acao: a[cap.id_acao - 1],
      matricula_alvo: a[cap.matricula_alvo - 1],
      nome_alvo: a[cap.nome_alvo_snapshot - 1],
      alerta: a[cap.alerta_disparo - 1],
      recomendacao: a[cap.recomendacao_registrada - 1],
      timestamp: a[cap.timestamp - 1]
    }));

  return { supervisor: u.matricula, setores: escopo.ids_setores, alertas_pendentes: pendentes };
}
