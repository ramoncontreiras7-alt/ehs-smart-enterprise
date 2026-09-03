/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EHS SMART ENTERPRISE · Motor_Regras.gs — v2.1
 * Fadiga preditiva, dashboards por escopo hierárquico, gamificação
 * assimétrica, rotinas automáticas e conformidade NR-06.
 *
 * NOVIDADE DA v2.1:
 *   · Integração NR-06 com base em Súmula 289 do TST
 *   · Peso adicional para infrações de CA/EPI em funções de risco crítico
 *   · Ações recomendadas com bloqueio/verificação NR-06 explícita
 * ═══════════════════════════════════════════════════════════════════════════
 */

/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 1 · PARÂMETROS DO MOTOR PREDITIVO E NR-06
 ═══════════════════════════════════════════════════════════════════════════ */

const FADIGA = {
  PESOS: {
    HORAS_EXTRAS_ESTOURO: 3,
    HORAS_EXTRAS_PROXIMO: 1,
    TURNOS_SEQUENCIA_ALTA: 3,
    TURNOS_SEQUENCIA_MEDIA: 1,
    INTERJORNADA_CURTA: 2,
    CRITICAS_MUITAS: 2,
    CRITICAS_ALGUMAS: 1,
    OCORRENCIA_RECENTE: 2,
    EXPOSICAO_CRITICA: 1,
    NR06_INFRACAO: 5
  },
  CORTES: { CRITICO: 8, ALTO: 5, MODERADO: 2 },
  INTERJORNADA_MINIMA_HORAS: 11,
  NR06: {
    EXIGE_VALIDACAO_CA: true,
    BASE_LEGAL: 'Súmula 289 TST + NR-06.6.1',
    PRAZO_MINIMO_DIAS: 30
  }
};

const GAMIFICACAO = {
  PONTOS_POR_TROCA_POSITIVA: 50,
  REPASSE_MINIMO: 0.05,
  REPASSE_MAXIMO: 0.25
};

/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 2 · CÁLCULO DA FADIGA COM NR-06 INTEGRADA
 ═══════════════════════════════════════════════════════════════════════════ */

function calcularFadiga(matricula) {
  const cj = CFG.COL_JORNADA;
  const jornadas = _lerTudo(CFG.ABAS.JORNADA);
  const alvo = String(matricula).trim().toUpperCase();

  let j = null;
  jornadas.forEach(function (linha) {
    if (String(linha[cj.matricula - 1]).trim().toUpperCase() !== alvo) return;
    if (!j || new Date(linha[cj.data_referencia - 1]) > new Date(j[cj.data_referencia - 1])) j = linha;
  });
  if (!j) return null;

  const u = _obterUsuario(matricula);
  if (!u) return null;

  const funcRow = _buscarLinha(CFG.ABAS.FUNCOES, CFG.COL_FUNCOES.id_funcao, u.funcao);
  const cf = CFG.COL_FUNCOES;
  const limiteHE = funcRow ? (Number(funcRow.dados[cf.limite_horas_extras_mes - 1]) || 40) : 40;
  const grauRisco = funcRow ? String(funcRow.dados[cf.grau_exposicao_risco - 1]).toUpperCase() : 'BAIXO';
  const nomeFuncao = funcRow ? funcRow.dados[cf.nome_funcao - 1] : '—';

  const he = Number(j[cj.horas_extras_mes - 1]) || 0;
  const turnos = Number(j[cj.turnos_consecutivos - 1]) || 0;
  const interjornada = Number(j[cj.intervalo_min_horas - 1]) || 12;
  const criticas = Number(j[cj.atividades_criticas_7d - 1]) || 0;
  const ocorrencias = Number(j[cj.ocorrencias_recentes - 1]) || 0;

  let score = 0;
  const fatores = [];
  const P = FADIGA.PESOS;

  if (he > limiteHE) {
    score += P.HORAS_EXTRAS_ESTOURO;
    fatores.push(he + 'h extras no mês (limite da função: ' + limiteHE + 'h)');
  } else if (he > limiteHE * 0.7) {
    score += P.HORAS_EXTRAS_PROXIMO;
    fatores.push(he + 'h extras acumuladas, próximo do limite');
  }

  if (turnos >= 8) {
    score += P.TURNOS_SEQUENCIA_ALTA;
    fatores.push(turnos + ' turnos consecutivos sem folga');
  } else if (turnos >= 5) {
    score += P.TURNOS_SEQUENCIA_MEDIA;
    fatores.push(turnos + ' turnos consecutivos');
  }

  if (interjornada < FADIGA.INTERJORNADA_MINIMA_HORAS) {
    score += P.INTERJORNADA_CURTA;
    fatores.push('Interjornada de ' + interjornada + 'h (mínimo legal: 11h)');
  }

  if (criticas >= 8) {
    score += P.CRITICAS_MUITAS;
    fatores.push(criticas + ' atividades críticas em 7 dias');
  } else if (criticas >= 4) {
    score += P.CRITICAS_ALGUMAS;
    fatores.push(criticas + ' atividades críticas em 7 dias');
  }

  if (ocorrencias > 0) {
    score += P.OCORRENCIA_RECENTE;
    fatores.push(ocorrencias + ' ocorrência(s) operacional(is) recente(s)');
  }
  if (grauRisco === 'CRITICO') {
    score += P.EXPOSICAO_CRITICA;
    fatores.push('Função de exposição crítica');
  }

  if (FADIGA.NR06.EXIGE_VALIDACAO_CA && grauRisco === 'CRITICO') {
    const eqRow = _buscarLinha(CFG.ABAS.EQUIPAMENTOS, CFG.COL_EQUIPAMENTOS.codigo_epi, u.codigo_epi_ativo);
    if (eqRow) {
      const ce = CFG.COL_EQUIPAMENTOS;
      const statusCA = String(eqRow.dados[ce.status_ca - 1]).toUpperCase();
      const numeroCA = eqRow.dados[ce.numero_ca - 1];
      const validadeDias = eqRow.dados[ce.data_validade_ca - 1];

      const dataValidade = new Date(validadeDias);
      const diasAteVencimento = Math.ceil((dataValidade - new Date()) / (1000 * 60 * 60 * 24));

      if (statusCA === 'VENCIDO' || diasAteVencimento <= FADIGA.NR06.PRAZO_MINIMO_DIAS) {
        score += P.NR06_INFRACAO;
        fatores.push('NR-06: CA ' + numeroCA + (statusCA === 'VENCIDO' ? ' vencido' : ' vence em ' + diasAteVencimento + ' dias'));
      }
    } else {
      score += P.NR06_INFRACAO;
      fatores.push('NR-06: EPI não cadastrado para função de risco');
    }
  }

  let nivel = 'BAIXO';
  if (score >= FADIGA.CORTES.CRITICO)       nivel = 'CRITICO';
  else if (score >= FADIGA.CORTES.ALTO)     nivel = 'ALTO';
  else if (score >= FADIGA.CORTES.MODERADO) nivel = 'MODERADO';

  const acoes = {
    CRITICO: 'Restringir atividades críticas e acionar a SST imediatamente. NR-06: bloquear acesso ao totem.',
    ALTO: 'Redistribuir carga e verificar conformidade NR-06 em 24h.',
    MODERADO: 'Monitorar. Priorizar verificação NR-06 no próximo ciclo.',
    BAIXO: 'Monitoramento padrão.'
  };

  return {
    matricula: u.matricula, nome: u.nome_completo, funcao: nomeFuncao,
    setor: u.setor, id_gestor: u.id_gestor,
    nivel: nivel, score: score, fatores: fatores, acao_recomendada: acoes[nivel]
  };
}


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 3 · DISPARO DO ALERTA
   Dossiê 3.3.2: o alerta vai SÓ para o gestor do setor. Nem o colaborador,
   nem a diretoria recebem o alerta nominal.
═══════════════════════════════════════════════════════════════════════════ */

function rotina_VarrerFadiga() {
  const cf = CFG.COL_FUNCIONARIOS;
  const disparados = [];

  _lerTudo(CFG.ABAS.FUNCIONARIOS).forEach(function (linha) {
    const matricula = linha[cf.matricula - 1];
    if (!matricula) return;

    if (String(linha[cf.tipo_vinculo - 1]).toUpperCase() !== 'NATIVO') return;
    const statusEfetivo = linha[cf.status_efetivo - 1] || linha[cf.status - 1];
    if (String(statusEfetivo).toUpperCase() !== 'ATIVO') return;

    const f = calcularFadiga(matricula);
    if (!f || (f.nivel !== 'ALTO' && f.nivel !== 'CRITICO')) return;

    const destinatario = _resolverGestorDoSetor(linha[cf.setor - 1], linha[cf.id_gestor - 1]);

    registrarLog({
      matricula_usuario: 'SISTEMA', perfil_rbac_no_momento: 'SISTEMA',
      nivel_hierarquico_no_momento: 'SISTEMA',
      acao_realizada: 'ALERTA_FADIGA_GERADO', tabela_afetada: CFG.ABAS.JORNADA,
      id_registro_afetado: matricula, origem_acao: 'ROTINA_AUTOMATICA',
      id_dispositivo: 'SERVIDOR', resultado: 'SUCESSO',
      criticidade: f.nivel === 'CRITICO' ? 'CRITICO' : 'AVISO',
      justificativa: 'Nível ' + f.nivel + ' (score ' + f.score + '). Destinatário: ' +
                     destinatario + '. Fatores: ' + f.fatores.join(' | ')
    });

    if (CFG.FEATURE_FLAGS && CFG.FEATURE_FLAGS.alertas_fadiga_email) {
      _enviarAlertaFadiga(matricula, f, destinatario);
    }

    disparados.push({ alerta: f, destinatario: destinatario });
  });

  return disparados;
}

function _enviarAlertaFadiga(matricula, alerta, matriculaGestor) {
  try {
    const gestor = _obterUsuario(matriculaGestor);
    const colaborador = _obterUsuario(matricula);
    if (!gestor || !colaborador) return;

    const assunto = '[EHS] Alerta de Fadiga — ' + alerta.nivel + ' | ' + colaborador.nome_completo;
    const corpo = [
      'Alerta de fadiga preditiva detectado.',
      '',
      'Colaborador: ' + colaborador.nome_completo + ' (' + matricula + ')',
      'Setor: ' + (colaborador.setor || '—'),
      'Função: ' + (colaborador.funcao || '—'),
      'Nível: ' + alerta.nivel,
      'Score: ' + alerta.score,
      'Fatores: ' + (alerta.fatores || []).join('; '),
      '',
      'Acesse o dashboard do gestor para detalhes.'
    ].join('\n');

    if (gestor.email_corporativo) {
      GmailApp.sendEmail(gestor.email_corporativo, assunto, corpo);
    }
  } catch (erro) {
    Logger.log('Falha ao enviar alerta de fadiga: ' + erro.message);
  }
}

function _resolverGestorDoSetor(idSetor, idGestorFallback) {
  const setorRow = _buscarLinha(CFG.ABAS.SETORES, CFG.COL_SETORES.id_setor, idSetor);
  if (!setorRow) return idGestorFallback || 'NAO_DEFINIDO';

  const cs = CFG.COL_SETORES;
  const titular = setorRow.dados[cs.id_gestor_responsavel - 1];
  const substituto = setorRow.dados[cs.id_gestor_substituto - 1];

  if (titular) {
    const u = _obterUsuario(titular);
    if (u && String(u.status_efetivo).toUpperCase() === 'ATIVO') return titular;
  }
  if (substituto) return substituto;
  return idGestorFallback || 'NAO_DEFINIDO';
}


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 4 · DASHBOARD DO GESTOR
   Escopo vem de _resolverEscopo(). O gestor não escolhe o que vê.
═══════════════════════════════════════════════════════════════════════════ */

function api_DashboardGestor(matriculaSolicitante) {
  const u = _exigirAcesso(matriculaSolicitante, {
    perfis: CFG.PERFIS_SENSIVEIS, nivelMinimo: 'GESTOR', contexto: 'DASHBOARD_GESTOR'
  });

  const escopo = _resolverEscopo(u);

  // Nível sem direito a dado nominal sensível não recebe este painel.
  // A DIRETORIA é redirecionada ao painel agregado — ver api_PainelDiretoria.
  if (!escopo.ve_dado_nominal_sensivel) {
    registrarLog({
      matricula_usuario: u.matricula, perfil_rbac_no_momento: u.perfil_rbac,
      nivel_hierarquico_no_momento: u.nivel_hierarquico,
      acao_realizada: 'CONSULTA_SENSIVEL', tabela_afetada: 'DASHBOARD_GESTOR',
      resultado: 'NEGADO_RBAC', criticidade: 'AVISO',
      justificativa: 'Nível ' + u.nivel_hierarquico + ' não acessa fadiga nominal'
    });
    return {
      erro: 'Este painel expõe dados individuais de saúde ocupacional. ' +
            'O nível ' + u.nivel_hierarquico + ' acessa o painel agregado.',
      redirecionar_para: 'api_PainelDiretoria'
    };
  }

  const cf = CFG.COL_FUNCIONARIOS;
  const equipe = _lerTudo(CFG.ABAS.FUNCIONARIOS).filter(function (f) {
    return f[cf.matricula - 1] &&
           escopo.ids_setores.indexOf(String(f[cf.setor - 1])) !== -1 &&
           String(f[cf.status - 1]).toUpperCase() !== 'DESLIGADO';
  });

  const alertas = equipe.map(function (f) { return calcularFadiga(f[cf.matricula - 1]); })
    .filter(function (x) { return x !== null; })
    .sort(function (a, b) { return b.score - a.score; });

  const pendencias = [];
  equipe.forEach(function (f) {
    const v = validarColaborador(f[cf.matricula - 1]);
    if (v.motivos.length || v.alertas.length) {
      pendencias.push({
        matricula: v.pessoa.matricula, nome: v.pessoa.nome_completo,
        bloqueios: v.motivos, avisos: v.alertas
      });
    }
  });

  registrarLog({
    matricula_usuario: u.matricula, perfil_rbac_no_momento: u.perfil_rbac,
    nivel_hierarquico_no_momento: u.nivel_hierarquico,
    acao_realizada: 'CONSULTA_SENSIVEL', tabela_afetada: 'DASHBOARD_GESTOR',
    id_registro_afetado: escopo.ids_setores.join(';'), origem_acao: 'WEB_DESKTOP',
    resultado: 'SUCESSO', criticidade: 'INFO'
  });

  return {
    gestor: {
      matricula: u.matricula, nome: u.nome_completo,
      perfil: u.perfil_rbac, nivel: u.nivel_hierarquico, escopo: escopo.tipo
    },
    setores: escopo.setores,
    total_equipe: equipe.length,
    kpis: {
      fadiga_critica: alertas.filter(function (a) { return a.nivel === 'CRITICO'; }).length,
      fadiga_alta: alertas.filter(function (a) { return a.nivel === 'ALTO'; }).length,
      bloqueados: pendencias.filter(function (p) { return p.bloqueios.length > 0; }).length
    },
    alertas_fadiga: alertas,
    pendencias_epi_nr: pendencias,
    mentorias: _listarMentorias(escopo.ids_setores)
  };
}


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 5 · PAINEL DA DIRETORIA (novo na v2.0)
   Visão global, mas AGREGADA. Nenhum nome, nenhuma matrícula, nenhum score
   individual. Índices por setor e por unidade — o que a governança precisa
   para decidir, sem transformar saúde ocupacional em ranking de pessoas.
═══════════════════════════════════════════════════════════════════════════ */

function api_PainelDiretoria(matriculaSolicitante) {
  const u = _exigirAcesso(matriculaSolicitante, {
    perfis: ['ADMIN', 'GESTOR', 'SST'], nivelMinimo: 'DIRETORIA', contexto: 'PAINEL_DIRETORIA'
  });

  const escopo = _resolverEscopo(u);
  const cf = CFG.COL_FUNCIONARIOS;
  const ce = CFG.COL_EQUIPAMENTOS;
  const cm = CFG.COL_MOVIMENTACOES;

  const funcionarios = _lerTudo(CFG.ABAS.FUNCIONARIOS).filter(function (f) {
    return f[cf.matricula - 1] &&
           escopo.ids_setores.indexOf(String(f[cf.setor - 1])) !== -1 &&
           String(f[cf.status - 1]).toUpperCase() !== 'DESLIGADO';
  });

  // — Indicadores por setor, sempre agregados
  const porSetor = escopo.setores.map(function (s) {
    const equipe = funcionarios.filter(function (f) {
      return String(f[cf.setor - 1]) === String(s.id_setor);
    });

    let critica = 0, alta = 0, bloqueados = 0;
    equipe.forEach(function (f) {
      const fad = calcularFadiga(f[cf.matricula - 1]);
      if (fad && fad.nivel === 'CRITICO') critica++;
      if (fad && fad.nivel === 'ALTO') alta++;
      if (!validarColaborador(f[cf.matricula - 1]).liberado) bloqueados++;
    });

    const total = equipe.length || 1;
    return {
      id_setor: s.id_setor, nome_setor: s.nome_setor,
      id_unidade: s.id_unidade, centro_custo: s.centro_custo,
      nivel_criticidade: s.nivel_criticidade,
      efetivo: equipe.length,
      // Percentuais, não nomes. A diretoria decide por índice.
      indice_fadiga_critica: Math.round((critica / total) * 1000) / 10,
      indice_fadiga_alta: Math.round((alta / total) * 1000) / 10,
      indice_conformidade: Math.round(((total - bloqueados) / total) * 1000) / 10
    };
  });

  // — Custo e eficiência de EPI (o que sustenta o ROI)
  const movimentacoes = _lerTudo(CFG.ABAS.MOVIMENTACOES);
  const catalogo = _lerTudo(CFG.ABAS.EQUIPAMENTOS);
  const custoPorEpi = {};
  catalogo.forEach(function (e) {
    custoPorEpi[String(e[ce.codigo_epi - 1])] = Number(e[ce.custo_unitario - 1]) || 0;
  });

  let custoTotal = 0, custoEvitavel = 0, trocasPositivas = 0, trocasNegativas = 0;
  let somaAproveitamento = 0, contagemAproveitamento = 0;

  movimentacoes.forEach(function (m) {
    const tipo = String(m[cm.tipo_movimentacao - 1]).toUpperCase();
    if (tipo !== 'ENTREGA' && tipo !== 'TROCA') return;
    if (String(m[cm.status_confirmacao_totem - 1]).toUpperCase() === 'RECUSADO') return;

    const custo = (custoPorEpi[String(m[cm.codigo_epi - 1])] || 0) * (Number(m[cm.quantidade - 1]) || 1);
    custoTotal += custo;

    const impacto = String(m[cm.impacto_gamificacao - 1]).toUpperCase();
    if (impacto === 'NEGATIVO') { custoEvitavel += custo; trocasNegativas++; }
    if (impacto === 'POSITIVO') trocasPositivas++;

    const perc = Number(m[cm.perc_vida_util_aproveitada - 1]);
    if (perc > 0) { somaAproveitamento += perc; contagemAproveitamento++; }
  });

  registrarLog({
    matricula_usuario: u.matricula, perfil_rbac_no_momento: u.perfil_rbac,
    nivel_hierarquico_no_momento: u.nivel_hierarquico,
    acao_realizada: 'CONSULTA_SENSIVEL', tabela_afetada: 'PAINEL_DIRETORIA',
    id_registro_afetado: escopo.ids_setores.join(';'), origem_acao: 'WEB_DESKTOP',
    resultado: 'SUCESSO', criticidade: 'INFO',
    justificativa: 'Consulta agregada, sem dados nominais'
  });

  return {
    solicitante: { nome: u.nome_completo, nivel: u.nivel_hierarquico, escopo: escopo.tipo },
    abrangencia: { setores: escopo.setores.length, efetivo_total: funcionarios.length },
    indicadores_por_setor: porSetor,
    eficiencia_epi: {
      custo_total_periodo: Math.round(custoTotal * 100) / 100,
      custo_evitavel: Math.round(custoEvitavel * 100) / 100,
      perc_desperdicio: custoTotal ? Math.round((custoEvitavel / custoTotal) * 1000) / 10 : 0,
      trocas_positivas: trocasPositivas,
      trocas_negativas: trocasNegativas,
      aproveitamento_medio_vida_util: contagemAproveitamento
        ? Math.round((somaAproveitamento / contagemAproveitamento) * 1000) / 10 : 0
    },
    nota_privacidade: 'Painel agregado. Dados individuais de fadiga e saúde ocupacional ' +
                      'permanecem restritos ao gestor do setor e à SST (Dossiê 3.3.2).'
  };
}


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 6 · GAMIFICAÇÃO ASSIMÉTRICA
   Três proteções redundantes de piso zero. Redundância é intencional.
═══════════════════════════════════════════════════════════════════════════ */

function calcularBonusMentor(vinculo) {
  const pontos = Number(vinculo.pontos_acumulados_mentorado) || 0;
  const base = Number(vinculo.pontos_base_inicial) || 0;
  let repasse = Number(vinculo.percentual_repasse_mentor) || 0;

  repasse = Math.min(GAMIFICACAO.REPASSE_MAXIMO,
            Math.max(GAMIFICACAO.REPASSE_MINIMO, repasse));

  const evolucaoBruta = pontos - base;

  // PROTEÇÃO 1 · piso zero na evolução
  const evolucaoLiquida = Math.max(0, evolucaoBruta);
  // PROTEÇÃO 2 · piso zero no produto
  let saldo = Math.max(0, evolucaoLiquida * repasse);
  // PROTEÇÃO 3 · trava final antes de devolver
  if (!isFinite(saldo) || saldo < 0) saldo = 0;

  return {
    evolucao_bruta: evolucaoBruta,
    evolucao_liquida: evolucaoLiquida,
    percentual_aplicado: repasse,
    saldo_bonus_mentor: Math.round(saldo * 100) / 100,
    impacto_infracoes_no_mentor: 0   // constante, por desenho
  };
}

function _listarMentorias(idsSetores) {
  const cg = CFG.COL_GAMIFICACAO;

  return _lerTudo(CFG.ABAS.GAMIFICACAO).filter(function (v) {
    return v[cg.id_vinculo - 1] &&
           String(v[cg.status_vinculo - 1]).toUpperCase() === 'ATIVO' &&
           (!idsSetores || idsSetores.indexOf(String(v[cg.id_setor - 1])) !== -1);
  }).map(function (v) {
    const mentor = _obterUsuario(v[cg.matricula_mentor - 1]);
    const mentorado = _obterUsuario(v[cg.matricula_mentorado - 1]);
    const calc = calcularBonusMentor({
      pontos_acumulados_mentorado: v[cg.pontos_acumulados_mentorado - 1],
      pontos_base_inicial: v[cg.pontos_base_inicial - 1],
      percentual_repasse_mentor: v[cg.percentual_repasse_mentor - 1]
    });

    return {
      id_vinculo: v[cg.id_vinculo - 1],
      mentor: mentor ? mentor.nome_completo : v[cg.matricula_mentor - 1],
      mentorado: mentorado ? mentorado.nome_completo : v[cg.matricula_mentorado - 1],
      evolucao_bruta: calc.evolucao_bruta,
      evolucao_liquida: calc.evolucao_liquida,
      saldo_bonus_mentor: calc.saldo_bonus_mentor,
      // Informativo: orienta a SST, não penaliza o mentor
      infracoes_mentorado: Number(v[cg.infracoes_mentorado - 1]) || 0,
      impacto_infracoes_no_mentor: 0,
      nivel_evolucao: v[cg.nivel_evolucao - 1],
      validado_por_sst: v[cg.validado_por_sst - 1]
    };
  });
}


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 7 · ROTINAS AUTOMÁTICAS
═══════════════════════════════════════════════════════════════════════════ */

function rotina_ExpirarConfirmacoes() {
  const lock = LockService.getScriptLock();
  lock.waitLock(CFG.TIMEOUT_LOCK);

  try {
    const cm = CFG.COL_MOVIMENTACOES;
    const sh = _aba(CFG.ABAS.MOVIMENTACOES);
    const dados = _lerTudo(CFG.ABAS.MOVIMENTACOES);
    const limite = Date.now() - CFG.HORAS_EXPIRACAO_CONFIRMACAO * 3600000;
    let expirados = 0;

    /* PASSO 1: coletar índices em memória (sem escrita na planilha) */
    const expirarIndices = [];
    dados.forEach(function (linha, i) {
      if (String(linha[cm.status_confirmacao_totem - 1]).toUpperCase() !== 'PENDENTE') return;
      const dataHora = new Date(linha[cm.data_hora - 1]);
      if (isNaN(dataHora.getTime()) || dataHora.getTime() > limite) return;

      expirarIndices.push(i);
    });

    /* PASSO 2: escrita batch — 1 leitura + 1 escrita para a aba inteira */
    if (expirarIndices.length > 0) {
      const ultima = sh.getLastRow();
      const totalCol = sh.getLastColumn();
      const bloco = ultima >= 2
        ? sh.getRange(2, 1, ultima - 1, totalCol).getValues()
        : [];

      expirarIndices.forEach(function (i) {
        bloco[i][cm.status_confirmacao_totem - 1] = 'EXPIRADO';

        /* logs: escrita individual — corrente SHA-256 exige sequencialidade */
        _gravarLogSemTrava({
          matricula_usuario: 'SISTEMA', perfil_rbac_no_momento: 'SISTEMA',
          nivel_hierarquico_no_momento: 'SISTEMA',
          acao_realizada: 'ALTERACAO', tabela_afetada: CFG.ABAS.MOVIMENTACOES,
          id_registro_afetado: dados[i][cm.id_movimentacao - 1],
          origem_acao: 'ROTINA_AUTOMATICA', resultado: 'SUCESSO', criticidade: 'AVISO',
          valor_anterior: JSON.stringify({ status: 'PENDENTE' }),
          valor_novo: JSON.stringify({ status: 'EXPIRADO' }),
          justificativa: 'Sem confirmação em ' + CFG.HORAS_EXPIRACAO_CONFIRMACAO + 'h'
        });
        expirados++;
      });

      if (bloco.length > 0) {
        sh.getRange(2, 1, bloco.length, totalCol).setValues(bloco);
        _invalidarCache(CFG.ABAS.MOVIMENTACOES);
      }
    }

    return { expirados: expirados };
  } finally {
    lock.releaseLock();
  }
}

function rotina_AuditarIntegridade() {
  const r = verificarIntegridadeLog();
  if (!r.integro) Logger.log('⚠ INTEGRIDADE COMPROMETIDA: ' + r.problemas.join(' || '));
  return r;
}

/** Varredura diária da matriz de permissões — detecta escalada de privilégio. */
function rotina_AuditarPermissoes() {
  const c = CFG.COL_FUNCIONARIOS;
  const inconsistencias = [];

  _lerTudo(CFG.ABAS.FUNCIONARIOS).forEach(function (f) {
    const mat = f[c.matricula - 1];
    if (!mat) return;
    const perfil = String(f[c.perfil_rbac - 1]).toUpperCase();
    const nivel = String(f[c.nivel_hierarquico - 1] || '').toUpperCase();
    if (!nivel || !CFG.HIERARQUIA[nivel] ||
        (CFG.COMBINACOES_VALIDAS[nivel] || []).indexOf(perfil) === -1) {
      inconsistencias.push(mat + ' (' + perfil + ' + ' + (nivel || 'vazio') + ')');
    }
  });

  if (inconsistencias.length) {
    registrarLog({
      matricula_usuario: 'SISTEMA', perfil_rbac_no_momento: 'SISTEMA',
      nivel_hierarquico_no_momento: 'SISTEMA',
      acao_realizada: 'ALTERACAO_PERMISSAO', tabela_afetada: CFG.ABAS.FUNCIONARIOS,
      origem_acao: 'ROTINA_AUTOMATICA', resultado: 'ERRO', criticidade: 'CRITICO',
      justificativa: 'Combinações inválidas detectadas: ' + inconsistencias.join(' | ')
    });
  }

  return { conforme: inconsistencias.length === 0, inconsistencias: inconsistencias };
}

function rotina_AlertarTreinamentosVencidos() {
  const lock = LockService.getScriptLock();
  lock.waitLock(CFG.TIMEOUT_LOCK);

  try {
    const ct = CFG.COL_TREINAMENTOS;
    const dados = _lerTudo(CFG.ABAS.TREINAMENTOS);
    const agora = new Date();
    const avisoDias = 30;
    const limite = new Date(agora.getTime() + avisoDias * 86400000);
    const alertados = [];

    dados.forEach(function (linha) {
      if (String(linha[ct.status - 1]).toUpperCase() !== 'VALIDO') return;
      const vencimento = new Date(linha[ct.data_vencimento - 1]);
      if (isNaN(vencimento.getTime()) || vencimento > limite) return;

      const matricula = linha[ct.matricula - 1];
      const funcionario = _obterUsuario(matricula);
      if (!funcionario) return;

      const gestor = _resolverGestorDoSetor(funcionario.setor, funcionario.id_gestor);
      const destinatario = _obterUsuario(gestor);

      registrarLog({
        matricula_usuario: 'SISTEMA', perfil_rbac_no_momento: 'SISTEMA',
        nivel_hierarquico_no_momento: 'SISTEMA',
        acao_realizada: 'ALERTA_TREINAMENTO_VENCIDO', tabela_afetada: CFG.ABAS.TREINAMENTOS,
        id_registro_afetado: matricula, origem_acao: 'ROTINA_AUTOMATICA',
        id_dispositivo: 'SERVIDOR', resultado: 'SUCESSO', criticidade: 'AVISO',
        justificativa: 'Treinamento ' + linha[ct.norma - 1] + ' vence em ' +
                       Utilities.formatDate(vencimento, Session.getScriptTimeZone(), 'dd/MM/yyyy')
      });

      if (CFG.FEATURE_FLAGS && CFG.FEATURE_FLAGS.alertas_treinamento_email && destinatario && destinatario.email_corporativo) {
        const assunto = '[EHS] Treinamento vencendo — ' + funcionario.nome_completo;
        const corpo = [
          'Treinamento vencendo em até ' + avisoDias + ' dias.',
          '',
          'Colaborador: ' + funcionario.nome_completo + ' (' + matricula + ')',
          'Norma: ' + linha[ct.norma - 1],
          'Vencimento: ' + Utilities.formatDate(vencimento, Session.getScriptTimeZone(), 'dd/MM/yyyy'),
          '',
          'Acesse o sistema para agendar a reciclagem.'
        ].join('\n');
        GmailApp.sendEmail(destinatario.email_corporativo, assunto, corpo);
      }

      alertados.push({ matricula: matricula, norma: linha[ct.norma - 1], vencimento: vencimento });
    });

    return { alertados: alertados };
  } finally {
    lock.releaseLock();
  }
}

function instalarGatilhos() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });

  ScriptApp.newTrigger('rotina_VarrerFadiga').timeBased().atHour(6).everyDays(1).create();
  ScriptApp.newTrigger('rotina_ExpirarConfirmacoes').timeBased().everyHours(6).create();
  ScriptApp.newTrigger('rotina_AuditarIntegridade').timeBased().atHour(23).everyDays(1).create();
  ScriptApp.newTrigger('rotina_AuditarPermissoes').timeBased().atHour(5).everyDays(1).create();
  ScriptApp.newTrigger('rotina_AlertarTreinamentosVencidos').timeBased().atHour(7).everyDays(1).create();

  return 'Gatilhos v2.1 instalados: fadiga (06h), expiração (6/6h), ' +
         'permissões (05h), integridade (23h), treinamentos (07h).';
}


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 8 · TESTE DE IMPLANTAÇÃO v2.0
   Rode ANTES de liberar para o chão de fábrica.
═══════════════════════════════════════════════════════════════════════════ */

function TESTE_ImplantacaoCompleta() {
  const r = ['═══ TESTE DE IMPLANTAÇÃO · EHS Smart Enterprise v' + CFG.VERSAO + ' ═══'];

  // ── 1 · Corrente de hash
  const integridade = verificarIntegridadeLog();
  r.push((integridade.integro ? '✔' : '✘') + ' Integridade do log: ' +
         integridade.total_registros + ' registros' +
         (integridade.integro ? ' — corrente íntegra' : ' — ' + integridade.problemas.join('; ')));

  // ── 2 · ASSIMETRIA POSITIVA (regra inegociável do Dossiê 5.5)
  const cenarios = [
    { nome: 'Mentorado evoluiu bem',
      v: { pontos_acumulados_mentorado: 820, pontos_base_inicial: 500, percentual_repasse_mentor: 0.15 } },
    { nome: 'Mentorado REGREDIU',
      v: { pontos_acumulados_mentorado: 290, pontos_base_inicial: 380, percentual_repasse_mentor: 0.10 } },
    { nome: 'Mentorado zerou tudo',
      v: { pontos_acumulados_mentorado: 0, pontos_base_inicial: 900, percentual_repasse_mentor: 0.20 } }
  ];
  let assimetriaOk = true;
  cenarios.forEach(function (c) {
    const calc = calcularBonusMentor(c.v);
    const passou = calc.saldo_bonus_mentor >= 0 && calc.impacto_infracoes_no_mentor === 0;
    if (!passou) assimetriaOk = false;
    r.push((passou ? '✔' : '✘') + ' ' + c.nome + ' → evolução bruta ' +
           calc.evolucao_bruta + ', saldo do mentor ' + calc.saldo_bonus_mentor);
  });
  r.push((assimetriaOk ? '✔' : '✘ FALHA GRAVE') +
         ' Assimetria positiva: o mentor nunca fica com saldo negativo.');

  // ── 3 · Isolamento do totem
  const funcionarios = _lerTudo(CFG.ABAS.FUNCIONARIOS);
  if (funcionarios.length) {
    const m = funcionarios[0][CFG.COL_FUNCIONARIOS.matricula - 1];
    const resposta = api_ValidarTotem(m, 'TESTE-01');
    const proibidos = ['fadiga', 'score', 'nivel', 'jornada', 'horas_extras', 'nivel_hierarquico'];
    const vazou = proibidos.filter(function (c) { return Object.keys(resposta).indexOf(c) !== -1; });
    r.push((vazou.length === 0 ? '✔' : '✘') + ' Isolamento do totem: ' +
           (vazou.length === 0 ? 'nenhum dado sensível no payload' : 'VAZAMENTO em ' + vazou.join(', ')));
  }

  // ── 4 · Matriz bidimensional
  const perm = rotina_AuditarPermissoes();
  r.push((perm.conforme ? '✔' : '✘') + ' Matriz perfil × nível: ' +
         (perm.conforme ? 'todas as combinações válidas'
                        : 'inconsistências em ' + perm.inconsistencias.join(', ')));

  const masters = _contarMasterAdmins();
  r.push((masters >= 1 && masters <= 3 ? '✔' : '✘') +
         ' MASTER_ADMIN ativos: ' + masters + ' (esperado: 1 a 3)');

  // ── 5 · Privacidade da diretoria
  const nivelDiretoria = CFG.HIERARQUIA.DIRETORIA;
  r.push((nivelDiretoria.ve_dado_nominal_sensivel === false ? '✔' : '✘') +
         ' Diretoria sem acesso a fadiga nominal (Dossiê 3.3.2)');

  // ── 6 · Abas obrigatórias
  Object.keys(CFG.ABAS).forEach(function (k) {
    if (!SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG.ABAS[k])) {
      r.push('✘ Aba ausente: ' + CFG.ABAS[k]);
    }
  });

  // ── 7 · Colunas novas da v2.0
  const shFunc = _aba(CFG.ABAS.FUNCIONARIOS);
  const temNivel = shFunc.getLastColumn() >= CFG.COL_FUNCIONARIOS.unidades_visiveis;
  r.push((temNivel ? '✔' : '✘') + ' Colunas W e X em Funcionarios (nivel_hierarquico, unidades_visiveis)');

  const shLog = _aba(CFG.ABAS.LOG);
  const temNivelLog = shLog.getLastColumn() >= CFG.COL_LOG.nivel_hierarquico_no_momento;
  r.push((temNivelLog ? '✔' : '✘') + ' Coluna S em Log_Auditoria (nivel_hierarquico_no_momento)');

  const relatorio = r.join('\n');
  Logger.log(relatorio);
  return relatorio;
}
