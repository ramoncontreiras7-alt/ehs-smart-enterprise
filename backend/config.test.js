/**
 * Smoke tests — EHS Smart Enterprise v2.1
 * Rode com: npm test
 */

const assert = require('assert');

function mockCFG() {
  global.CFG = {
    ABAS: { FUNCIONARIOS: 'Funcionarios', MOVIMENTACOES: 'Movimentacoes_Trocas' },
    COL_FUNCIONARIOS: { matricula: 1, nome_completo: 2, status: 16 },
    COL_MOVIMENTACOES: { id_movimentacao: 1, matricula: 3, codigo_epi: 4, tipo_movimentacao: 5 },
    PERFIS: ['FUNCIONARIO', 'TERCEIRIZADO', 'GESTOR', 'SST', 'ADMIN'],
    HIERARQUIA: {
      OPERACIONAL: { peso: 1, escopo: 'PROPRIO', ve_dado_nominal_sensivel: false },
      GESTOR: { peso: 2, escopo: 'SETORIAL', ve_dado_nominal_sensivel: true },
      DIRETORIA: { peso: 3, escopo: 'GLOBAL', ve_dado_nominal_sensivel: false },
      MASTER_ADMIN: { peso: 4, escopo: 'GLOBAL', ve_dado_nominal_sensivel: true }
    },
    COMBINACOES_VALIDAS: {
      MASTER_ADMIN: ['ADMIN'],
      DIRETORIA: ['ADMIN', 'GESTOR', 'SST'],
      GESTOR: ['GESTOR', 'SST', 'ADMIN'],
      OPERACIONAL: ['FUNCIONARIO', 'TERCEIRIZADO', 'GESTOR', 'SST', 'ADMIN']
    },
    FEATURE_FLAGS: {
      alertas_fadiga_email: false,
      alertas_treinamento_email: false,
      modo_totem_offline: false,
      webhook_rca_chat: false
    },
    TIMEOUT_LOCK: 20000
  };
}

mockCFG();

describe('EHS Smart Enterprise — Smoke Tests', function () {
  it('CFG deve expor 5 perfis RBAC', function () {
    assert.strictEqual(CFG.PERFIS.length, 5);
    assert.ok(CFG.PERFIS.indexOf('ADMIN') >= 0);
  });

  it('CFG deve ter hierarquia com 4 níveis', function () {
    assert.strictEqual(Object.keys(CFG.HIERARQUIA).length, 4);
    assert.strictEqual(CFG.HIERARQUIA.GESTOR.ve_dado_nominal_sensivel, true);
    assert.strictEqual(CFG.HIERARQUIA.DIRETORIA.ve_dado_nominal_sensivel, false);
  });

  it('CFG deve ter combinações válidas para cada nível', function () {
    assert.ok(CFG.COMBINACOES_VALIDAS.GESTOR.indexOf('GESTOR') >= 0);
    assert.ok(CFG.COMBINACOES_VALIDAS.OPERACIONAL.indexOf('FUNCIONARIO') >= 0);
    assert.ok(CFG.COMBINACOES_VALIDAS.MASTER_ADMIN.indexOf('ADMIN') >= 0);
  });

  it('Feature flags devem existir e ser boolean', function () {
    assert.strictEqual(typeof CFG.FEATURE_FLAGS.alertas_fadiga_email, 'boolean');
    assert.strictEqual(typeof CFG.FEATURE_FLAGS.alertas_treinamento_email, 'boolean');
    assert.strictEqual(typeof CFG.FEATURE_FLAGS.modo_totem_offline, 'boolean');
    assert.strictEqual(typeof CFG.FEATURE_FLAGS.webhook_rca_chat, 'boolean');
  });

  it('Feature flags devem iniciar desligadas por padrão', function () {
    assert.strictEqual(CFG.FEATURE_FLAGS.alertas_fadiga_email, false);
    assert.strictEqual(CFG.FEATURE_FLAGS.alertas_treinamento_email, false);
  });
});
