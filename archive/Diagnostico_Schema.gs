/**************************************************************************************************
 * EHS SMART ENTERPRISE v2.0 — DIAGNÓSTICO DE SCHEMA
 * Arquivo: Diagnostico_Schema.gs
 * ------------------------------------------------------------------------------------------------
 * SOMENTE LEITURA. Nenhuma função aqui cria, altera ou apaga aba, linha ou célula.
 *
 * Motivo: o SPA corporativo quebrou com "Aba não encontrada: Setores". Antes de criar
 * qualquer aba, precisamos saber exatamente o que existe na planilha e o que o CFG espera.
 *
 * COMO USAR:
 *   1. Abra o editor do Apps Script
 *   2. Selecione a função  diag_Schema  no seletor do topo
 *   3. Run
 *   4. Ver > Registros de execução (ou Ctrl+Enter) e copie a saída inteira
 **************************************************************************************************/


/**
 * Relatório completo: abas esperadas x abas presentes, cabeçalhos e contagem de linhas.
 * Não escreve nada. Pode rodar quantas vezes quiser.
 */
function diag_Schema() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var linhas = [];

  linhas.push('════════════════════════════════════════════════════════════');
  linhas.push('DIAGNÓSTICO DE SCHEMA — EHS Smart Enterprise v' + (typeof CFG !== 'undefined' ? CFG.VERSAO : '?'));
  linhas.push('Planilha: ' + ss.getName());
  linhas.push('ID: ' + ss.getId());
  linhas.push('════════════════════════════════════════════════════════════');
  linhas.push('');

  // ── Abas que realmente existem ────────────────────────────────────────
  var presentes = ss.getSheets().map(function (sh) { return sh.getName(); });
  linhas.push('ABAS PRESENTES NA PLANILHA (' + presentes.length + '):');
  presentes.forEach(function (n) {
    var sh = ss.getSheetByName(n);
    linhas.push('  • ' + n +
                '   [linhas: ' + sh.getLastRow() +
                ' | colunas: ' + sh.getLastColumn() + ']');
  });
  linhas.push('');

  // ── Abas que o CFG espera ─────────────────────────────────────────────
  if (typeof CFG === 'undefined' || !CFG.ABAS) {
    linhas.push('ERRO: CFG.ABAS não está definido. O Code.gs foi carregado?');
    Logger.log(linhas.join('\n'));
    return linhas.join('\n');
  }

  var faltando = [];
  var okays = [];

  linhas.push('ABAS ESPERADAS PELO CFG.ABAS:');
  Object.keys(CFG.ABAS).forEach(function (chave) {
    var nomeAba = CFG.ABAS[chave];
    var existe = presentes.indexOf(nomeAba) !== -1;
    linhas.push('  ' + (existe ? '✓' : '✗') + '  ' + chave + ' → "' + nomeAba + '"');
    if (existe) { okays.push(nomeAba); } else { faltando.push({ chave: chave, aba: nomeAba }); }
  });
  linhas.push('');

  // ── Veredito ──────────────────────────────────────────────────────────
  linhas.push('────────────────────────────────────────────────────────────');
  if (faltando.length === 0) {
    linhas.push('VEREDITO: todas as ' + okays.length + ' abas esperadas existem.');
  } else {
    linhas.push('VEREDITO: ' + faltando.length + ' aba(s) FALTANDO — o sistema quebra ao acessá-las:');
    faltando.forEach(function (f) {
      linhas.push('   ✗ ' + f.aba + '   (CFG.ABAS.' + f.chave + ')');
    });
  }
  linhas.push('────────────────────────────────────────────────────────────');
  linhas.push('');

  // ── Cabeçalhos das abas que existem ───────────────────────────────────
  linhas.push('CABEÇALHOS DAS ABAS PRESENTES:');
  linhas.push('');
  okays.forEach(function (nomeAba) {
    var sh = ss.getSheetByName(nomeAba);
    var ultCol = sh.getLastColumn();
    linhas.push('── ' + nomeAba + ' ──');
    if (ultCol === 0) {
      linhas.push('   (aba vazia, sem cabeçalho)');
    } else {
      var cab = sh.getRange(1, 1, 1, ultCol).getValues()[0];
      cab.forEach(function (c, i) {
        linhas.push('   ' + _diagLetraColuna(i + 1) + ' (' + (i + 1) + ') = ' + (c === '' ? '(vazio)' : c));
      });
    }
    linhas.push('');
  });

  // ── Conferência específica de Funcionarios x COL_FUNCIONARIOS ─────────
  if (presentes.indexOf(CFG.ABAS.FUNCIONARIOS) !== -1 && CFG.COL_FUNCIONARIOS) {
    linhas.push('────────────────────────────────────────────────────────────');
    linhas.push('CONFERÊNCIA: Funcionarios x CFG.COL_FUNCIONARIOS');
    linhas.push('────────────────────────────────────────────────────────────');
    var shF = ss.getSheetByName(CFG.ABAS.FUNCIONARIOS);
    var colsF = shF.getLastColumn();
    var cabF = colsF > 0 ? shF.getRange(1, 1, 1, colsF).getValues()[0] : [];

    Object.keys(CFG.COL_FUNCIONARIOS).forEach(function (campo) {
      var pos = CFG.COL_FUNCIONARIOS[campo];
      var real = (pos <= cabF.length) ? cabF[pos - 1] : '(coluna não existe)';
      var bate = String(real).trim().toLowerCase() === campo.toLowerCase();
      linhas.push('  ' + (bate ? '✓' : '?') + '  col ' + pos + ' (' + _diagLetraColuna(pos) + ')' +
                  '  CFG diz "' + campo + '"  |  planilha diz "' + real + '"');
    });
    linhas.push('');
    linhas.push('  Total de colunas na aba: ' + colsF + '  (CFG v2.0 espera 25)');
    linhas.push('');
  }

  var saida = linhas.join('\n');
  Logger.log(saida);
  return saida;
}


/**
 * Versão enxuta: só o que está faltando. Útil quando o log fica grande demais.
 */
function diag_SchemaResumo() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var presentes = ss.getSheets().map(function (sh) { return sh.getName(); });
  var faltando = [];

  Object.keys(CFG.ABAS).forEach(function (chave) {
    if (presentes.indexOf(CFG.ABAS[chave]) === -1) {
      faltando.push(CFG.ABAS[chave] + ' (CFG.ABAS.' + chave + ')');
    }
  });

  var saida = faltando.length === 0
    ? 'OK: todas as abas do CFG existem.'
    : 'FALTANDO ' + faltando.length + ' aba(s):\n  ✗ ' + faltando.join('\n  ✗ ');

  saida += '\n\nAbas presentes (' + presentes.length + '): ' + presentes.join(', ');

  Logger.log(saida);
  return saida;
}


/** Converte índice 1-based em letra de coluna (1→A, 27→AA). */
function _diagLetraColuna(n) {
  var s = '';
  while (n > 0) {
    var r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
