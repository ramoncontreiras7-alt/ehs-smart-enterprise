/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EHS SMART ENTERPRISE · Backup_Automatizado.js — v2.1
 * Exporta snapshots do Dados.xlsx para o Google Drive com versionamento.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const CFG_BACKUP = {
  PASTA_BACKUP: 'EHS_BACKUPS',
  NOME_PLANILHA: 'Dados.xlsx',
  FORMATO: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  FATOR_MB: 1024 * 1024,
  PRECISAO_MB: 2
};

function executarBackupCompleto() {
  const lock = LockService.getScriptLock();
  lock.waitLock(CFG.TIMEOUT_LOCK);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const nomePlanilha = ss.getName();
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmmss');
    const nomeArquivo = '[BACKUP ' + timestamp + '] ' + nomePlanilha;

    const pasta = _obterOuCriarPastaBackup();
    const blob = ss.getBlob().setName(nomeArquivo + '.xlsx');
    const arquivo = pasta.createFile(blob);
    arquivo.setDescription('Backup automático do EHS Smart Enterprise — ' + timestamp);
    arquivo.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW);

    const logs = [];
    logs.push({
      timestamp: new Date().toISOString(),
      arquivo: arquivo.getName(),
      id: arquivo.getId(),
      tamanho_mb: Math.round(arquivo.getSize() / CFG_BACKUP.FATOR_MB * 100) / 100,
      url: 'https://drive.google.com/file/d/' + arquivo.getId() + '/view'
    });

    registrarLog({
      matricula_usuario: 'SISTEMA', perfil_rbac_no_momento: 'SISTEMA',
      nivel_hierarquico_no_momento: 'SISTEMA',
      acao_realizada: 'BACKUP', tabela_afetada: 'SISTEMA',
      id_registro_afetado: nomeArquivo, origem_acao: 'ROTINA_AUTOMATICA',
      id_dispositivo: 'SERVIDOR', resultado: 'SUCESSO', criticidade: 'INFO',
      justificativa: 'Backup exportado: ' + arquivo.getName()
    });

    return { ok: true, backup: logs[0] };
  } catch (erro) {
    registrarLog({
      matricula_usuario: 'SISTEMA', perfil_rbac_no_momento: 'SISTEMA',
      nivel_hierarquico_no_momento: 'SISTEMA',
      acao_realizada: 'BACKUP', tabela_afetada: 'SISTEMA',
      id_registro_afetado: 'FALHA', origem_acao: 'ROTINA_AUTOMATICA',
      id_dispositivo: 'SERVIDOR', resultado: 'ERRO', criticidade: 'CRITICO',
      justificativa: 'Falha no backup: ' + erro.message
    });
    return { ok: false, erro: erro.message };
  } finally {
    lock.releaseLock();
  }
}

function limparBackupsAntigos(diasManter) {
  diasManter = diasManter || 30;
  const pasta = _obterOuCriarPastaBackup();
  const corte = new Date();
  corte.setDate(corte.getDate() - diasManter);
  const removidos = [];

  pasta.getFiles().forEach(function (arquivo) {
    const data = arquivo.getLastUpdated();
    if (data < corte) {
      removidos.push(arquivo.getName());
      arquivo.setTrashed(true);
    }
  });

  if (removidos.length) {
    registrarLog({
      matricula_usuario: 'SISTEMA', perfil_rbac_no_momento: 'SISTEMA',
      nivel_hierarquico_no_momento: 'SISTEMA',
      acao_realizada: 'BACKUP_LIMPEZA', tabela_afetada: 'SISTEMA',
      id_registro_afetado: 'LIMPEZA', origem_acao: 'ROTINA_AUTOMATICA',
      id_dispositivo: 'SERVIDOR', resultado: 'SUCESSO', criticidade: 'INFO',
      justificativa: removidos.length + ' backups antigos removidos (retenção: ' + diasManter + ' dias)'
    });
  }

  return { removidos: removidos };
}

function instalarGatilhosBackup() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'executarBackupCompleto' || t.getHandlerFunction() === 'limparBackupsAntigos') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('executarBackupCompleto').timeBased().everyHours(6).create();
  ScriptApp.newTrigger('limparBackupsAntigos').timeBased().atHour(2).everyDays(1).create();

  return 'Gatilhos de backup instalados: exportação (6/6h), limpeza (02h).';
}

function _obterOuCriarPastaBackup() {
  const pastas = DriveApp.getFoldersByName(CFG_BACKUP.PASTA_BACKUP);
  if (pastas.hasNext()) return pastas.next();

  const raiz = DriveApp.getRootFolder();
  return raiz.createFolder(CFG_BACKUP.PASTA_BACKUP);
}
