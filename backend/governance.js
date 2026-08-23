/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EHS SMART ENTERPRISE · governance.js — v2.0
 * Governança Master_ADMIN e Marco de Versão.
 * ═══════════════════════════════════════════════════════════════════════════
 */

function api_AlterarNivelHierarquico(matriculaAlvo, novoNivel, justificativa, matriculaSolicitante) {
  const solicitante = _exigirAcesso(matriculaSolicitante, {
    perfis: ['ADMIN'], nivelMinimo: 'MASTER_ADMIN', contexto: 'ALTERACAO_NIVEL_HIERARQUICO'
  });

  if (!CFG.HIERARQUIA[novoNivel]) return { ok: false, erro: 'Nível inexistente: ' + novoNivel };
  if (!justificativa || String(justificativa).trim().length < 10) {
    return { ok: false, erro: 'Justificativa obrigatória (mínimo 10 caracteres).' };
  }

  const alvo = _obterUsuario(matriculaAlvo);
  if (!alvo) return { ok: false, erro: 'Matrícula não cadastrada: ' + matriculaAlvo };

  const combinacoesOk = CFG.COMBINACOES_VALIDAS[novoNivel] || [];
  if (combinacoesOk.indexOf(alvo.perfil_rbac) === -1) {
    return {
      ok: false,
      erro: 'Combinação inválida: perfil ' + alvo.perfil_rbac +
            ' não pode ter nível ' + novoNivel + '. Permitidos: ' + combinacoesOk.join(', ') + '.'
    };
  }

  if (alvo.nivel_hierarquico === 'MASTER_ADMIN' && novoNivel !== 'MASTER_ADMIN') {
    if (_contarMasterAdmins() <= 1) {
      return { ok: false, erro: 'Operação negada: este é o único MASTER_ADMIN ativo.' };
    }
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(CFG.TIMEOUT_LOCK);
  try {
    _aba(CFG.ABAS.FUNCIONARIOS)
      .getRange(alvo.linha, CFG.COL_FUNCIONARIOS.nivel_hierarquico)
      .setValue(novoNivel);

    _gravarLogSemTrava({
      matricula_usuario: solicitante.matricula,
      perfil_rbac_no_momento: solicitante.perfil_rbac,
      nivel_hierarquico_no_momento: solicitante.nivel_hierarquico,
      acao_realizada: 'ALTERACAO_PERMISSAO', tabela_afetada: CFG.ABAS.FUNCIONARIOS,
      id_registro_afetado: matriculaAlvo, origem_acao: 'WEB_DESKTOP',
      resultado: 'SUCESSO', criticidade: 'CRITICO', justificativa: justificativa,
      valor_anterior: JSON.stringify({ nivel_hierarquico: alvo.nivel_hierarquico }),
      valor_novo: JSON.stringify({ nivel_hierarquico: novoNivel })
    });

    return { ok: true, matricula: matriculaAlvo, nivel_anterior: alvo.nivel_hierarquico, nivel_novo: novoNivel };
  } finally {
    lock.releaseLock();
  }
}

function _contarMasterAdmins() {
  const c = CFG.COL_FUNCIONARIOS;
  return _lerTudo(CFG.ABAS.FUNCIONARIOS).filter(function (f) {
    return String(f[c.nivel_hierarquico - 1]).toUpperCase() === 'MASTER_ADMIN' &&
           String(f[c.status_efetivo - 1] || f[c.status - 1]).toUpperCase() === 'ATIVO';
  }).length;
}

function api_AuditarMatrizPermissoes(matriculaSolicitante) {
  _exigirAcesso(matriculaSolicitante, {
    perfis: ['ADMIN', 'SST'], nivelMinimo: 'DIRETORIA', contexto: 'AUDITORIA_PERMISSOES'
  });

  const c = CFG.COL_FUNCIONARIOS;
  const inconsistencias = [];

  _lerTudo(CFG.ABAS.FUNCIONARIOS).forEach(function (f) {
    const mat = f[c.matricula - 1];
    if (!mat) return;

    const perfil = String(f[c.perfil_rbac - 1]).toUpperCase();
    const nivel = String(f[c.nivel_hierarquico - 1] || '').toUpperCase();
    const vinculo = String(f[c.tipo_vinculo - 1]).toUpperCase();

    if (!nivel) {
      inconsistencias.push(mat + ': nível hierárquico em branco.');
    } else if (!CFG.HIERARQUIA[nivel]) {
      inconsistencias.push(mat + ': nível "' + nivel + '" não existe.');
    } else if ((CFG.COMBINACOES_VALIDAS[nivel] || []).indexOf(perfil) === -1) {
      inconsistencias.push(mat + ': combinação inválida ' + perfil + ' + ' + nivel + '.');
    }

    if (vinculo === 'TERCEIRIZADO' && perfil !== 'TERCEIRIZADO') {
      inconsistencias.push(mat + ': terceirizado com perfil ' + perfil + '.');
    }
    if (vinculo === 'TERCEIRIZADO' && nivel !== 'OPERACIONAL') {
      inconsistencias.push(mat + ': terceirizado com nível ' + nivel + '.');
    }
  });

  const masters = _contarMasterAdmins();
  if (masters === 0) inconsistencias.push('CRÍTICO: nenhum MASTER_ADMIN ativo na base.');
  if (masters > 3)   inconsistencias.push('ATENÇÃO: ' + masters + ' MASTER_ADMIN ativos. Revisar.');

  return { conforme: inconsistencias.length === 0, master_admins_ativos: masters, inconsistencias: inconsistencias };
}

function registrarMigracaoVersao(matriculaResponsavel, observacao) {
  const u = _exigirAcesso(matriculaResponsavel, {
    perfis: ['ADMIN'], nivelMinimo: 'MASTER_ADMIN', contexto: 'MIGRACAO_VERSAO'
  });

  const idLog = registrarLog({
    matricula_usuario: u.matricula, perfil_rbac_no_momento: u.perfil_rbac,
    nivel_hierarquico_no_momento: u.nivel_hierarquico,
    acao_realizada: 'AJUSTE_PARAMETRO', tabela_afetada: 'SISTEMA',
    id_registro_afetado: 'VERSAO_' + CFG.VERSAO, origem_acao: 'WEB_DESKTOP',
    resultado: 'SUCESSO', criticidade: 'CRITICO',
    justificativa: 'Entrada em produção da versão ' + CFG.VERSAO +
                   ' (RBAC bidimensional: perfil_rbac + nivel_hierarquico). ' +
                   (observacao || '')
  });

  return { ok: true, versao: CFG.VERSAO, id_log_marco: idLog, autorizado_por: u.matricula };
}
