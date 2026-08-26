/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EHS SMART ENTERPRISE · Monitoramento.js — v2.1
 * Health checks e alertas operacionais.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const CFG_MONITOR = {
  ABAS_CRITICAS: ['Funcionarios', 'Equipamentos_EPI_EPC', 'Movimentacoes_Trocas', 'Log_Auditoria'],
  HORAS_ALERTA_ATRASO: 2
};

function monitor_HealthCheck() {
  const resultado = {
    timestamp: new Date().toISOString(),
    ambiente: {},
    planilha: {},
    auditoria: {},
    totens: {},
    status: 'HEALTHY',
    problemas: []
  };

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    resultado.ambiente.planilha = !!ss;
    resultado.ambiente.nome = ss ? ss.getName() : '';
    resultado.ambiente.aba_ativas = ss ? ss.getSheets().length : 0;

    CFG_MONITOR.ABAS_CRITICAS.forEach(function (nome) {
      const sh = ss.getSheetByName(nome);
      resultado.planilha[nome] = !!sh;
      if (!sh) resultado.problemas.push('Aba crítica ausente: ' + nome);
    });

    try {
      const sh = _aba(CFG.ABAS.LOG);
      const ultimaLinha = sh.getLastRow();
      resultado.auditoria.total_registros = Math.max(0, ultimaLinha - 1);
      if (ultimaLinha >= 2) {
        const ultima = sh.getRange(ultimaLinha, CFG.COL_LOG.timestamp).getValue();
        resultado.auditoria.ultimo_timestamp = ultima;
      }
    } catch (e) {
      resultado.auditoria.erro = e.message;
      resultado.problemas.push('Erro ao ler Log_Auditoria: ' + e.message);
    }

    try {
      const tokens = api_ListarTokensTotem();
      resultado.totens.total = tokens.length;
      resultado.totens.expirados = tokens.filter(function (t) { return t.expirado; }).length;
      if (resultado.totens.expirados > 0) {
        resultado.problemas.push(resultado.totens.expirados + ' totens com token expirado.');
      }
    } catch (e) {
      resultado.totens.erro = e.message;
    }

    if (resultado.problemas.length > 0) {
      resultado.status = 'DEGRADED';
    }

    registrarLog({
      matricula_usuario: 'SISTEMA', perfil_rbac_no_momento: 'SISTEMA',
      nivel_hierarquico_no_momento: 'SISTEMA',
      acao_realizada: 'MONITORAMENTO_HEALTH', tabela_afetada: 'SISTEMA',
      id_registro_afetado: resultado.status, origem_acao: 'ROTINA_AUTOMATICA',
      id_dispositivo: 'SERVIDOR', resultado: 'SUCESSO', criticidade: resultado.status === 'HEALTHY' ? 'INFO' : 'AVISO',
      justificativa: 'Health check: ' + resultado.problemas.join('; ') || 'OK'
    });

    return resultado;
  } catch (e) {
    return {
      status: 'UNHEALTHY',
      erro: e.message,
      timestamp: new Date().toISOString()
    };
  }
}

function monitor_AlertarOperacao() {
  const check = monitor_HealthCheck();
  if (check.status === 'UNHEALTHY' || check.problemas.length > 0) {
    const assunto = '[EHS] Alerta de Monitoramento — ' + check.status;
    const corpo = [
      'Health check do sistema EHS Smart Enterprise.',
      '',
      'Status: ' + check.status,
      'Timestamp: ' + check.timestamp,
      '',
      'Problemas detectados:',
      (check.problemas.length ? check.problemas.map(function (p) { return '- ' + p; }).join('\n') : '- Nenhum')
    ].join('\n');

    try {
      const admins = _buscarMasterAdmins();
      admins.forEach(function (mat) {
        const u = _obterUsuario(mat);
        if (u && u.email_corporativo) {
          GmailApp.sendEmail(u.email_corporativo, assunto, corpo);
        }
      });
    } catch (e) {
      Logger.log('Falha ao enviar alerta de monitoramento: ' + e.message);
    }
  }
  return check;
}

function _buscarMasterAdmins() {
  const c = CFG.COL_FUNCIONARIOS;
  return _lerTudo(CFG.ABAS.FUNCIONARIOS)
    .filter(function (f) {
      return String(f[c.perfil_rbac - 1]).toUpperCase() === 'ADMIN' &&
             String(f[c.nivel_hierarquico - 1]).toUpperCase() === 'MASTER_ADMIN' &&
             String(f[c.status_efetivo - 1] || f[c.status - 1]).toUpperCase() === 'ATIVO';
    })
    .map(function (f) { return f[c.matricula - 1]; });
}

function instalarGatilhosMonitoramento() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'monitor_HealthCheck') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('monitor_HealthCheck').timeBased().everyHours(1).create();
  return 'Gatilho de monitoramento instalado: health check a cada 1h.';
}
