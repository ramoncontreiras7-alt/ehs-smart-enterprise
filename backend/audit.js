/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EHS SMART ENTERPRISE · audit.js — v2.0
 * Auditoria imutável com corrente de hash SHA-256.
 * ═══════════════════════════════════════════════════════════════════════════
 */

function registrarLog(evento) {
  const lock = LockService.getScriptLock();
  lock.waitLock(CFG.TIMEOUT_LOCK);
  try {
    return _gravarLogSemTrava(evento);
  } finally {
    lock.releaseLock();
  }
}

function _gravarLogSemTrava(evento) {
  const ev = evento || {};
  const sh = _aba(CFG.ABAS.LOG);
  const ultima = sh.getLastRow();
  const sequencia = ultima;

  let hashAnterior = '0'.repeat(64);
  if (ultima >= 2) {
    const anterior = sh.getRange(ultima, CFG.COL_LOG.hash_registro).getValue();
    if (anterior) hashAnterior = String(anterior);
  }

  const agora = new Date();
  const idLog = 'LOG-' +
    Utilities.formatDate(agora, Session.getScriptTimeZone(), 'yyyyMMdd') + '-' +
    ('000000' + sequencia).slice(-6);

  const linha = [
    idLog, agora,
    ev.matricula_usuario || 'SISTEMA',
    ev.perfil_rbac_no_momento || 'SISTEMA',
    ev.acao_realizada || '',
    ev.tabela_afetada || '',
    ev.id_registro_afetado || '',
    ev.valor_anterior || '',
    ev.valor_novo || '',
    ev.justificativa || '',
    ev.origem_acao || 'MOTOR_REGRAS',
    ev.id_dispositivo || 'SERVIDOR',
    ev.endereco_ip || '',
    ev.resultado || 'SUCESSO',
    ev.criticidade || 'INFO',
    '',
    hashAnterior,
    sequencia,
    ev.nivel_hierarquico_no_momento || 'SISTEMA'
  ];

  linha[CFG.COL_LOG.hash_registro - 1] = _sha256(linha.join('|'));
  sh.appendRow(linha);
  return idLog;
}

function verificarIntegridadeLog() {
  const dados = _lerTudo(CFG.ABAS.LOG);
  const problemas = [];
  let hashEsperado = '0'.repeat(64);

  for (let i = 0; i < dados.length; i++) {
    const linha = dados[i].slice(0, CFG.COL_LOG.nivel_hierarquico_no_momento);
    const numeroLinha = i + 2;

    if (String(linha[CFG.COL_LOG.hash_anterior - 1]) !== hashEsperado) {
      problemas.push('Linha ' + numeroLinha + ': corrente rompida.');
    }
    if (Number(linha[CFG.COL_LOG.sequencia - 1]) !== i + 1) {
      problemas.push('Linha ' + numeroLinha + ': lacuna na sequência — registro apagado.');
    }

    const hashGravado = String(linha[CFG.COL_LOG.hash_registro - 1]);
    const copia = linha.slice();
    copia[CFG.COL_LOG.hash_registro - 1] = '';
    if (_sha256(copia.join('|')) !== hashGravado) {
      problemas.push('Linha ' + numeroLinha + ': conteúdo alterado após a gravação.');
    }
    hashEsperado = hashGravado;
  }

  return { integro: problemas.length === 0, total_registros: dados.length, problemas: problemas };
}
