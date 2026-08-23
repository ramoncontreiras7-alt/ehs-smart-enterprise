/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EHS SMART ENTERPRISE · auth.js — v2.0
 * Autenticação híbrida (sessão Google + matrícula explícita).
 * ═══════════════════════════════════════════════════════════════════════════
 */

function _resolverSolicitante(params) {
  const tentativas = [];

  const matriculaParam = String(params.matriculaSolicitante || '').trim();
  if (matriculaParam) tentativas.push({ tipo: 'MATRICULA_EXPLICITA', valor: matriculaParam });

  let emailSessao = '';
  try {
    emailSessao = Session.getActiveUser().getEmail() || '';
  } catch (e) { emailSessao = ''; }
  if (emailSessao) tentativas.push({ tipo: 'SESSAO_GOOGLE_WORKSPACE', valor: emailSessao });

  const emailParam = String(params.loginEmail || '').trim().toLowerCase();
  if (emailParam && emailParam !== emailSessao.toLowerCase()) {
    tentativas.push({ tipo: 'EMAIL_FALLBACK', valor: emailParam });
  }

  for (let i = 0; i < tentativas.length; i++) {
    const t = tentativas[i];
    let u = null;

    if (t.tipo === 'MATRICULA_EXPLICITA') {
      u = _obterUsuario(t.valor);
    } else {
      const c = CFG.COL_FUNCIONARIOS;
      const alvo = t.valor.toLowerCase();
      const dados = _lerTudo(CFG.ABAS.FUNCIONARIOS);
      for (let j = 0; j < dados.length; j++) {
        if (String(dados[j][c.email_corporativo - 1] || '').trim().toLowerCase() === alvo) {
          u = _obterUsuario(dados[j][c.matricula - 1]);
          break;
        }
      }
    }

    if (u && String(u.status_efetivo).toUpperCase() === 'ATIVO') {
      return { ok: true, usuario: u, origem: t.tipo };
    }
  }

  return {
    ok: false,
    resposta: {
      autenticado: false,
      erro: 'Não foi possível identificar o solicitante. ' +
            'Informe matrícula ou use uma conta com cadastro ativo no sistema.'
    }
  };
}

function obterContextoUsuario(matriculaSolicitante) {
  const matricula = String(matriculaSolicitante || '').trim();

  if (!matricula) return obterContextoUsuarioSessao();

  const u = _obterUsuario(matricula);

  if (!u) {
    registrarLog({
      matricula_usuario: matricula,
      acao_realizada: 'LOGIN_FALHOU', tabela_afetada: CFG.ABAS.FUNCIONARIOS,
      id_registro_afetado: matricula, origem_acao: 'TOTEM',
      resultado: 'ERRO', criticidade: 'AVISO',
      justificativa: 'Matrícula não encontrada ao carregar contexto'
    });
    return { autenticado: false, erro: 'Matrícula não encontrada.' };
  }

  return _montarContexto(u, 'MATRICULA_EXPLICITA');
}

function obterContextoUsuarioSessao() {
  let email;
  try {
    email = Session.getActiveUser().getEmail();
  } catch (erro) {
    email = '';
  }

  if (!email) {
    registrarLog({
      matricula_usuario: 'DESCONHECIDO', acao_realizada: 'LOGIN_FALHOU',
      tabela_afetada: CFG.ABAS.FUNCIONARIOS, origem_acao: 'WEB_DESKTOP',
      resultado: 'ERRO', criticidade: 'AVISO',
      justificativa: 'Session.getActiveUser().getEmail() vazio — verificar ' +
                     'configuração de implantação (deve ser "usuário que acessa" ' +
                     'acesso restrito ao domínio)'
    });
    return {
      autenticado: false,
      erro: 'Não foi possível identificar sua conta Google. Confirme que está ' +
            'logado com o e-mail corporativo e que a implantação do app ' +
            'está restrita ao domínio da empresa.'
    };
  }

  const u = _obterUsuarioPorEmail(email);
  if (!u) {
    registrarLog({
      matricula_usuario: 'DESCONHECIDO', acao_realizada: 'LOGIN_FALHOU',
      tabela_afetada: CFG.ABAS.FUNCIONARIOS, origem_acao: 'WEB_DESKTOP',
      resultado: 'ERRO', criticidade: 'AVISO',
      justificativa: 'E-mail de sessão sem cadastro correspondente: ' + email
    });
    return {
      autenticado: false,
      erro: 'Sua conta (' + email + ') não está vinculada a nenhum cadastro ' +
            'de funcionário. Contate o Admin para preencher o e-mail corporativo.'
    };
  }

  return _montarContexto(u, 'SESSAO_GOOGLE_WORKSPACE');
}

function _montarContexto(u, origemIdentificacao) {
  if (String(u.status_efetivo).toUpperCase() !== 'ATIVO') {
    registrarLog({
      matricula_usuario: u.matricula, perfil_rbac_no_momento: u.perfil_rbac,
      nivel_hierarquico_no_momento: u.nivel_hierarquico,
      acao_realizada: 'LOGIN_FALHOU', tabela_afetada: CFG.ABAS.FUNCIONARIOS,
      id_registro_afetado: u.matricula, origem_acao: 'WEB_DESKTOP',
      resultado: 'NEGADO_REGRA', criticidade: 'AVISO',
      justificativa: 'Contexto solicitado por usuário ' + u.status_efetivo +
                     ' (origem: ' + origemIdentificacao + ')'
    });
    return {
      autenticado: false,
      erro: 'Acesso bloqueado: ' + (u.motivo_bloqueio_automatico || u.status_efetivo)
    };
  }

  const escopo = _resolverEscopo(u);
  const h = CFG.HIERARQUIA[u.nivel_hierarquico];

  const permissoes = {
    ve_dashboard_gestor: CFG.PERFIS_SENSIVEIS.indexOf(u.perfil_rbac) !== -1,
    opera_totem: CFG.PERFIS_ALMOXARIFADO.indexOf(u.perfil_rbac) !== -1,
    abre_investigacao_rca: CFG.PERFIS_INVESTIGACAO.indexOf(u.perfil_rbac) !== -1,
    estorna_movimentacao: CFG.PERFIS_INVESTIGACAO.indexOf(u.perfil_rbac) !== -1,
    participa_gamificacao: u.tipo_vinculo === 'NATIVO',
    escopo_visao: escopo.tipo,
    ve_dado_nominal_sensivel: escopo.ve_dado_nominal_sensivel,
    ve_painel_diretoria: h.peso >= CFG.HIERARQUIA.DIRETORIA.peso,
    altera_nivel_hierarquico: u.perfil_rbac === 'ADMIN' &&
                               u.nivel_hierarquico === 'MASTER_ADMIN'
  };

  const avisos = [];
  if (u.nivel_rebaixado_por_inconsistencia) {
    avisos.push('Combinação de perfil e nível inválida no cadastro. ' +
                'Acesso temporariamente restringido ao nível ' + u.nivel_hierarquico +
                '. Contate o Admin.');
  }

  registrarLog({
    matricula_usuario: u.matricula, perfil_rbac_no_momento: u.perfil_rbac,
    nivel_hierarquico_no_momento: u.nivel_hierarquico,
    acao_realizada: 'LOGIN', tabela_afetada: CFG.ABAS.FUNCIONARIOS,
    id_registro_afetado: u.matricula, origem_acao: 'WEB_DESKTOP', resultado: 'SUCESSO'
  });

  return {
    autenticado: true,
    matricula: u.matricula,
    nome_completo: u.nome_completo,
    tipo_vinculo: u.tipo_vinculo,
    setor: u.setor,
    funcao: u.funcao,
    perfil_rbac: u.perfil_rbac,
    nivel_hierarquico: u.nivel_hierarquico,
    permissoes: permissoes,
    setores_visiveis: escopo.setores,
    avisos: avisos,
    versao_sistema: CFG.VERSAO,
    origem_identificacao: origemIdentificacao
  };
}
