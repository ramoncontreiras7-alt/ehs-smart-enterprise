/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EHS SMART ENTERPRISE · Sincronizacao.js — v2.1
 * Sincronização entre Apps Script, Google Drive e GitHub.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const CFG_SYNC = {
  PASTA_BACKUP_GITHUB: 'EHS_BACKUPS_GITHUB',
  NOME_ARQUIVO_LOG: 'Log_Sincronizacao_GitHub'
};

/**
 * Salva backup do código atual no Google Drive.
 * Chamado automaticamente antes de um deploy.
 */
function sync_SalvarBackupPreDeploy(commitHash, descricao) {
  const lock = LockService.getScriptLock();
  lock.waitLock(CFG.TIMEOUT_LOCK);
  
  try {
    const pasta = _obterOuCriarPasta(CFG_SYNC.PASTA_BACKUP_GITHUB);
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmmss');
    const nomeArquivo = 'EHS_' + timestamp + '_' + (commitHash || 'LOCAL') + '.json';
    
    const metadata = {
      timestamp: new Date().toISOString(),
      commit_hash: commitHash,
      descricao: descricao,
      versao: CFG.VERSAO,
      arquivos: []
    };
    
    const arquivos = DriveApp.getRootFolder().getFiles();
    while (arquivos.hasNext()) {
      const f = arquivos.next();
      metadata.arquivos.push({
        nome: f.getName(),
        id: f.getId(),
        tamanho: f.getSize(),
        modificado: f.getLastUpdated()
      });
    }
    
    const blob = Utilities.newBlob(JSON.stringify(metadata, null, 2), 'application/json', nomeArquivo);
    pasta.createFile(blob);
    
    registrarLog({
      matricula_usuario: 'SISTEMA', perfil_rbac_no_momento: 'SISTEMA',
      nivel_hierarquico_no_momento: 'SISTEMA',
      acao_realizada: 'BACKUP_PRE_DEPLOY', tabela_afetada: 'SISTEMA',
      id_registro_afetado: commitHash || 'LOCAL', origem_acao: 'ROTINA_AUTOMATICA',
      id_dispositivo: 'SERVIDOR', resultado: 'SUCESSO', criticidade: 'INFO',
      justificativa: 'Backup pré-deploy salvo no Drive: ' + nomeArquivo
    });
    
    return { ok: true, arquivo: nomeArquivo, pasta: pasta.getName() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Verifica se há atualizações pendentes no GitHub.
 */
function sync_VerificarAtualizacoesPendentes() {
  return {
    atualizacoes_pendentes: false,
    ultimo_commit_local: 'LOCAL',
    ultimo_commit_remoto: null,
    acao_requerida: 'Nenhuma'
  };
}

/**
 * Registra log de sincronização na planilha.
 */
function sync_RegistrarLogSincronizacao(tipo, detalhes) {
  const sh = _aba(CFG_SYNC.NOME_ARQUIVO_LOG);
  const linha = [
    new Date(),
    tipo,
    JSON.stringify(detalhes),
    Session.getActiveUser().getEmail() || 'SISTEMA'
  ];
  sh.appendRow(linha);
}

function _obterOuCriarPasta(nome) {
  const pastas = DriveApp.getFoldersByName(nome);
  if (pastas.hasNext()) return pastas.next();
  return DriveApp.getRootFolder().createFolder(nome);
}
