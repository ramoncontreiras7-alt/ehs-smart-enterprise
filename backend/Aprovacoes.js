/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EHS SMART ENTERPRISE · Aprovacoes.js — v2.1
 * Módulo formal de aprovação para ações críticas.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const CFG_APROVACOES = {
  ABA: 'Aprovacoes',
  COL: {
    id_aprovacao: 1,
    timestamp: 2,
    acao: 3,
    contexto: 4,
    solicitante: 5,
    perfil_solicitante: 6,
    nivel_solicitante: 7,
    status: 8,
    aprovador: 9,
    data_aprovacao: 10,
    token_confirmacao: 11,
    tentativas: 12,
    justificativa: 13,
    detalhes: 14
  },
  STATUS: {
    PENDENTE: 'PENDENTE',
    APROVADA: 'APROVADA',
    REJEITADA: 'REJEITADA',
    EXPIRADA: 'EXPIRADA',
    CANCELADA: 'CANCELADA'
  },
  ACOES: {
    MIGRACAO_COMPLETA: 'MIGRACAO_COMPLETA',
    DEPLOY_PRODUCAO: 'DEPLOY_PRODUCAO',
    EXCLUSAO_DADOS: 'EXCLUSAO_DADOS',
    ALTERACAO_RBAC: 'ALTERACAO_RBAC',
    EXECUCAO_SCRIPT: 'EXECUCAO_SCRIPT'
  },
  PERFIS_APROVADORES: {
    MIGRACAO_COMPLETA: ['MASTER_ADMIN'],
    DEPLOY_PRODUCAO: ['MASTER_ADMIN', 'ADMIN'],
    EXCLUSAO_DADOS: ['MASTER_ADMIN'],
    ALTERACAO_RBAC: ['MASTER_ADMIN'],
    EXECUCAO_SCRIPT: ['MASTER_ADMIN', 'ADMIN']
  },
  TIMEOUT_HORAS: 24,
  MAX_TENTATIVAS: 3
};

/**
 * Cria uma solicitação de aprovação.
 */
function api_CriarAprovacao(acao, contexto, detalhes, matriculaSolicitante) {
  const solicitante = _obterUsuario(matriculaSolicitante);
  if (!solicitante) return { ok: false, erro: 'Usuário não identificado.' };

  const perfisAprovadores = CFG_APROVACOES.PERFIS_APROVADORES[acao] || [];
  if (perfisAprovadores.length === 0) {
    return { ok: false, erro: 'Ação não requer aprovação formal.' };
  }

  const tokenConfirmacao = Utilities.getUuid().replace(/-/g, '').substring(0, 16);
  const prazo = new Date();
  prazo.setHours(prazo.getHours() + CFG_APROVACOES.TIMEOUT_HORAS);

  const sh = _aba(CFG_APROVACOES.ABA);
  const seq = sh.getLastRow();
  const idAprovacao = 'APR-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd') + '-' + ('0000' + seq).slice(-4);

  const c = CFG_APROVACOES.COL;
  const linha = [];
  linha[c.id_aprovacao - 1] = idAprovacao;
  linha[c.timestamp - 1] = new Date();
  linha[c.acao - 1] = acao;
  linha[c.contexto - 1] = contexto || '';
  linha[c.solicitante - 1] = solicitante.matricula;
  linha[c.perfil_solicitante - 1] = solicitante.perfil_rbac;
  linha[c.nivel_solicitante - 1] = solicitante.nivel_hierarquico;
  linha[c.status - 1] = CFG_APROVACOES.STATUS.PENDENTE;
  linha[c.aprovador - 1] = '';
  linha[c.data_aprovacao - 1] = '';
  linha[c.token_confirmacao - 1] = tokenConfirmacao;
  linha[c.tentativas - 1] = 0;
  linha[c.justificativa - 1] = '';
  linha[c.detalhes - 1] = JSON.stringify(detalhes || {});

  sh.appendRow(linha);

  registrarLog({
    matricula_usuario: solicitante.matricula,
    perfil_rbac_no_momento: solicitante.perfil_rbac,
    nivel_hierarquico_no_momento: solicitante.nivel_hierarquico,
    acao_realizada: 'CRIACAO_APROVACAO',
    tabela_afetada: CFG_APROVACOES.ABA,
    id_registro_afetado: idAprovacao,
    origem_acao: 'WEB_DESKTOP',
    resultado: 'SUCESSO',
    criticidade: 'AVISO',
    valor_novo: JSON.stringify({ acao: acao, contexto: contexto })
  });

  return {
    ok: true,
    id_aprovacao: idAprovacao,
    status: CFG_APROVACOES.STATUS.PENDENTE,
    token_confirmacao: tokenConfirmacao,
    prazo_expiracao: prazo.toISOString(),
    perfis_aprovadores: perfisAprovadores
  };
}

/**
 * Aprova uma solicitação.
 */
function api_AprovarSolicitacao(idAprovacao, tokenConfirmacao, matriculaAprovador) {
  const aprovador = _exigirAcesso(matriculaAprovador, {
    perfis: ['ADMIN', 'SST'],
    nivelMinimo: 'GESTOR',
    contexto: 'APROVACAO'
  });

  const sh = _aba(CFG_APROVACOES.ABA);
  const linha = _buscarLinha(CFG_APROVACOES.ABA, CFG_APROVACOES.COL.id_aprovacao, idAprovacao);
  if (!linha) return { ok: false, erro: 'Aprovação não encontrada.' };

  const c = CFG_APROVACOES.COL;
  const dados = linha.dados;
  if (String(dados[c.status - 1]).toUpperCase() !== CFG_APROVACOES.STATUS.PENDENTE) {
    return { ok: false, erro: 'Aprovação não está pendente.' };
  }
  if (String(dados[c.token_confirmacao - 1]) !== String(tokenConfirmacao)) {
    return { ok: false, erro: 'Token de confirmação inválido.' };
  }

  const agora = new Date();
  sh.getRange(linha.linha, c.status).setValue(CFG_APROVACOES.STATUS.APROVADA);
  sh.getRange(linha.linha, c.aprovador).setValue(aprovador.matricula);
  sh.getRange(linha.linha, c.data_aprovacao).setValue(agora);
  sh.getRange(linha.linha, c.tentativas).setValue((Number(dados[c.tentativas - 1]) || 0) + 1);

  registrarLog({
    matricula_usuario: aprovador.matricula,
    perfil_rbac_no_momento: aprovador.perfil_rbac,
    nivel_hierarquico_no_momento: aprovador.nivel_hierarquico,
    acao_realizada: 'APROVACAO_CONCEDIDA',
    tabela_afetada: CFG_APROVACOES.ABA,
    id_registro_afetado: idAprovacao,
    origem_acao: 'WEB_DESKTOP',
    resultado: 'SUCESSO',
    criticidade: 'INFO',
    valor_novo: JSON.stringify({ aprovador: aprovador.matricula, acao: dados[c.acao - 1] })
  });

  return { ok: true, id_aprovacao: idAprovacao, status: CFG_APROVACOES.STATUS.APROVADA };
}

/**
 * Rejeita uma solicitação.
 */
function api_RejeitarSolicitacao(idAprovacao, matriculaAprovador, justificativa) {
  const aprovador = _exigirAcesso(matriculaAprovador, {
    perfis: ['ADMIN', 'SST'],
    nivelMinimo: 'GESTOR',
    contexto: 'REJEICAO_APROVACAO'
  });

  const linha = _buscarLinha(CFG_APROVACOES.ABA, CFG_APROVACOES.COL.id_aprovacao, idAprovacao);
  if (!linha) return { ok: false, erro: 'Aprovação não encontrada.' };

  const c = CFG_APROVACOES.COL;
  const dados = linha.dados;
  if (String(dados[c.status - 1]).toUpperCase() !== CFG_APROVACOES.STATUS.PENDENTE) {
    return { ok: false, erro: 'Aprovação não está pendente.' };
  }

  const sh = _aba(CFG_APROVACOES.ABA);
  const agora = new Date();
  sh.getRange(linha.linha, c.status).setValue(CFG_APROVACOES.STATUS.REJEITADA);
  sh.getRange(linha.linha, c.aprovador).setValue(aprovador.matricula);
  sh.getRange(linha.linha, c.data_aprovacao).setValue(agora);
  sh.getRange(linha.linha, c.justificativa).setValue(justificativa || '');
  sh.getRange(linha.linha, c.tentativas).setValue((Number(dados[c.tentativas - 1]) || 0) + 1);

  registrarLog({
    matricula_usuario: aprovador.matricula,
    perfil_rbac_no_momento: aprovador.perfil_rbac,
    nivel_hierarquico_no_momento: aprovador.nivel_hierarquico,
    acao_realizada: 'APROVACAO_REJEITADA',
    tabela_afetada: CFG_APROVACOES.ABA,
    id_registro_afetado: idAprovacao,
    origem_acao: 'WEB_DESKTOP',
    resultado: 'SUCESSO',
    criticidade: 'AVISO',
    valor_novo: JSON.stringify({ justificativa: justificativa || '' })
  });

  return { ok: true, id_aprovacao: idAprovacao, status: CFG_APROVACOES.STATUS.REJEITADA };
}

/**
 * Lista aprovações por status.
 */
function api_ListarAprovacoes(statusFiltro) {
  const c = CFG_APROVACOES.COL;
  const dados = _lerTudo(CFG_APROVACOES.ABA);
  return dados.map(function (linha) {
    return {
      id_aprovacao: linha[c.id_aprovacao - 1],
      timestamp: linha[c.timestamp - 1],
      acao: linha[c.acao - 1],
      contexto: linha[c.contexto - 1],
      solicitante: linha[c.solicitante - 1],
      status: linha[c.status - 1],
      aprovador: linha[c.aprovador - 1],
      data_aprovacao: linha[c.data_aprovacao - 1],
      tentativas: Number(linha[c.tentativas - 1]) || 0
    };
  }).filter(function (item) {
    if (!statusFiltro) return true;
    return String(item.status).toUpperCase() === String(statusFiltro).toUpperCase();
  }).sort(function (a, b) {
    return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
  });
}

/**
 * Executa uma ação protegida por aprovação.
 */
function executarComAprovacao(acao, contexto, funcaoExecucao, matriculaSolicitante) {
  const aprovacao = api_CriarAprovacao(acao, contexto, {}, matriculaSolicitante);
  if (!aprovacao.ok) return aprovacao;

  Logger.log('Aprovação criada: ' + aprovacao.id_aprovacao);
  Logger.log('Token de confirmação: ' + aprovacao.token_confirmacao);
  Logger.log('Perfis aprovadores: ' + aprovacao.perfis_aprovadores.join(', '));
  Logger.log('Prazo: ' + aprovacao.prazo_expiracao);

  return {
    ok: true,
    requer_aprovacao: true,
    id_aprovacao: aprovacao.id_aprovacao,
    token_confirmacao: aprovacao.token_confirmacao,
    prazo_expiracao: aprovacao.prazo_expiracao,
    perfis_aprovadores: aprovacao.perfis_aprovadores,
    proximo_passo: 'Um aprovador deve executar api_AprovarSolicitacao()'
  };
}
