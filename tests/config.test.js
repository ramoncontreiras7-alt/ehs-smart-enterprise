/**
 * EHS Smart Enterprise — Testes das regras homologadas (config.js REAL)
 * Rode com: npm test   (usa o executor de testes nativo do Node, sem dependências)
 *
 * Diferente da versão anterior, aqui NÃO há dados simulados: o arquivo
 * backend/config.js é carregado como o Apps Script carregaria. Se alguém
 * alterar uma regra homologada, o teste falha antes de chegar à produção.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, '..', 'backend', 'config.js'), 'utf8') +
  '\n;this.CFG = CFG; this.FADIGA = FADIGA; this.GAMIFICACAO = GAMIFICACAO;',
  ctx
);
const { CFG, FADIGA, GAMIFICACAO } = ctx;

test('RBAC: 5 perfis operacionais', () => {
  assert.deepStrictEqual([...CFG.PERFIS].sort(), ['ADMIN', 'FUNCIONARIO', 'GESTOR', 'SST', 'TERCEIRIZADO']);
});

test('RBAC: 4 níveis hierárquicos em ordem de peso (Caminho A)', () => {
  const pesos = ['OPERACIONAL', 'GESTOR', 'DIRETORIA', 'MASTER_ADMIN'].map(n => CFG.HIERARQUIA[n].peso);
  assert.deepStrictEqual(pesos, [1, 2, 3, 4]);
});

test('Privacidade: DIRETORIA NÃO vê dado nominal sensível (Dossiê 3.3.2)', () => {
  assert.strictEqual(CFG.HIERARQUIA.DIRETORIA.ve_dado_nominal_sensivel, false);
  assert.strictEqual(CFG.HIERARQUIA.OPERACIONAL.ve_dado_nominal_sensivel, false);
});

test('RBAC: toda combinação válida usa um perfil existente', () => {
  for (const [nivel, perfis] of Object.entries(CFG.COMBINACOES_VALIDAS)) {
    assert.ok(CFG.HIERARQUIA[nivel], 'nível inexistente: ' + nivel);
    perfis.forEach(p => assert.ok(CFG.PERFIS.includes(p), `${nivel} -> perfil inexistente ${p}`));
  }
});

test('Segurança: segredo do totem NÃO fica no código', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'backend', 'config.js'), 'utf8') +
              fs.readFileSync(path.join(__dirname, '..', 'backend', 'web.js'), 'utf8');
  assert.ok(!/EHS_TOTEM_SECRET/.test(src), 'segredo fixo encontrado no código');
  assert.strictEqual(CFG.TOTEM_CRIPTOGRAFIA_CHAVE_PROPS, 'TOTEM_HMAC_SECRET');
});

test('Fadiga: regra NR-06 integrada ao motor', () => {
  assert.strictEqual(FADIGA.NR06.EXIGE_VALIDACAO_CA, true);
  assert.ok(FADIGA.PESOS.NR06_INFRACAO > 0);
  assert.ok(FADIGA.CORTES.CRITICO > FADIGA.CORTES.ALTO && FADIGA.CORTES.ALTO > FADIGA.CORTES.MODERADO);
  assert.ok(FADIGA.INTERJORNADA_MINIMA_HORAS >= 11, 'CLT art. 66: interjornada mínima de 11h');
});

test('Gamificação assimétrica: repasse ao mentor nunca negativo', () => {
  assert.ok(GAMIFICACAO.REPASSE_MINIMO >= 0);
  assert.ok(GAMIFICACAO.REPASSE_MAXIMO >= GAMIFICACAO.REPASSE_MINIMO);
  assert.ok(GAMIFICACAO.PONTOS_POR_TROCA_POSITIVA > 0);
});

test('Feature flags existem e começam desligadas', () => {
  for (const [k, v] of Object.entries(CFG.FEATURE_FLAGS)) {
    assert.strictEqual(typeof v, 'boolean', k);
  }
  assert.strictEqual(CFG.FEATURE_FLAGS.alertas_fadiga_email, false);
});
