/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EHS SMART ENTERPRISE · web.js — v2.0
 * Publicação Web (doGet) e APIs do Dashboard Executivo.
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
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('EHS Smart Enterprise — Painel Corporativo')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function _totemAutorizado(idTotem, token) {
  if (!idTotem || !token) return false;

  const bruto = PropertiesService.getScriptProperties().getProperty(CFG_TOTEM.CHAVE_PROPS);
  if (!bruto) return false;

  let mapa;
  try { mapa = JSON.parse(bruto); } catch (_) { return false; }

  const esperado = mapa[idTotem];
  return !!esperado && esperado === token;
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
