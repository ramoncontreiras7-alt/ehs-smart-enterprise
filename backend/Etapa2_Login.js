/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EHS SMART ENTERPRISE · Etapa 2 — Login Unificado + Modo Quiosque
 * Modernização ES6+ (arrow, template literals, const/let, for..of).
 * Reaproveita do core: CFG, _obterUsuario, _obterUsuarioPorEmail, _sha256,
 *   registrarLog, _gravarLogSemTrava, _exigirAcesso, _totemAutorizado.
 *
 * REGRA CORPORATIVA (Etapa 2 · item 1):
 *   1) MODO QUIOSQUE: o DISPOSITIVO (totem/tablet/celular) autentica sob um
 *      "E-mail Base/Master" geral da empresa. Sobre essa camada, admins,
 *      gestores e almoxarifes fazem seus acessos individuais.
 *   2) LOGIN UNIFICADO DE USUÁRIO: identificação por CREDENCIAL, CPF
 *      (eliminado RG) OU E-MAIL. Todos usam a MESMA senha do sistema
 *      (definida no primeiro acesso), guardada como SHA-256 em Script
 *      Properties — nunca em texto plano, nunca na planilha (Dossiê 6.x).
 * ═══════════════════════════════════════════════════════════════════════════
 */

const CFG_LOGIN = {
  CHAVE_SENHA_COMPARTILHADA: 'SENHA_COMPARTILHADA_HASH',   // Script Property (SHA-256 puro)
  EMAIL_BASE_MASTER: 'ehs.quiosque@empresa.com',           // E-mail Base/Master do dispositivo
  EMAIL_MASTER_ADMIN: 'ramoncontreiras7@gmail.com',        // E-mail do MASTER_ADMIN do sistema
  TAM_MIN_SENHA: 6
};

/** Lê o hash da senha compartilhada (nunca o valor puro). */
function _lerSenhaCompartilhadaHash() {
  return PropertiesService.getScriptProperties()
    .getProperty(CFG_LOGIN.CHAVE_SENHA_COMPARTILHADA) || '';
}

/**
 * Define a senha compartilhada do sistema (bootstrap de primeiro acesso).
 * Primeiro acesso (sem hash): liberado. Depois: exige MASTER_ADMIN.
 */
function api_DefinirSenhaCompartilhada(senhaPura, matriculaSolicitante) {
  const senha = String(senhaPura || '').trim();
  if (senha.length < CFG_LOGIN.TAM_MIN_SENHA) {
    return { ok: false, erro: `Senha deve ter ao menos ${CFG_LOGIN.TAM_MIN_SENHA} caracteres.` };
  }

  const existente = _lerSenhaCompartilhadaHash();
  if (existente) {
    _exigirAcesso(matriculaSolicitante, {
      perfis: ['ADMIN'], nivelMinimo: 'MASTER_ADMIN', contexto: 'DEFINIR_SENHA_SISTEMA'
    });
  }

  const hash = _sha256(senha);
  PropertiesService.getScriptProperties()
    .setProperty(CFG_LOGIN.CHAVE_SENHA_COMPARTILHADA, hash);

  registrarLog({
    matricula_usuario: matriculaSolicitante || 'SISTEMA',
    perfil_rbac_no_momento: 'SISTEMA', nivel_hierarquico_no_momento: 'SISTEMA',
    acao_realizada: 'ALTERACAO_PARAMETRO', tabela_afetada: 'SISTEMA',
    origem_acao: 'WEB_DESKTOP', resultado: 'SUCESSO', criticidade: 'CRITICO',
    justificativa: existente
      ? 'Senha compartilhada do sistema redefinida.'
      : 'Senha compartilhada do sistema definida no primeiro acesso.'
  });

  return { ok: true, definida: !existente };
}

/**
 * Verifica se a senha compartilhada existe. Se não existir, cria automaticamente
 * com o valor padrão Ehs@2026 para evitar login bloqueado no primeiro uso.
 */
function api_VerificarEGarantirSenhaCompartilhada() {
  const existente = _lerSenhaCompartilhadaHash();
  if (existente) return { ok: true, acao: 'nenhuma' };

  const hash = _sha256('Ehs@2026');
  PropertiesService.getScriptProperties()
    .setProperty(CFG_LOGIN.CHAVE_SENHA_COMPARTILHADA, hash);

  registrarLog({
    matricula_usuario: 'SISTEMA', perfil_rbac_no_momento: 'SISTEMA',
    nivel_hierarquico_no_momento: 'SISTEMA',
    acao_realizada: 'ALTERACAO_PARAMETRO', tabela_afetada: 'SISTEMA',
    origem_acao: 'WEB_DESKTOP', resultado: 'SUCESSO', criticidade: 'INFO',
    justificativa: 'Senha compartilhada inicializada automaticamente (primeiro acesso).'
  });

  return { ok: true, acao: 'inicializada', senha_padrao: 'Ehs@2026' };
}

/**
 * Altera a senha compartilhada do sistema (apenas MASTER_ADMIN).
 * Exige a senha atual para confirmação.
 */
function api_AlterarSenhaCompartilhada(senhaAtual, senhaNova, matriculaSolicitante) {
  const u = _exigirAcesso(matriculaSolicitante, {
    perfis: ['ADMIN'], nivelMinimo: 'MASTER_ADMIN', contexto: 'ALTERAR_SENHA_SISTEMA'
  });

  const senhaAtualLimpa = String(senhaAtual || '').trim();
  const senhaNovaLimpa = String(senhaNova || '').trim();

  if (senhaNovaLimpa.length < CFG_LOGIN.TAM_MIN_SENHA) {
    return { ok: false, erro: `Nova senha deve ter ao menos ${CFG_LOGIN.TAM_MIN_SENHA} caracteres.` };
  }

  const hashArmazenado = _lerSenhaCompartilhadaHash();
  if (!hashArmazenado) {
    return { ok: false, erro: 'Senha compartilhada não inicializada.' };
  }

  const hashAtualInformada = _sha256(senhaAtualLimpa);
  if (hashAtualInformada !== hashArmazenado) {
    registrarLog({
      matricula_usuario: u.matricula, perfil_rbac_no_momento: u.perfil_rbac,
      nivel_hierarquico_no_momento: u.nivel_hierarquico,
      acao_realizada: 'ALTERACAO_PARAMETRO', tabela_afetada: 'SISTEMA',
      origem_acao: 'WEB_DESKTOP', resultado: 'NEGADO_REGRA', criticidade: 'AVISO',
      justificativa: 'Tentativa de alteração de senha com senha atual incorreta.'
    });
    return { ok: false, erro: 'Senha atual incorreta.' };
  }

  const novoHash = _sha256(senhaNovaLimpa);
  PropertiesService.getScriptProperties()
    .setProperty(CFG_LOGIN.CHAVE_SENHA_COMPARTILHADA, novoHash);

  registrarLog({
    matricula_usuario: u.matricula, perfil_rbac_no_momento: u.perfil_rbac,
    nivel_hierarquico_no_momento: u.nivel_hierarquico,
    acao_realizada: 'ALTERACAO_PARAMETRO', tabela_afetada: 'SISTEMA',
    origem_acao: 'WEB_DESKTOP', resultado: 'SUCESSO', criticidade: 'CRITICO',
    justificativa: 'Senha compartilhada do sistema alterada pelo MASTER_ADMIN.'
  });

  return { ok: true, mensagem: 'Senha compartilhada alterada com sucesso.' };
}

/**
 * Resolve o usuário por CREDENCIAL (matrícula OU cartão RFID), CPF ou E-MAIL.
 * RG foi eliminado por diretriz da Etapa 2.
 */
function _identificarUsuario(ident) {
  if (!ident) return null;
  const alvo = String(ident).trim();
  const alvoUp = alvo.toUpperCase();
  const alvoLow = alvo.toLowerCase();
  const c = CFG.COL_FUNCIONARIOS;

  for (const linha of _lerTudo(CFG.ABAS.FUNCIONARIOS)) {
    const matr  = String(linha[c.matricula - 1] || '').trim().toUpperCase();
    const rfid  = String(linha[c.cartao_rfid - 1] || '').trim().toUpperCase();
    const cpf   = String(linha[c.cpf - 1] || '').trim();
    const email = String(linha[c.email_corporativo - 1] || '').trim().toLowerCase();
    if (matr === alvoUp || rfid === alvoUp || cpf === alvo || email === alvoLow) {
      return _obterUsuario(linha[c.matricula - 1]);
    }
  }
  return null;
}

/**
 * Auto-cria o MASTER_ADMIN no primeiro login se o e-mail for o do admin
 * master e não existir na base. Garante acesso imediato com a senha padrão.
 */
function _criarMasterAdminSeNecessario(email) {
  const emailLimpo = String(email || '').trim().toLowerCase();
  if (!emailLimpo) return null;

  const c = CFG.COL_FUNCIONARIOS;
  const dados = _lerTudo(CFG.ABAS.FUNCIONARIOS);

  for (let i = 0; i < dados.length; i++) {
    const emailLinha = String(dados[i][c.email_corporativo - 1] || '').trim().toLowerCase();
    if (emailLinha === emailLimpo) {
      return _obterUsuario(dados[i][c.matricula - 1]);
    }
  }

  const matriculaDesejada = '1000';
  const matriculaExiste = dados.some(function (f) {
    return String(f[c.matricula - 1] || '').trim() === matriculaDesejada;
  });
  const matricula = matriculaExiste ? 'MASTER-01' : matriculaDesejada;

  const cpf = _gerarCPF ? _gerarCPF() : '000.000.000-00';
  const linha = new Array(c.email_corporativo).fill('');
  linha[c.matricula - 1] = matricula;
  linha[c.nome_completo - 1] = 'Ramon Contreiras';
  linha[c.cpf - 1] = cpf;
  linha[c.tipo_vinculo - 1] = 'NATIVO';
  linha[c.empresa - 1] = 'Matriz';
  linha[c.setor - 1] = 'SET-01';
  linha[c.funcao - 1] = 'FUN-01';
  linha[c.perfil_rbac - 1] = 'ADMIN';
  linha[c.senha_hash - 1] = '';
  linha[c.salt - 1] = '';
  linha[c.id_gestor - 1] = '';
  linha[c.cartao_rfid - 1] = '';
  linha[c.id_biometrico - 1] = '';
  linha[c.data_admissao - 1] = new Date();
  linha[c.data_fim_contrato - 1] = '';
  linha[c.status - 1] = 'ATIVO';
  linha[c.motivo_bloqueio - 1] = '';
  linha[c.criado_em - 1] = new Date();
  linha[c.atualizado_em - 1] = new Date();
  linha[c.status_efetivo - 1] = 'ATIVO';
  linha[c.motivo_bloqueio_automatico - 1] = '';
  linha[c.nivel_hierarquico - 1] = 'MASTER_ADMIN';
  linha[c.unidades_visiveis - 1] = 'UNI-01;UNI-02';
  linha[c.email_corporativo - 1] = emailLimpo;

  const sh = _aba(CFG.ABAS.FUNCIONARIOS);
  sh.appendRow(linha);

  registrarLog({
    matricula_usuario: 'SISTEMA', perfil_rbac_no_momento: 'SISTEMA',
    nivel_hierarquico_no_momento: 'SISTEMA',
    acao_realizada: 'CADASTRO_MASSA', tabela_afetada: CFG.ABAS.FUNCIONARIOS,
    id_registro_afetado: matricula, origem_acao: 'LOGIN_AUTO_CREATE',
    resultado: 'SUCESSO', criticidade: 'CRITICO',
    justificativa: 'Master Admin auto-criado no primeiro login: ' + emailLimpo
  });

  return _obterUsuario(matricula);
}

/**
 * LOGIN UNIFICADO DE USUÁRIO. Devolve o contexto de lista branca
 * (reaproveita _montarContexto, que já registra LOGIN na auditoria).
 */
function api_LoginUnificado(identificador, senhaPura, origem) {
  const origemId = origem || 'WEB_DESKTOP';
  const identificadorLimpo = String(identificador || '').trim();
  const senhaLimpa = String(senhaPura || '').trim();

  if (!_lerSenhaCompartilhadaHash()) {
    api_VerificarEGarantirSenhaCompartilhada();
  }

  let u = _identificarUsuario(identificadorLimpo);

  if (!u && identificadorLimpo.toLowerCase() === CFG_LOGIN.EMAIL_MASTER_ADMIN.toLowerCase()) {
    u = _criarMasterAdminSeNecessario(identificadorLimpo);
  }

  if (!u) {
    registrarLog({
      matricula_usuario: 'DESCONHECIDO', acao_realizada: 'LOGIN_FALHOU',
      tabela_afetada: CFG.ABAS.FUNCIONARIOS, id_registro_afetado: String(identificadorLimpo || ''),
      origem_acao: origemId, resultado: 'ERRO', criticidade: 'AVISO',
      justificativa: 'Identificador (credencial/CPF/e-mail) não encontrado'
    });
    return { autenticado: false, erro: 'Usuário não encontrado.' };
  }

  const hashGravado = _lerSenhaCompartilhadaHash();
  if (hashGravado !== _sha256(senhaLimpa)) {
    registrarLog({
      matricula_usuario: u.matricula, perfil_rbac_no_momento: u.perfil_rbac,
      nivel_hierarquico_no_momento: u.nivel_hierarquico,
      acao_realizada: 'LOGIN_FALHOU', tabela_afetada: CFG.ABAS.FUNCIONARIOS,
      id_registro_afetado: u.matricula, origem_acao: origemId,
      resultado: 'NEGADO_REGRA', criticidade: 'AVISO', justificativa: 'Senha do sistema incorreta'
    });
    return { autenticado: false, erro: 'Senha incorreta.' };
  }

  return _montarContexto(u, origemId);
}

/**
 * MODO QUIOSQUE: autentica o DISPOSITIVO sob o E-mail Base/Master.
 * Devolve o contexto de dispositivo; o usuário real ainda precisa do
 * api_LoginUnificado por cima desta camada.
 */
function api_AutenticarDispositivo(idDispositivo, token) {
  if (!idDispositivo || !_totemAutorizado(idDispositivo, token || '')) {
    return { ok: false, dispositivoAutorizado: false, erro: 'Dispositivo não autorizado.' };
  }
  return {
    ok: true,
    dispositivoAutorizado: true,
    modo: 'QUIOUSQUE',
    emailBaseMaster: CFG_LOGIN.EMAIL_BASE_MASTER,
    idDispositivo,
    mensagem: 'Dispositivo autenticado sob o E-mail Base/Master. O usuário deve se logar individualmente.'
  };
}
