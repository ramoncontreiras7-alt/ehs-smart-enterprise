/**
 * EHS Smart Enterprise — Verificador de carga do Apps Script
 * ------------------------------------------------------------------
 * No Apps Script TODOS os arquivos .js/.gs dividem o MESMO espaço global.
 * Um único `const X` repetido em dois arquivos derruba o projeto inteiro
 * ("Identifier 'X' has already been declared") antes de qualquer tela abrir.
 *
 * Este script simula essa carga e reprova (código de saída 1) quando:
 *   1. algum arquivo tem erro de sintaxe;
 *   2. há declaração const/let/class repetida entre arquivos (erro FATAL);
 *   3. o código não carrega junto com serviços Google simulados;
 *   4. doGet() não existe;
 *   5. uma tela referenciada (createTemplateFromFile / include) não existe.
 * Funções repetidas geram AVISO: não travam, mas só uma delas vale.
 *
 * Uso: node tools/verificar_carga.js backend
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const pasta = process.argv[2] || 'backend';
const IGNORAR = [/\.test\.js$/, /^etl_worker\.js$/]; // espelha backend/.claspignore

const arquivos = fs.readdirSync(pasta)
  .filter(f => /\.(js|gs)$/.test(f) && !IGNORAR.some(r => r.test(f)))
  .sort();
const htmls = new Set(fs.readdirSync(pasta).filter(f => f.endsWith('.html')).map(f => f.replace(/\.html$/, '')));

let fatais = 0;
const erro = (m) => { fatais++; console.log('❌ ' + m); };
const aviso = (m) => console.log('⚠️  ' + m);

const declaracoes = {};
const fontes = {};
for (const f of arquivos) {
  const src = fs.readFileSync(path.join(pasta, f), 'utf8');
  fontes[f] = src;
  try { new vm.Script(src, { filename: f }); } catch (e) { erro(`Sintaxe em ${f}: ${e.message}`); }
  const re = /^(?:(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|(const|let|var|class)\s+([A-Za-z_$][\w$]*))/gm;
  let m;
  while ((m = re.exec(src))) {
    const nome = m[1] || m[3];
    const tipo = m[1] ? 'function' : m[2];
    (declaracoes[nome] = declaracoes[nome] || []).push({ f, tipo });
  }
}

for (const [nome, lista] of Object.entries(declaracoes)) {
  if (lista.length < 2) continue;
  const desc = lista.map(d => `${d.f} (${d.tipo})`).join(' | ');
  if (lista.some(d => d.tipo === 'const' || d.tipo === 'let' || d.tipo === 'class')) {
    erro(`Declaração repetida FATAL "${nome}": ${desc}`);
  } else {
    aviso(`Função repetida "${nome}" — só uma versão vale: ${desc}`);
  }
}

// Carga conjunta com serviços Google simulados (ordem alfabética, como o clasp)
const falso = new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => '' : falso),
  apply: () => falso
});
const ctx = { console };
['SpreadsheetApp', 'HtmlService', 'Session', 'CacheService', 'LockService', 'PropertiesService',
 'ScriptApp', 'DriveApp', 'MailApp', 'GmailApp', 'Logger', 'ContentService', 'UrlFetchApp',
 'Utilities', 'Drive', 'CalendarApp'].forEach(n => { ctx[n] = falso; });
vm.createContext(ctx);
try {
  vm.runInContext(arquivos.map(f => fontes[f]).join('\n;\n'), ctx, { filename: 'projeto-apps-script' });
  if (typeof ctx.doGet !== 'function') erro('doGet() não encontrado — o Web App não abre.');
} catch (e) {
  erro('Projeto NÃO carrega no Apps Script: ' + e.message);
}

// Telas referenciadas precisam existir
const refs = new Set();
const reTela = /(?:createTemplateFromFile|createHtmlOutputFromFile|include)\(\s*['"]([^'"]+)['"]/g;
for (const src of Object.values(fontes)) { let m; while ((m = reTela.exec(src))) refs.add(m[1]); }
for (const h of htmls) {
  const src = fs.readFileSync(path.join(pasta, h + '.html'), 'utf8');
  let m; while ((m = reTela.exec(src))) refs.add(m[1]);
}
for (const r of refs) if (!htmls.has(r)) erro(`Tela "${r}.html" é chamada no código mas não existe em ${pasta}/`);

console.log(`\n${arquivos.length} arquivos de servidor, ${htmls.size} telas HTML verificados.`);
if (fatais) { console.log(`REPROVADO: ${fatais} erro(s) fatal(is).`); process.exit(1); }
console.log('APROVADO: o projeto carrega no Apps Script.');
