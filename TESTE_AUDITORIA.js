const fs = require('fs');
const path = require('path');

const ROOT = 'C:\\EHS\\ARQUIVOS EHS SYSTEM';
const FILES = {
  web: path.join(ROOT, 'backend', 'web.js'),
  config: path.join(ROOT, 'backend', 'config.js'),
  utils: path.join(ROOT, 'backend', 'utils.js'),
  motor: path.join(ROOT, 'backend', 'Motor_Regras.js'),
  rca: path.join(ROOT, 'backend', 'RCA_POP.js'),
  monitor: path.join(ROOT, 'backend', 'Monitoramento.js'),
  backup: path.join(ROOT, 'backend', 'Backup_Automatizado.js'),
  totem: path.join(ROOT, 'frontend', 'Totem.html'),
  etl: path.join(ROOT, 'etl', 'ETL_Ingestao.gs')
};

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function assert(condition, testName, detail) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    return true;
  } else {
    console.log(`❌ FAIL: ${testName}${detail ? ' — ' + detail : ''}`);
    return false;
  }
}

function run() {
  let passed = 0;
  let failed = 0;

  const web = read(FILES.web);
  const config = read(FILES.config);
  const utils = read(FILES.utils);
  const motor = read(FILES.motor);
  const rca = read(FILES.rca);
  const monitor = read(FILES.monitor);
  const backup = read(FILES.backup);
  const totem = read(FILES.totem);
  const etl = read(FILES.etl);

  console.log('=== EHS Smart Enterprise — Pós-Auditoria Test Suite ===\n');

  // 1. Versão
  if (assert(config.includes("VERSAO: '2.1'"), 'Versão do projeto é 2.1')) passed++; else failed++;

  // 2. Stack trace removido em produção
  if (assert(!web.includes('detalhe: erro.message') || web.includes('DEBUG = false'), 'Stack trace protegido por flag DEBUG')) passed++; else failed++;

  // 3. Token criptografado
  if (assert(web.includes('_criptografarToken'), 'Função de criptografia de token existe')) passed++; else failed++;
  if (assert(web.includes('Utilities.computeHmacSha256'), 'HMAC-SHA256 usado para criptografia')) passed++; else failed++;
  if (assert(web.includes('_criptografarToken(token)'), 'Token é criptografado antes do storage')) passed++; else failed++;

  // 4. X-Frame SAMEORIGIN
  const sameOriginCount = (web.match(/SAMEORIGIN/g) || []).length;
  if (assert(sameOriginCount >= 3, 'X-Frame-Options definido como SAMEORIGIN (encontrado: ' + sameOriginCount + ')')) passed++; else failed++;
  if (assert(!web.includes('ALLOWALL'), 'Sem ALLOWALL no código')) passed++; else failed++;

  // 5. Race condition corrigida
  if (assert(rca.includes('Utilities.getUuid().slice(0, 4)'), 'IDs de incidente usam UUID (não getLastRow)')) passed++; else failed++;
  if (assert(!rca.includes("'RCA-' + ('0000' + seq).slice(-4)"), 'IDs de RCA não usam sequência de linha')) passed++; else failed++;

  // 6. Centralização de código
  if (assert(!config.includes('function _aba('), '_aba removido de config.js')) passed++; else failed++;
  if (assert(!config.includes('function _lerTudo('), '_lerTudo removido de config.js')) passed++; else failed++;
  if (assert(!config.includes('function _buscarLinha('), '_buscarLinha removido de config.js')) passed++; else failed++;

  // 7. FADIGA/GAMIFICACAO centralizadas
  if (assert(!motor.includes('const FADIGA = {'), 'FADIGA não redefinido em Motor_Regras.js')) passed++; else failed++;
  if (assert(!motor.includes('const GAMIFICACAO = {'), 'GAMIFICACAO não redefinido em Motor_Regras.js')) passed++; else failed++;

  // 8. Cache híbrido
  if (assert(utils.includes('CacheService.getScriptCache()'), 'CacheService implementado como fallback')) passed++; else failed++;
  if (assert(utils.includes("cacheService.put('aba_' + chave"), 'CacheService grava dados serializados')) passed++; else failed++;

  // 9. Monitoramento otimizado
  if (assert(!monitor.includes('_lerTudo(CFG.ABAS.LOG)'), 'Monitoramento não carrega Log_Auditoria completo')) passed++; else failed++;
  if (assert(monitor.includes('sh.getLastRow()') && monitor.includes('getRange(ultimaLinha'), 'Monitoramento lê apenas última linha')) passed++; else failed++;

  // 10. Timeout no totem
  if (assert(totem.includes('setTimeout'), 'Timeout implementado no totem')) passed++; else failed++;
  if (assert(totem.includes('clearTimeout(timeoutId)'), 'Timeout é limpo nos handlers')) passed++; else failed++;
  if (assert(totem.includes('15000'), 'Timeout de 15s definido')) passed++; else failed++;

  // 11. Backup constants
  if (assert(backup.includes('FATOR_MB: 1024 * 1024'), 'Constante FATOR_MB definida')) passed++; else failed++;
  if (assert(backup.includes('PRECISAO_MB: 2'), 'Constante PRECISAO_MB definida')) passed++; else failed++;
  if (assert(backup.includes('CFG_BACKUP.FATOR_MB'), 'FATOR_MB usado no cálculo')) passed++; else failed++;

  // 12. ETL sem duplicação
  const normMatches = (etl.match(/function _norm\(/g) || []).length;
  if (assert(normMatches === 0, '_norm não declarado em ETL_Ingestao.gs (encontrado: ' + normMatches + ')')) passed++; else failed++;
  if (assert(etl.includes('_norm('), '_norm ainda é usado em ETL_Ingestao.gs')) passed++; else failed++;

  console.log('\n=== Resultado ===');
  console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    console.log('\n⚠️  Alguns testes falharam. Revise os arquivos antes de prosseguir.');
    process.exit(1);
  } else {
    console.log('\n🎉 Todos os testes passaram. Pronto para homologação.');
    process.exit(0);
  }
}

run();
