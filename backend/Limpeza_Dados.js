/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EHS SMART ENTERPRISE · Limpeza_Dados.js — v2.1
 * Scripts de sanitização e correção de dados na planilha.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const CFG_LIMPEZA = {
  ABAS: {
    MOVIMENTACOES: 'Movimentacoes_Trocas',
    FUNCIONARIOS: 'Funcionarios',
    EQUIPAMENTOS: 'Equipamentos_EPI_EPC'
  },
  VALORES_MOCK: ['TOTEM-MOCK', 'TOTEM-MOCK-01', 'TOTEM-MOCK-02'],
  RESPONSAVEL_MOCK: ['1000', 'SISTEMA', 'MOCK']
};

/**
 * Remove ou marca registros com valores mockados.
 * Estratégia: marca como 'ANOMALO' ao invés de deletar (append-only).
 */
function sanitizarMovimentacoesMock() {
  const lock = LockService.getScriptLock();
  lock.waitLock(CFG.TIMEOUT_LOCK);

  try {
    const cm = CFG.COL_MOVIMENTACOES;
    const sh = _aba(CFG_LIMPEZA.ABAS.MOVIMENTACOES);
    const dados = _lerTudo(CFG_LIMPEZA.ABAS.MOVIMENTACOES);
    const agora = new Date();
    const marcados = [];

    dados.forEach(function (linha, i) {
      const idMov = String(linha[cm.id_movimentacao - 1] || '');
      const idTotem = String(linha[cm.id_totem - 1] || '');
      const respAlmox = String(linha[cm.responsavel_almox - 1] || '');

      const isMock = CFG_LIMPEZA.VALORES_MOCK.indexOf(idTotem) !== -1 ||
                     CFG_LIMPEZA.RESPONSAVEL_MOCK.indexOf(respAlmox) !== -1;

      if (!isMock) return;

      const motivo = 'ANOMALO_MOCK';
      linha[cm.status_confirmacao_totem - 1] = 'ANOMALO';
      linha[cm.observacao - 1] = (linha[cm.observacao - 1] ? linha[cm.observacao - 1] + ' | ' : '') +
                                   'Sanitizado em ' + Utilities.formatDate(agora, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') +
                                   ' — valor mockado detectado: totem=' + idTotem + ', resp=' + respAlmox;

      registrarLog({
        matricula_usuario: 'SISTEMA', perfil_rbac_no_momento: 'SISTEMA',
        nivel_hierarquico_no_momento: 'SISTEMA',
        acao_realizada: 'SANITIZACAO_MOCK', tabela_afetada: CFG_LIMPEZA.ABAS.MOVIMENTACOES,
        id_registro_afetado: idMov, origem_acao: 'ROTINA_AUTOMATICA',
        id_dispositivo: 'SERVIDOR', resultado: 'SUCESSO', criticidade: 'AVISO',
        justificativa: 'Registro mockado sanitizado: ' + idTotem + ' / ' + respAlmox
      });

      marcados.push({ linha: i + 2, id_movimentacao: idMov });
    });

    if (marcados.length > 0) {
      const ultima = sh.getLastRow();
      const totalCol = sh.getLastColumn();
      const bloco = ultima >= 2 ? sh.getRange(2, 1, ultima - 1, totalCol).getValues() : [];
      marcados.forEach(function (item) {
        const idx = item.linha - 2;
        if (idx >= 0 && idx < bloco.length) {
          bloco[idx][cm.status_confirmacao_totem - 1] = 'ANOMALO';
        }
      });
      sh.getRange(2, 1, bloco.length, totalCol).setValues(bloco);
    }

    return { ok: true, registros_sanitizados: marcados.length };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Detecta PKs duplicadas em Movimentacoes_Trocas.
 * Não remove — apenas reporta para correção manual via estorno.
 */
function detectarPksDuplicadas() {
  const cm = CFG.COL_MOVIMENTACOES;
  const dados = _lerTudo(CFG_LIMPEZA.ABAS.MOVIMENTACOES);
  const mapa = {};
  const duplicados = [];

  dados.forEach(function (linha, i) {
    const pk = String(linha[cm.id_movimentacao - 1] || '').trim();
    if (!pk) return;
    if (!mapa[pk]) mapa[pk] = [];
    mapa[pk].push({ linha: i + 2, matricula: linha[cm.matricula - 1], data: linha[cm.data_hora - 1] });
  });

  Object.keys(mapa).forEach(function (pk) {
    if (mapa[pk].length > 1) {
      duplicados.push({ id_movimentacao: pk, ocorrencias: mapa[pk].length, linhas: mapa[pk] });
    }
  });

  if (duplicados.length > 0) {
    registrarLog({
      matricula_usuario: 'SISTEMA', perfil_rbac_no_momento: 'SISTEMA',
      nivel_hierarquico_no_momento: 'SISTEMA',
      acao_realizada: 'DETECCAO_PK_DUPLICADA', tabela_afetada: CFG_LIMPEZA.ABAS.MOVIMENTACOES,
      id_registro_afetado: 'MULTIPLOS', origem_acao: 'ROTINA_AUTOMATICA',
      id_dispositivo: 'SERVIDOR', resultado: 'ERRO', criticidade: 'CRITICO',
      justificativa: duplicados.length + ' PKs duplicadas encontradas. Primeira: ' + duplicados[0].id_movimentacao
    });
  }

  return { total_duplicados: duplicados.length, detalhes: duplicados.slice(0, 10) };
}

/**
 * Relatório de saúde da planilha — pré-requisito para homologação.
 */
function relatorioSanidadePlanilha() {
  const r = { abas: {}, movimentacoes: {}, funcionarios: {}, equipamentos: {}, duplicados: {}, mock: {} };

  r.movimentacoes.total = _lerTudo(CFG_LIMPEZA.ABAS.MOVIMENTACOES).length;
  r.funcionarios.total = _lerTudo(CFG_LIMPEZA.ABAS.FUNCIONARIOS).length;
  r.equipamentos.total = _lerTudo(CFG_LIMPEZA.ABAS.EQUIPAMENTOS).length;

  const dup = detectarPksDuplicadas();
  r.duplicados = dup;

  const mock = sanitizarMovimentacoesMock();
  r.mock = mock;

  r.abas.total_abas = SpreadsheetApp.getActiveSpreadsheet().getSheets().length;
  r.abas.nomes = SpreadsheetApp.getActiveSpreadsheet().getSheets().map(function (s) { return s.getName(); });

  const integridade = verificarIntegridadeLog();
  r.auditoria = integridade;

  Logger.log(JSON.stringify(r, null, 2));
  return r;
}
