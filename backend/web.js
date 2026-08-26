/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EHS SMART ENTERPRISE · web.js — v2.1
 * Publicação Web (doGet/doPost) e APIs do Dashboard Executivo.
 * ═══════════════════════════════════════════════════════════════════════════
 */

function doGet(e) {
  const params = (e && e.parameter) || {};
  const tela = params.tela || 'index';

  if (tela === 'totem') {
    const idTotem = params.id || params.totem || '';
    if (!_totemAutorizado(idTotem, params.token || '')) {
      return HtmlService.createHtmlOutput(
        '<div style="font:600 18px system-ui;padding:48px;text-align:center;color:#7a1210">' +
        'Dispositivo não autorizado.<br>' +
        '<span style="font-weight:400;font-size:14px;color:#666">' +
        'Solicite ao SST a URL correta deste totem.</span></div>'
      ).setTitle('EHS — Acesso negado');
    }

    return HtmlService.createTemplateFromFile('Totem')
      .evaluate()
      .setTitle('EHS — Totem de Validação')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.SAMEORIGIN);
  }

  if (tela === 'rca') {
    return HtmlService.createTemplateFromFile('RCA_Incidentes')
      .evaluate()
      .setTitle('EHS — RCA / Incidentes')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.SAMEORIGIN);
  }

  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('EHS Smart Enterprise — Painel Corporativo')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.SAMEORIGIN);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(CFG.TIMEOUT_LOCK);
  try {
    const payload = _parsePostPayload(e);
    if (!payload) {
      return _jsonResponse(401, { erro: 'Payload inválido ou ausente.' });
    }

    const idTotem = payload.idTotem || '';
    const token = payload.token || '';
    if (!_totemAutorizado(idTotem, token)) {
      return _jsonResponse(403, { erro: 'Totem não autorizado.' });
    }

    if (!_totemDentroDoLimite(idTotem)) {
      return _jsonResponse(429, { status: 'BLOQUEADO', motivos: ['Muitas requisições. Aguarde.'] });
    }

    if (payload.acao === 'validar' && payload.matricula) {
      const resultado = api_ValidarTotem(payload.matricula, idTotem);
      return _jsonResponse(200, resultado);
    }

    if (payload.acao === 'confirmar' && payload.matricula && payload.codigo_epi) {
      const resultado = api_RegistrarEntregaEPI(payload.matricula, {
        codigo_epi: payload.codigo_epi,
        id_totem: idTotem,
        metodo_confirmacao: payload.metodo_confirmacao || 'CRACHA_RFID',
        quantidade: 1
      });
      return _jsonResponse(200, resultado);
    }

    return _jsonResponse(400, { erro: 'Ação não reconhecida.' });
  } catch (erro) {
    _gravarLogSemTrava({
      matricula_usuario: 'SISTEMA', perfil_rbac_no_momento: 'SISTEMA',
      nivel_hierarquico_no_momento: 'MASTER_ADMIN', acao_realizada: 'ERRO_DOPOST',
      tabela_afetada: 'web', id_registro_afetado: idTotem || 'DESCONHECIDO',
      origem_acao: 'TOTEM', resultado: 'ERRO', criticidade: 'CRITICO',
      justificativa: 'Erro interno no processamento do webhook.'
    });
    const DEBUG = false;
    return _jsonResponse(500, {
      erro: 'Erro interno.',
      ...(DEBUG ? { detalhe: erro.message, stack: erro.stack } : {})
    });
  } finally {
    lock.releaseLock();
  }
}

function _parsePostPayload(e) {
  try {
    if (e && e.postData && e.postData.type && e.postData.type.indexOf('application/json') !== -1) {
      return JSON.parse(e.postData.contents);
    }
  } catch (erro) {}
  return null;
}

function _jsonResponse(statusCode, obj) {
  const output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  output.setHttpStatusCode(statusCode);
  return output;
}

function _criptografarToken(token) {
  const segredo = CFG.TOTEM_CRIPTOGRAFIA_SEGredo || 'EHS_TOTEM_SECRET_V2';
  const bytes = Utilities.computeHmacSha256(token, segredo);
  return bytes.map(function (b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

function _totemDentroDoLimite(idTotem) {
  const cache = CacheService.getScriptCache();
  const chave = 'rate_limit_' + idTotem;
  const count = parseInt(cache.get(chave) || '0', 10);
  if (count >= CFG_TOTEM.LIMITE_POR_MIN) return false;
  cache.put(chave, String(count + 1), CFG_TOTEM.JANELA_SEG);
  return true;
}

function _totemAutorizado(idTotem, token) {
  if (!idTotem || !token) return false;

  const bruto = PropertiesService.getScriptProperties().getProperty(CFG_TOTEM.CHAVE_PROPS);
  if (!bruto) return false;

  let mapa;
  try { mapa = JSON.parse(bruto); } catch (_) { return false; }

  const entrada = mapa[idTotem];
  if (!entrada) return false;

  if (entrada.expira_em && new Date(entrada.expira_em) < new Date()) {
    return false;
  }

  return entrada.token === _criptografarToken(token);
}

function api_GerarTokenTotem(idTotem, diasValidade) {
  diasValidade = diasValidade || 90;
  const bruto = PropertiesService.getScriptProperties().getProperty(CFG_TOTEM.CHAVE_PROPS);
  let mapa = {};
  try { mapa = JSON.parse(bruto) || {}; } catch (_) {}

  if (!idTotem) return { ok: false, erro: 'idTotem obrigatório.' };

  const token = Utilities.getUuid().replace(/-/g, '').substring(0, 32);
  const tokenCriptografado = _criptografarToken(token);
  const expiraEm = new Date();
  expiraEm.setDate(expiraEm.getDate() + diasValidade);

  mapa[idTotem] = {
    token: tokenCriptografado,
    criado_em: new Date().toISOString(),
    expira_em: expiraEm.toISOString(),
    rotacao_automatica: true
  };

  PropertiesService.getScriptProperties().setProperty(CFG_TOTEM.CHAVE_PROPS, JSON.stringify(mapa));

  return {
    ok: true,
    idTotem: idTotem,
    token: token,
    expira_em: expiraEm.toISOString(),
    url: ScriptApp.getService().getUrl() + '?tela=totem&id=' + encodeURIComponent(idTotem) + '&token=' + token
  };
}

function api_ListarTokensTotem() {
  const bruto = PropertiesService.getScriptProperties().getProperty(CFG_TOTEM.CHAVE_PROPS);
  let mapa = {};
  try { mapa = JSON.parse(bruto) || {}; } catch (_) {}

  const lista = [];
  const agora = new Date();
  for (const id in mapa) {
    const entrada = mapa[id];
    lista.push({
      idTotem: id,
      criado_em: entrada.criado_em,
      expira_em: entrada.expira_em,
      expirado: entrada.expira_em ? new Date(entrada.expira_em) < agora : false,
      rotacao_automatica: entrada.rotacao_automatica || false
    });
  }
  return lista;
}

function incluir(nomeArquivo) {
  return HtmlService.createHtmlOutputFromFile(nomeArquivo).getContent();
}

function api_RegistrarAcaoPreventiva(idFuncionario, params) {
  params = params || {};
  const lock = LockService.getScriptLock();
  lock.waitLock(CFG.TIMEOUT_LOCK);

  try {
    const solicitante = _resolverSolicitante(params);
    if (!solicitante.ok) return solicitante.resposta;

    const u = solicitante.usuario;

    if (CFG.PERFIS_SENSIVEIS.indexOf(u.perfil_rbac) === -1) {
      _gravarLogSemTrava({
        matricula_usuario: u.matricula, perfil_rbac_no_momento: u.perfil_rbac,
        nivel_hierarquico_no_momento: u.nivel_hierarquico,
        acao_realizada: 'REGISTRO_ACAO_PREVENTIVA',
        tabela_afetada: CFG.ABAS.ACOES_PREVENTIVAS,
        id_registro_afetado: idFuncionario, origem_acao: solicitante.origem,
        resultado: 'NEGADO_RBAC', criticidade: 'AVISO',
        justificativa: 'Perfil ' + u.perfil_rbac + ' sem permissão para registrar ação preventiva'
      });
      return { ok: false, erro: 'Perfil sem permissão para registrar ação preventiva.' };
    }

    const alvo = _obterUsuario(idFuncionario);
    if (!alvo) {
      _gravarLogSemTrava({
        matricula_usuario: u.matricula, perfil_rbac_no_momento: u.perfil_rbac,
        nivel_hierarquico_no_momento: u.nivel_hierarquico,
        acao_realizada: 'REGISTRO_ACAO_PREVENTIVA',
        tabela_afetada: CFG.ABAS.FUNCIONARIOS, id_registro_afetado: idFuncionario,
        origem_acao: solicitante.origem, resultado: 'NEGADO_REGRA', criticidade: 'AVISO',
        justificativa: 'Alvo não cadastrado: ' + idFuncionario
      });
      return { ok: false, erro: 'Funcionário-alvo não cadastrado.' };
    }
    if (String(alvo.status_efetivo).toUpperCase() !== 'ATIVO') {
      return { ok: false, erro: 'Funcionário-alvo com status ' + alvo.status_efetivo + '.' };
    }

    const escopo = _resolverEscopo(u);
    const idsSetores = escopo.ids_setores;
    if (escopo.tipo === 'SETORIAL' && idsSetores.indexOf(String(alvo.setor)) === -1) {
      _gravarLogSemTrava({
        matricula_usuario: u.matricula, perfil_rbac_no_momento: u.perfil_rbac,
        nivel_hierarquico_no_momento: u.nivel_hierarquico,
        acao_realizada: 'REGISTRO_ACAO_PREVENTIVA',
        tabela_afetada: CFG.ABAS.ACOES_PREVENTIVAS, id_registro_afetado: idFuncionario,
        origem_acao: solicitante.origem, resultado: 'NEGADO_RBAC', criticidade: 'AVISO',
        justificativa: 'Alvo fora do escopo setorial do solicitante'
      });
      return { ok: false, erro: 'Funcionário fora do seu escopo de gestão.' };
    }

    const sh = _aba(CFG.ABAS.ACOES_PREVENTIVAS);
    const agora = new Date();
    const seq = sh.getLastRow();
    const idAcao = 'AP-' +
      Utilities.formatDate(agora, Session.getScriptTimeZone(), 'yyyyMMdd') + '-' +
      ('0000' + seq).slice(-4);

    const cap = CFG.COL_ACOES_PREVENTIVAS;
    const idLog = _gravarLogSemTrava({
      matricula_usuario: u.matricula, perfil_rbac_no_momento: u.perfil_rbac,
      nivel_hierarquico_no_momento: u.nivel_hierarquico,
      acao_realizada: 'REGISTRO_ACAO_PREVENTIVA',
      tabela_afetada: CFG.ABAS.ACOES_PREVENTIVAS, id_registro_afetado: idAcao,
      origem_acao: solicitante.origem, resultado: 'SUCESSO', criticidade: 'INFO',
      valor_novo: JSON.stringify({
        alvo_matricula: alvo.matricula, alerta: params.alerta || '',
        recomendacao: params.recomendacao || ''
      })
    });

    const linha = [];
    linha[cap.id_acao - 1] = idAcao;
    linha[cap.timestamp - 1] = agora;
    linha[cap.matricula_alvo - 1] = alvo.matricula;
    linha[cap.nome_alvo_snapshot - 1] = alvo.nome_completo;
    linha[cap.matricula_solicitante - 1] = u.matricula;
    linha[cap.perfil_rbac_solicitante - 1] = u.perfil_rbac;
    linha[cap.nivel_hierarquico_solicitante - 1] = u.nivel_hierarquico;
    linha[cap.origem_identificacao - 1] = solicitante.origem;
    linha[cap.alerta_disparo - 1] = params.alerta || '';
    linha[cap.recomendacao_registrada - 1] = params.recomendacao || '';
    linha[cap.status_acao - 1] = 'REGISTRADA';
    linha[cap.observacoes - 1] = params.observacoes || '';
    linha[cap.id_log - 1] = idLog;

    for (let i = 0; i < cap.id_log; i++) if (linha[i] === undefined) linha[i] = '';
    sh.appendRow(linha);

    return {
      ok: true,
      id_acao: idAcao,
      id_log: idLog,
      matricula_alvo: alvo.matricula,
      nome_alvo: alvo.nome_completo,
      status: 'REGISTRADA',
      identificacao_origem: solicitante.origem
    };

  } finally {
    lock.releaseLock();
  }
}

function util_SetupCabecalhosPrevencao() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG.ABAS.ACOES_PREVENTIVAS);
  if (!sh) {
    return { ok: false, erro: 'Aba "' + CFG.ABAS.ACOES_PREVENTIVAS + '" não encontrada. Crie a aba antes de rodar.' };
  }

  const cap = CFG.COL_ACOES_PREVENTIVAS;
  const cabecalhos = new Array(14);

  cabecalhos[cap.id_acao - 1] = 'id_acao';
  cabecalhos[cap.timestamp - 1] = 'timestamp';
  cabecalhos[cap.matricula_alvo - 1] = 'matricula_alvo';
  cabecalhos[cap.nome_alvo_snapshot - 1] = 'nome_alvo_snapshot';
  cabecalhos[cap.matricula_solicitante - 1] = 'matricula_solicitante';
  cabecalhos[cap.perfil_rbac_solicitante - 1] = 'perfil_rbac_solicitante';
  cabecalhos[cap.nivel_hierarquico_solicitante - 1] = 'nivel_hierarquico_solicitante';
  cabecalhos[cap.origem_identificacao - 1] = 'origem_identificacao';
  cabecalhos[cap.alerta_disparo - 1] = 'alerta_disparo';
  cabecalhos[cap.recomendacao_registrada - 1] = 'recomendacao_registrada';
  cabecalhos[cap.status_acao - 1] = 'status_acao';
  cabecalhos[cap.data_conclusao - 1] = 'data_conclusao';
  cabecalhos[cap.observacoes - 1] = 'observacoes';
  cabecalhos[cap.id_log - 1] = 'id_log';

  sh.getRange(1, 1, 1, cabecalhos.length).setValues([cabecalhos]).setFontWeight('bold').setBackground('#f3f4f6');
  sh.setFrozenRows(1);

  return { ok: true, cabecalhos: cabecalhos };
}

/**
 * Health check simples do sistema.
 * Útil para o frontend validar conexão antes de carregar o painel.
 */
function api_HealthCheck() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const planilhaOk = !!ss;
    const props = PropertiesService.getScriptProperties();
    const propsOk = !!props;

    let usuarios = 0;
    try { usuarios = _lerTudo(CFG.ABAS.FUNCIONARIOS).length; } catch (e) {}

    return {
      ok: true,
      status: 'HEALTHY',
      timestamp: new Date().toISOString(),
      ambiente: {
        planilha: planilhaOk,
        properties: propsOk,
        total_funcionarios_cache: usuarios
      }
    };
  } catch (e) {
    return {
      ok: false,
      status: 'UNHEALTHY',
      timestamp: new Date().toISOString(),
      erro: e.message
    };
  }
}
