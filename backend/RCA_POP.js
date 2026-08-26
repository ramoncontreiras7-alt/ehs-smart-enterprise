/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EHS SMART ENTERPRISE · RCA_POP.gs — v2.0
 * Investigação de causa raiz e atualização dinâmica de POPs (Auto-Healing).
 * Dossiê seção 4 — fluxo completo de 10 passos (4.5.1).
 *
 * DEPENDE de Code_v2.gs e Motor_Regras_v2.gs no MESMO projeto:
 * usa CFG, _aba, _lerTudo, _buscarLinha, _listar, _obterUsuario,
 * _exigirAcesso, registrarLog, _gravarLogSemTrava, _sha256.
 *
 * REGRA DE ACESSO (Dossiê 4.2): abrir e editar RCA é restrito a SST e ADMIN.
 * Gestor só CONSULTA (Matriz RBAC 6.4) — nunca abre ou encerra.
 *
 * ONDE COLAR: Arquivo → + → Script → nomeie "RCA_POP"
 * ═══════════════════════════════════════════════════════════════════════════
 */

/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 1 · CONFIGURAÇÃO DAS 5 ABAS NOVAS
═══════════════════════════════════════════════════════════════════════════ */

const CFG_RCA = {

  ABAS: {
    INCIDENTES: 'Incidentes',
    RCA: 'RCA_Investigacoes',
    POPS: 'POPs',
    POPS_HIST: 'POPs_Historico',
    RECICLAGEM: 'Matriz_Reciclagem'
  },

  COL_INCIDENTES: {
    id_incidente: 1, data_hora: 2, matricula_acidentado: 3, id_setor: 4,
    tipo_evento: 5, gravidade: 6, descricao_resumida: 7, testemunhas: 8,
    epi_envolvido: 9, equipamento_envolvido: 10, status: 11, id_rca: 12,
    registrado_por: 13, criado_em: 14
  },

  COL_RCA: {
    id_rca: 1, id_incidente: 2, aberto_por: 3, data_abertura: 4,
    depoimento_acidentado: 5, depoimentos_testemunhas: 6, relato_gestor: 7,
    fatores_ambientais: 8, fatores_contextuais: 9, fatores_emocionais: 10,
    condicao_equipamento: 11, condicao_epi: 12, categoria_causa: 13,
    pop_aplicavel: 14, etapa_descumprida: 15, necessidade_reciclagem: 16,
    status: 17, encerrado_por: 18, data_encerramento: 19, conclusao: 20
  },

  COL_POPS: {
    codigo_pop: 1, titulo: 2, versao_atual: 3, status_vigencia: 4,
    publico_impactado: 5, treinamentos_associados: 6, id_rca_origem: 7,
    atualizado_em: 8
  },

  COL_POPS_HIST: {
    id_versao: 1, codigo_pop: 2, numero_versao: 3, motivo_alteracao: 4,
    id_rca_relacionado: 5, responsavel_tecnico: 6, data_aprovacao: 7,
    hash_versao: 8
  },

  COL_RECICLAGEM: {
    id_reciclagem: 1, codigo_pop: 2, id_funcao: 3, data_geracao: 4,
    prazo_limite: 5, status: 6, id_rca_origem: 7
  },

  /** Categorias de causa raiz — Dossiê 4.3.1, texto fechado. */
  CATEGORIAS_CAUSA: [
    'DESVIO_POP', 'AUSENCIA_EPI', 'USO_INCORRETO_EPI', 'EPI_INADEQUADO',
    'DESGASTE_PREMATURO', 'FALHA_TREINAMENTO', 'FALHA_COMUNICACAO',
    'FALHA_SUPERVISAO', 'CONDICAO_INSEGURA', 'FADIGA_QUEDA_ATENCAO',
    'INCOMPATIBILIDADE_HABILITACAO', 'PROCEDIMENTO_INEXISTENTE_OU_DESATUALIZADO'
  ],

  /** Prazo padrão para conclusão de reciclagem obrigatória. */
  PRAZO_RECICLAGEM_DIAS: 30
};


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 2 · PASSO 1 — REGISTRO DO INCIDENTE
    Qualquer FUNCIONARIO, SST ou ADMIN pode registrar. É o gatilho de tudo.
 ═══════════════════════════════════════════════════════════════════════════ */

function api_ListarSetores() {
  const cs = CFG.COL_SETORES;
  return _lerTudo(CFG.ABAS.SETORES).map(function (s) {
    return {
      id_setor: s[cs.id_setor - 1],
      nome_setor: s[cs.nome_setor - 1],
      id_gestor_responsavel: s[cs.id_gestor_responsavel - 1],
      nivel_criticidade: s[cs.nivel_criticidade - 1],
      status: s[cs.status - 1]
    };
  }).filter(function (s) { return String(s.status).toUpperCase() === 'ATIVO'; });
}

function api_ListarIncidentes() {
  const c = CFG_RCA.COL_INCIDENTES;
  return _lerTudo(CFG_RCA.ABAS.INCIDENTES).map(function (linha) {
    return {
      id_incidente: linha[c.id_incidente - 1],
      data_hora: linha[c.data_hora - 1],
      tipo_evento: linha[c.tipo_evento - 1],
      gravidade: linha[c.gravidade - 1],
      descricao_resumida: linha[c.descricao_resumida - 1],
      status: linha[c.status - 1],
      id_rca: linha[c.id_rca - 1],
      registrado_por: linha[c.registrado_por - 1]
    };
  }).sort(function (a, b) {
    return new Date(b.data_hora || 0) - new Date(a.data_hora || 0);
  });
}

function api_RegistrarIncidente(params, matriculaSolicitante) {
  const solicitante = _obterUsuario(matriculaSolicitante);
  if (!solicitante) return { ok: false, erro: 'Usuário não identificado.' };

  const tiposValidos = ['ACIDENTE', 'QUASE_ACIDENTE', 'DESVIO'];
  const gravidadesValidas = ['LEVE', 'MODERADA', 'GRAVE', 'FATAL'];
  const tipo = String(params.tipo_evento || '').toUpperCase();
  const gravidade = String(params.gravidade || '').toUpperCase();

  if (tiposValidos.indexOf(tipo) === -1) return { ok: false, erro: 'tipo_evento inválido.' };
  if (gravidadesValidas.indexOf(gravidade) === -1) return { ok: false, erro: 'gravidade inválida.' };
  if (!params.descricao_resumida || String(params.descricao_resumida).trim().length < 15) {
    return { ok: false, erro: 'Descrição precisa ter ao menos 15 caracteres.' };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(CFG.TIMEOUT_LOCK);
  try {
    const sh = _aba(CFG_RCA.ABAS.INCIDENTES);
    const agora = new Date();
    const idIncidente = 'INC-' +
      Utilities.formatDate(agora, Session.getScriptTimeZone(), 'yyyyMMdd') + '-' +
      Utilities.getUuid().slice(0, 4);

    const c = CFG_RCA.COL_INCIDENTES;
    const linha = [];
    linha[c.id_incidente - 1] = idIncidente;
    linha[c.data_hora - 1] = params.data_hora ? new Date(params.data_hora) : agora;
    linha[c.matricula_acidentado - 1] = params.matricula_acidentado || '';
    linha[c.id_setor - 1] = params.id_setor || solicitante.setor;
    linha[c.tipo_evento - 1] = tipo;
    linha[c.gravidade - 1] = gravidade;
    linha[c.descricao_resumida - 1] = params.descricao_resumida;
    linha[c.testemunhas - 1] = params.testemunhas || '';
    linha[c.epi_envolvido - 1] = params.epi_envolvido || '';
    linha[c.equipamento_envolvido - 1] = params.equipamento_envolvido || '';
    linha[c.status - 1] = 'ABERTO';
    linha[c.id_rca - 1] = '';
    linha[c.registrado_por - 1] = solicitante.matricula;
    linha[c.criado_em - 1] = agora;

    sh.appendRow(linha);

    _gravarLogSemTrava({
      matricula_usuario: solicitante.matricula, perfil_rbac_no_momento: solicitante.perfil_rbac,
      nivel_hierarquico_no_momento: solicitante.nivel_hierarquico,
      acao_realizada: 'CRIACAO', tabela_afetada: CFG_RCA.ABAS.INCIDENTES,
      id_registro_afetado: idIncidente, origem_acao: 'WEB_DESKTOP', resultado: 'SUCESSO',
      criticidade: (gravidade === 'GRAVE' || gravidade === 'FATAL') ? 'CRITICO' : 'AVISO',
      valor_novo: JSON.stringify({ tipo: tipo, gravidade: gravidade, setor: linha[c.id_setor - 1] })
    });

    return { ok: true, id_incidente: idIncidente, status: 'ABERTO' };
  } finally {
    lock.releaseLock();
  }
}


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 3 · PASSO 2 — ABERTURA DA INVESTIGAÇÃO
   TRAVA DURA: só SST e ADMIN abrem RCA. Gestor não abre — só consulta
   (Dossiê 4.2 e Matriz RBAC 6.4).
═══════════════════════════════════════════════════════════════════════════ */

function api_AbrirRCA(idIncidente, matriculaSolicitante) {
  const solicitante = _exigirAcesso(matriculaSolicitante, {
    perfis: CFG.PERFIS_INVESTIGACAO, contexto: 'ABERTURA_RCA'
  });

  const incRow = _buscarLinha(CFG_RCA.ABAS.INCIDENTES, CFG_RCA.COL_INCIDENTES.id_incidente, idIncidente);
  if (!incRow) return { ok: false, erro: 'Incidente não encontrado.' };

  const ci = CFG_RCA.COL_INCIDENTES;
  if (incRow.dados[ci.id_rca - 1]) {
    return { ok: false, erro: 'Este incidente já possui RCA: ' + incRow.dados[ci.id_rca - 1] };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(CFG.TIMEOUT_LOCK);
  try {
    const sh = _aba(CFG_RCA.ABAS.RCA);
    const agora = new Date();
    const idRca = 'RCA-' + Utilities.getUuid().slice(0, 4);

    const c = CFG_RCA.COL_RCA;
    const linha = [];
    linha[c.id_rca - 1] = idRca;
    linha[c.id_incidente - 1] = idIncidente;
    linha[c.aberto_por - 1] = solicitante.matricula;
    linha[c.data_abertura - 1] = agora;
    linha[c.status - 1] = 'ABERTA';

    sh.appendRow(linha);

    // Vincula o incidente à investigação e muda o status
    _aba(CFG_RCA.ABAS.INCIDENTES).getRange(incRow.linha, ci.id_rca).setValue(idRca);
    _aba(CFG_RCA.ABAS.INCIDENTES).getRange(incRow.linha, ci.status).setValue('EM_INVESTIGACAO');

    _gravarLogSemTrava({
      matricula_usuario: solicitante.matricula, perfil_rbac_no_momento: solicitante.perfil_rbac,
      nivel_hierarquico_no_momento: solicitante.nivel_hierarquico,
      acao_realizada: 'ABERTURA_RCA', tabela_afetada: CFG_RCA.ABAS.RCA,
      id_registro_afetado: idRca, origem_acao: 'WEB_DESKTOP', resultado: 'SUCESSO',
      criticidade: 'INFO', valor_novo: JSON.stringify({ id_incidente: idIncidente })
    });

    return { ok: true, id_rca: idRca, status: 'ABERTA' };
  } finally {
    lock.releaseLock();
  }
}


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 4 · PASSOS 3–4 — COLETA DE EVIDÊNCIAS E DIAGNÓSTICO
   Edição incremental: SST vai preenchendo a investigação em etapas.
   Mesma trava de perfil da abertura.
═══════════════════════════════════════════════════════════════════════════ */

function api_AtualizarRCA(idRca, campos, matriculaSolicitante) {
  const solicitante = _exigirAcesso(matriculaSolicitante, {
    perfis: CFG.PERFIS_INVESTIGACAO, contexto: 'EDICAO_RCA'
  });

  const r = _buscarLinha(CFG_RCA.ABAS.RCA, CFG_RCA.COL_RCA.id_rca, idRca);
  if (!r) return { ok: false, erro: 'RCA não encontrada.' };

  const c = CFG_RCA.COL_RCA;
  const statusAtual = String(r.dados[c.status - 1]).toUpperCase();
  if (statusAtual === 'CONCLUIDA') {
    return { ok: false, erro: 'RCA já concluída. Reabertura exige justificativa formal — use api_EstornarMovimentacao como referência de fluxo, não implementado aqui por ora.' };
  }

  if (campos.categoria_causa &&
      CFG_RCA.CATEGORIAS_CAUSA.indexOf(String(campos.categoria_causa).toUpperCase()) === -1) {
    return { ok: false, erro: 'categoria_causa inválida. Use uma de: ' + CFG_RCA.CATEGORIAS_CAUSA.join(', ') };
  }

  // Campos editáveis nesta etapa — lista branca também na escrita
  const editaveis = [
    'depoimento_acidentado', 'depoimentos_testemunhas', 'relato_gestor',
    'fatores_ambientais', 'fatores_contextuais', 'fatores_emocionais',
    'condicao_equipamento', 'condicao_epi', 'categoria_causa',
    'pop_aplicavel', 'etapa_descumprida', 'necessidade_reciclagem'
  ];

  const sh = _aba(CFG_RCA.ABAS.RCA);
  const ultimaCol = sh.getLastColumn();
  const antes = {};
  const depois = {};

  /* PASSO 1: coletar updates em memória (sem escrita na planilha) */
  const updates = [];
  editaveis.forEach(function (campo) {
    if (campos[campo] === undefined) return;
    const col = c[campo];
    const valor = campo === 'categoria_causa' ? String(campos[campo]).toUpperCase() : campos[campo];
    updates.push({ col: col, valor: valor, campo: campo });
  });

  const statusAlterado = statusAtual === 'ABERTA';
  if (statusAlterado) {
    updates.push({ col: c.status, valor: 'EM_ANALISE', campo: c.status });
  }

  /* PASSO 2: escrita batch — 1 leitura + 1 escrita para a linha inteira */
  if (updates.length > 0) {
    const linhaCompleta = sh.getRange(r.linha, 1, 1, ultimaCol).getValues()[0];

    updates.forEach(function (u) {
      antes[u.campo] = linhaCompleta[u.col - 1];
      linhaCompleta[u.col - 1] = u.valor;
      depois[u.campo] = u.valor;
    });

    sh.getRange(r.linha, 1, 1, ultimaCol).setValues([linhaCompleta]);
  }

  _gravarLogSemTrava({
    matricula_usuario: solicitante.matricula, perfil_rbac_no_momento: solicitante.perfil_rbac,
    nivel_hierarquico_no_momento: solicitante.nivel_hierarquico,
    acao_realizada: 'ALTERACAO', tabela_afetada: CFG_RCA.ABAS.RCA,
    id_registro_afetado: idRca, origem_acao: 'WEB_DESKTOP', resultado: 'SUCESSO',
    criticidade: 'INFO', valor_anterior: JSON.stringify(antes), valor_novo: JSON.stringify(depois)
  });

  return { ok: true, id_rca: idRca, status: statusAtual === 'ABERTA' ? 'EM_ANALISE' : statusAtual };
}


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 5 · PASSOS 5–6 — GERAÇÃO AUTOMÁTICA DE PROPOSTA DE POP
   O coração do Auto-Healing. A causa raiz decide se e como o POP muda.
   Isto GERA UMA PROPOSTA — não aprova sozinho. Aprovação é o bloco 6.
═══════════════════════════════════════════════════════════════════════════ */

function api_GerarPropostaPOP(idRca, dadosProposta, matriculaSolicitante) {
  const solicitante = _exigirAcesso(matriculaSolicitante, {
    perfis: CFG.PERFIS_INVESTIGACAO, contexto: 'PROPOSTA_POP'
  });

  const r = _buscarLinha(CFG_RCA.ABAS.RCA, CFG_RCA.COL_RCA.id_rca, idRca);
  if (!r) return { ok: false, erro: 'RCA não encontrada.' };

  const c = CFG_RCA.COL_RCA;
  const categoria = String(r.dados[c.categoria_causa - 1]).toUpperCase();
  if (!categoria) {
    return { ok: false, erro: 'Defina categoria_causa na RCA antes de propor alteração de POP.' };
  }

  // A causa raiz filtra o que faz sentido gerar. Falha de EPI não deveria
  // reescrever POP sozinha — deveria mexer em estoque/CA, não procedimento.
  const CAUSAS_QUE_GERAM_POP = [
    'DESVIO_POP', 'FALHA_COMUNICACAO', 'FALHA_SUPERVISAO', 'CONDICAO_INSEGURA',
    'INCOMPATIBILIDADE_HABILITACAO', 'PROCEDIMENTO_INEXISTENTE_OU_DESATUALIZADO'
  ];
  if (CAUSAS_QUE_GERAM_POP.indexOf(categoria) === -1) {
    return {
      ok: false,
      erro: 'Categoria "' + categoria + '" não gera proposta automática de POP. ' +
            'Se for o caso, crie a proposta manualmente com justificativa via api_VersionarPOP diretamente.'
    };
  }

  const codigoPop = dadosProposta.codigo_pop || r.dados[c.pop_aplicavel - 1];
  if (!codigoPop) return { ok: false, erro: 'Informe codigo_pop (novo ou existente).' };

  const resultado = _internal_VersionarPOP({
    codigo_pop: codigoPop,
    titulo: dadosProposta.titulo,
    motivo_alteracao: dadosProposta.motivo_alteracao ||
      ('Auto-Healing a partir de ' + idRca + ' · causa: ' + categoria),
    id_rca_relacionado: idRca,
    publico_impactado: dadosProposta.publico_impactado,
    treinamentos_associados: dadosProposta.treinamentos_associados,
    responsavel_tecnico: solicitante.matricula,
    // Nasce EM_REVISAO — não vigora sozinha. Passo 7 do Dossiê exige revisão.
    status_vigencia: 'EM_REVISAO'
  });

  if (!resultado.ok) return resultado;

  _gravarLogSemTrava({
    matricula_usuario: solicitante.matricula, perfil_rbac_no_momento: solicitante.perfil_rbac,
    nivel_hierarquico_no_momento: solicitante.nivel_hierarquico,
    acao_realizada: 'VERSIONAMENTO_POP', tabela_afetada: CFG_RCA.ABAS.POPS,
    id_registro_afetado: resultado.id_versao, origem_acao: 'MOTOR_REGRAS', resultado: 'SUCESSO',
    criticidade: 'AVISO',
    justificativa: 'Proposta gerada automaticamente a partir de ' + idRca +
                   '. Aguardando revisão técnica (status EM_REVISAO).'
  });

  return resultado;
}


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 6 · VERSIONAMENTO DE POP
   POPs_Historico é append-only: NUNCA sobrescreve versão anterior.
   POPs guarda só o "ponteiro" para a versão vigente.
═══════════════════════════════════════════════════════════════════════════ */

function api_VersionarPOP(dados, matriculaSolicitante) {
  const solicitante = _exigirAcesso(matriculaSolicitante, {
    perfis: CFG.PERFIS_INVESTIGACAO, contexto: 'VERSIONAMENTO_POP'
  });
  dados.responsavel_tecnico = solicitante.matricula;
  return _internal_VersionarPOP(dados);
}

/** Função interna — reaproveitada pela proposta automática e pela API pública. */
function _internal_VersionarPOP(dados) {
  if (!dados.codigo_pop) return { ok: false, erro: 'codigo_pop é obrigatório.' };
  if (!dados.motivo_alteracao || String(dados.motivo_alteracao).trim().length < 10) {
    return { ok: false, erro: 'motivo_alteracao obrigatório (mínimo 10 caracteres).' };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(CFG.TIMEOUT_LOCK);
  try {
    const cp = CFG_RCA.COL_POPS;
    const popRow = _buscarLinha(CFG_RCA.ABAS.POPS, cp.codigo_pop, dados.codigo_pop);
    const agora = new Date();
    const shPops = _aba(CFG_RCA.ABAS.POPS);

    let novaVersao;
    if (popRow) {
      novaVersao = (Number(popRow.dados[cp.versao_atual - 1]) || 0) + 1;
      shPops.getRange(popRow.linha, cp.versao_atual).setValue(novaVersao);
      shPops.getRange(popRow.linha, cp.status_vigencia).setValue(dados.status_vigencia || 'VIGENTE');
      shPops.getRange(popRow.linha, cp.id_rca_origem).setValue(dados.id_rca_relacionado || '');
      shPops.getRange(popRow.linha, cp.atualizado_em).setValue(agora);
      if (dados.titulo) shPops.getRange(popRow.linha, cp.titulo).setValue(dados.titulo);
      if (dados.publico_impactado) shPops.getRange(popRow.linha, cp.publico_impactado).setValue(dados.publico_impactado);
      if (dados.treinamentos_associados) shPops.getRange(popRow.linha, cp.treinamentos_associados).setValue(dados.treinamentos_associados);
    } else {
      novaVersao = 1;
      const linha = [];
      linha[cp.codigo_pop - 1] = dados.codigo_pop;
      linha[cp.titulo - 1] = dados.titulo || dados.codigo_pop;
      linha[cp.versao_atual - 1] = novaVersao;
      linha[cp.status_vigencia - 1] = dados.status_vigencia || 'VIGENTE';
      linha[cp.publico_impactado - 1] = dados.publico_impactado || '';
      linha[cp.treinamentos_associados - 1] = dados.treinamentos_associados || '';
      linha[cp.id_rca_origem - 1] = dados.id_rca_relacionado || '';
      linha[cp.atualizado_em - 1] = agora;
      shPops.appendRow(linha);
    }

    // POPs_Historico: append-only, uma linha nova por versão — SEMPRE
    const idVersao = dados.codigo_pop + '-v' + novaVersao;
    const ch = CFG_RCA.COL_POPS_HIST;
    const linhaHist = [];
    linhaHist[ch.id_versao - 1] = idVersao;
    linhaHist[ch.codigo_pop - 1] = dados.codigo_pop;
    linhaHist[ch.numero_versao - 1] = novaVersao;
    linhaHist[ch.motivo_alteracao - 1] = dados.motivo_alteracao;
    linhaHist[ch.id_rca_relacionado - 1] = dados.id_rca_relacionado || '';
    linhaHist[ch.responsavel_tecnico - 1] = dados.responsavel_tecnico;
    linhaHist[ch.data_aprovacao - 1] = agora;
    linhaHist[ch.hash_versao - 1] = _sha256(linhaHist.join('|') + idVersao);

    _aba(CFG_RCA.ABAS.POPS_HIST).appendRow(linhaHist);

    return { ok: true, codigo_pop: dados.codigo_pop, versao: novaVersao, id_versao: idVersao };
  } finally {
    lock.releaseLock();
  }
}

/** Passo 7: SST/Admin revisa e efetiva a versão que nasceu EM_REVISAO. */
function api_AprovarVersaoPOP(codigoPop, matriculaSolicitante) {
  const solicitante = _exigirAcesso(matriculaSolicitante, {
    perfis: CFG.PERFIS_INVESTIGACAO, contexto: 'APROVACAO_POP'
  });

  const cp = CFG_RCA.COL_POPS;
  const popRow = _buscarLinha(CFG_RCA.ABAS.POPS, cp.codigo_pop, codigoPop);
  if (!popRow) return { ok: false, erro: 'POP não encontrado.' };

  if (String(popRow.dados[cp.status_vigencia - 1]).toUpperCase() !== 'EM_REVISAO') {
    return { ok: false, erro: 'Este POP não está aguardando revisão.' };
  }

  _aba(CFG_RCA.ABAS.POPS).getRange(popRow.linha, cp.status_vigencia).setValue('VIGENTE');

  _gravarLogSemTrava({
    matricula_usuario: solicitante.matricula, perfil_rbac_no_momento: solicitante.perfil_rbac,
    nivel_hierarquico_no_momento: solicitante.nivel_hierarquico,
    acao_realizada: 'VERSIONAMENTO_POP', tabela_afetada: CFG_RCA.ABAS.POPS,
    id_registro_afetado: codigoPop, origem_acao: 'WEB_DESKTOP', resultado: 'SUCESSO',
    criticidade: 'INFO', justificativa: 'Versão aprovada e efetivada como VIGENTE'
  });

  return { ok: true, codigo_pop: codigoPop, status_vigencia: 'VIGENTE' };
}


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 7 · PASSOS 9–10 — MATRIZ DE RECICLAGEM
   Gera obrigação de treinamento. Enquanto pendente, PODE bloquear atividade
   (Dossiê 4.7) — a decisão de travar fica marcada no próprio registro.
═══════════════════════════════════════════════════════════════════════════ */

function api_GerarReciclagem(dados, matriculaSolicitante) {
  const solicitante = _exigirAcesso(matriculaSolicitante, {
    perfis: CFG.PERFIS_INVESTIGACAO, contexto: 'GERACAO_RECICLAGEM'
  });

  if (!dados.codigo_pop || !dados.id_funcao) {
    return { ok: false, erro: 'codigo_pop e id_funcao são obrigatórios.' };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(CFG.TIMEOUT_LOCK);
  try {
    const sh = _aba(CFG_RCA.ABAS.RECICLAGEM);
    const seq = sh.getLastRow();
    const agora = new Date();
    const prazo = new Date(agora.getTime() +
      (Number(dados.prazo_dias) || CFG_RCA.PRAZO_RECICLAGEM_DIAS) * 86400000);

    const c = CFG_RCA.COL_RECICLAGEM;
    const idReciclagem = 'REC-' + ('0000' + seq).slice(-4);
    const linha = [];
    linha[c.id_reciclagem - 1] = idReciclagem;
    linha[c.codigo_pop - 1] = dados.codigo_pop;
    linha[c.id_funcao - 1] = dados.id_funcao;
    linha[c.data_geracao - 1] = agora;
    linha[c.prazo_limite - 1] = prazo;
    linha[c.status - 1] = dados.bloqueia_atividade ? 'BLOQUEIA_ATIVIDADE' : 'PENDENTE';
    linha[c.id_rca_origem - 1] = dados.id_rca_origem || '';

    sh.appendRow(linha);
    _invalidarCacheGeral();

    _gravarLogSemTrava({
      matricula_usuario: solicitante.matricula, perfil_rbac_no_momento: solicitante.perfil_rbac,
      nivel_hierarquico_no_momento: solicitante.nivel_hierarquico,
      acao_realizada: 'ALTERACAO', tabela_afetada: CFG_RCA.ABAS.RECICLAGEM,
      id_registro_afetado: idReciclagem, origem_acao: 'WEB_DESKTOP', resultado: 'SUCESSO',
      criticidade: dados.bloqueia_atividade ? 'CRITICO' : 'AVISO',
      justificativa: 'Reciclagem obrigatória de ' + dados.codigo_pop +
                     ' para a função ' + dados.id_funcao + '. Prazo: ' + _formatarData(prazo)
    });

    return { ok: true, id_reciclagem: idReciclagem, prazo_limite: _formatarData(prazo) };
  } finally {
    lock.releaseLock();
  }
}

/**
 * INTEGRAÇÃO COM O MOTOR DE CONFORMIDADE:
 * chame esta função de dentro de validarColaborador() (Code_v2.gs) se
 * quiser que reciclagem BLOQUEIA_ATIVIDADE realmente barre o totem.
 * Isolada aqui para você decidir quando ligar o fio — é uma trava nova
 * que passa a valer para toda a função, não só para quem causou o incidente.
 */
function _verificarReciclagensPendentes(idFuncao) {
  const c = CFG_RCA.COL_RECICLAGEM;
  const pendentes = _lerTudo(CFG_RCA.ABAS.RECICLAGEM).filter(function (r) {
    return String(r[c.id_funcao - 1]) === String(idFuncao) &&
           String(r[c.status - 1]).toUpperCase() === 'BLOQUEIA_ATIVIDADE';
  });
  return pendentes.map(function (r) {
    return {
      id_reciclagem: r[c.id_reciclagem - 1],
      codigo_pop: r[c.codigo_pop - 1],
      prazo_limite: r[c.prazo_limite - 1]
    };
  });
}


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 8 · PASSO 12 — ENCERRAMENTO AUDITÁVEL
═══════════════════════════════════════════════════════════════════════════ */

function api_EncerrarRCA(idRca, conclusao, matriculaSolicitante) {
  const solicitante = _exigirAcesso(matriculaSolicitante, {
    perfis: CFG.PERFIS_INVESTIGACAO, contexto: 'ENCERRAMENTO_RCA'
  });

  if (!conclusao || String(conclusao).trim().length < 20) {
    return { ok: false, erro: 'Conclusão obrigatória (mínimo 20 caracteres).' };
  }

  const r = _buscarLinha(CFG_RCA.ABAS.RCA, CFG_RCA.COL_RCA.id_rca, idRca);
  if (!r) return { ok: false, erro: 'RCA não encontrada.' };

  const c = CFG_RCA.COL_RCA;
  if (!r.dados[c.categoria_causa - 1]) {
    return { ok: false, erro: 'Defina a categoria_causa antes de encerrar.' };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(CFG.TIMEOUT_LOCK);
  try {
    const sh = _aba(CFG_RCA.ABAS.RCA);
    const agora = new Date();
    sh.getRange(r.linha, c.status).setValue('CONCLUIDA');
    sh.getRange(r.linha, c.encerrado_por).setValue(solicitante.matricula);
    sh.getRange(r.linha, c.data_encerramento).setValue(agora);
    sh.getRange(r.linha, c.conclusao).setValue(conclusao);

    // Fecha o incidente em cadeia
    const idIncidente = r.dados[c.id_incidente - 1];
    const incRow = _buscarLinha(CFG_RCA.ABAS.INCIDENTES, CFG_RCA.COL_INCIDENTES.id_incidente, idIncidente);
    if (incRow) {
      _aba(CFG_RCA.ABAS.INCIDENTES)
        .getRange(incRow.linha, CFG_RCA.COL_INCIDENTES.status).setValue('CONCLUIDO');
    }

    _gravarLogSemTrava({
      matricula_usuario: solicitante.matricula, perfil_rbac_no_momento: solicitante.perfil_rbac,
      nivel_hierarquico_no_momento: solicitante.nivel_hierarquico,
      acao_realizada: 'ENCERRAMENTO_RCA', tabela_afetada: CFG_RCA.ABAS.RCA,
      id_registro_afetado: idRca, origem_acao: 'WEB_DESKTOP', resultado: 'SUCESSO',
      criticidade: 'INFO', justificativa: conclusao
    });

    return { ok: true, id_rca: idRca, status: 'CONCLUIDA' };
  } finally {
    lock.releaseLock();
  }
}


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 9 · CONSULTA — GESTOR VÊ RESUMO, NÃO EDITA (Matriz RBAC 6.4)
   Gestor recebe versão enxuta: sem depoimentos nominais, só o essencial
   para redistribuir carga e acompanhar prazo de reciclagem do setor.
═══════════════════════════════════════════════════════════════════════════ */

function api_ConsultarRCASetor(matriculaSolicitante) {
  const u = _exigirAcesso(matriculaSolicitante, {
    perfis: CFG.PERFIS_SENSIVEIS, nivelMinimo: 'GESTOR', contexto: 'CONSULTA_RCA_SETOR'
  });

  const escopo = _resolverEscopo(u);
  const ci = CFG_RCA.COL_INCIDENTES;
  const cr = CFG_RCA.COL_RCA;

  const incidentesDoSetor = _lerTudo(CFG_RCA.ABAS.INCIDENTES).filter(function (i) {
    return escopo.ids_setores.indexOf(String(i[ci.id_setor - 1])) !== -1;
  });

  const rcas = _lerTudo(CFG_RCA.ABAS.RCA);
  const veTudo = (u.perfil_rbac === 'SST' || u.perfil_rbac === 'ADMIN');

  const resumo = incidentesDoSetor.map(function (inc) {
    const idRca = inc[ci.id_rca - 1];
    const rcaLinha = idRca ? rcas.filter(function (r) { return r[cr.id_rca - 1] === idRca; })[0] : null;

    const base = {
      id_incidente: inc[ci.id_incidente - 1],
      data_hora: inc[ci.data_hora - 1],
      tipo_evento: inc[ci.tipo_evento - 1],
      gravidade: inc[ci.gravidade - 1],
      status: inc[ci.status - 1]
    };

    // Gestor (perfil GESTOR puro) vê só o essencial. SST/ADMIN vê a causa raiz.
    if (rcaLinha && veTudo) {
      base.categoria_causa = rcaLinha[cr.categoria_causa - 1];
      base.status_rca = rcaLinha[cr.status - 1];
      base.necessidade_reciclagem = rcaLinha[cr.necessidade_reciclagem - 1];
    } else if (rcaLinha) {
      base.status_rca = rcaLinha[cr.status - 1];
    }

    return base;
  });

  return { setores: escopo.setores.map(function (s) { return s.nome_setor; }), incidentes: resumo };
}
