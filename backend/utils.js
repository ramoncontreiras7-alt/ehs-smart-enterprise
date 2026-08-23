/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EHS SMART ENTERPRISE · utils.js — v2.0
 * Funções utilitárias de leitura/escrita na planilha.
 * ═══════════════════════════════════════════════════════════════════════════
 */

function _aba(nome) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nomeSeguro = nome ? String(nome) : 'SEM_NOME';
  let sh = ss.getSheetByName(nomeSeguro);
  if (!sh) {
    sh = ss.insertSheet(nomeSeguro);
    sh.appendRow([nomeSeguro]);
  }
  return sh;
}

function _lerTudo(nomeAba) {
  const sh = _aba(nomeAba);
  const ultima = sh.getLastRow();
  if (ultima < 2) return [];
  return sh.getRange(2, 1, ultima - 1, sh.getLastColumn()).getValues();
}

function _buscarLinha(nomeAba, coluna, chave) {
  const dados = _lerTudo(nomeAba);
  const alvo = String(chave).trim().toUpperCase();
  for (let i = 0; i < dados.length; i++) {
    if (String(dados[i][coluna - 1]).trim().toUpperCase() === alvo) {
      return { linha: i + 2, dados: dados[i] };
    }
  }
  return null;
}

function _listar(texto) {
  if (!texto) return [];
  return String(texto).split(';')
    .map(function (t) { return t.trim(); })
    .filter(function (t) { return t !== ''; });
}

function _diasAte(data) {
  if (!data) return null;
  const d = (data instanceof Date) ? data : new Date(data);
  if (isNaN(d.getTime())) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - hoje) / 86400000);
}

function _formatarData(d) {
  if (!d) return '';
  return Utilities.formatDate(new Date(d), Session.getScriptTimeZone(), 'dd/MM/yyyy');
}

function _sha256(texto) {
  const entrada = texto ? String(texto) : '';
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, entrada, Utilities.Charset.UTF_8);
  return bytes.map(function (b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
}

function _norm(v) {
  return String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
}
