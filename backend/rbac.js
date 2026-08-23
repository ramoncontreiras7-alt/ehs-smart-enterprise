/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EHS SMART ENTERPRISE · rbac.js — v2.0
 * Controle de acesso bidimensional (perfil_rbac + nivel_hierarquico).
 * ═══════════════════════════════════════════════════════════════════════════
 */

function _obterUsuario(matricula) {
  const r = _buscarLinha(CFG.ABAS.FUNCIONARIOS, CFG.COL_FUNCIONARIOS.matricula, matricula);
  if (!r) return null;
  const c = CFG.COL_FUNCIONARIOS;

  const perfil = String(r.dados[c.perfil_rbac - 1] || '').trim().toUpperCase();

  let nivel = String(r.dados[c.nivel_hierarquico - 1] || '').trim().toUpperCase();
  if (!CFG.HIERARQUIA[nivel]) nivel = _nivelPadraoPara(perfil);

  const combinacoesOk = CFG.COMBINACOES_VALIDAS[nivel] || [];
  let rebaixado = false;
  if (combinacoesOk.indexOf(perfil) === -1) {
    nivel = _nivelPadraoPara(perfil);
    rebaixado = true;
  }

  return {
    matricula: r.dados[c.matricula - 1],
    nome_completo: r.dados[c.nome_completo - 1],
    tipo_vinculo: r.dados[c.tipo_vinculo - 1],
    empresa: r.dados[c.empresa - 1],
    setor: r.dados[c.setor - 1],
    funcao: r.dados[c.funcao - 1],
    perfil_rbac: perfil,
    nivel_hierarquico: nivel,
    nivel_rebaixado_por_inconsistencia: rebaixado,
    unidades_visiveis: _listar(r.dados[c.unidades_visiveis - 1]),
    id_gestor: r.dados[c.id_gestor - 1],
    data_fim_contrato: r.dados[c.data_fim_contrato - 1],
    status: r.dados[c.status - 1],
    status_efetivo: r.dados[c.status_efetivo - 1] || r.dados[c.status - 1],
    motivo_bloqueio_automatico: r.dados[c.motivo_bloqueio_automatico - 1] ||
                                r.dados[c.motivo_bloqueio - 1] || '',
    linha: r.linha
  };
}

function _obterUsuarioPorEmail(email) {
  if (!email) return null;
  const c = CFG.COL_FUNCIONARIOS;
  const alvo = String(email).trim().toLowerCase();
  const dados = _lerTudo(CFG.ABAS.FUNCIONARIOS);

  for (let i = 0; i < dados.length; i++) {
    const emailLinha = String(dados[i][c.email_corporativo - 1] || '').trim().toLowerCase();
    if (emailLinha && emailLinha === alvo) {
      return _obterUsuario(dados[i][c.matricula - 1]);
    }
  }
  return null;
}

function _nivelPadraoPara(perfil) {
  if (perfil === 'ADMIN') return 'MASTER_ADMIN';
  if (perfil === 'GESTOR' || perfil === 'SST') return 'GESTOR';
  return 'OPERACIONAL';
}

function _peso(nivel) {
  const h = CFG.HIERARQUIA[nivel];
  return h ? h.peso : 0;
}

function _veDadoNominalSensivel(usuario) {
  if (!usuario) return false;
  const h = CFG.HIERARQUIA[usuario.nivel_hierarquico];
  return !!(h && h.ve_dado_nominal_sensivel);
}

function _exigirAcesso(matriculaSolicitante, opcoes) {
  const contexto = opcoes.contexto || 'RECURSO_NAO_IDENTIFICADO';
  const u = _obterUsuario(matriculaSolicitante);

  if (!u) {
    registrarLog({
      matricula_usuario: matriculaSolicitante || 'DESCONHECIDO', acao_realizada: 'CONSULTA_SENSIVEL',
      tabela_afetada: contexto, resultado: 'NEGADO_RBAC', criticidade: 'AVISO',
      justificativa: 'Matrícula não cadastrada'
    });
    throw new Error('Acesso negado: usuário não identificado.');
  }

  if (String(u.status_efetivo || u.status || '').toUpperCase() !== 'ATIVO') {
    _negar(u, contexto, 'Usuário com status ' + (u.status_efetivo || u.status));
  }

  if (opcoes.perfis && opcoes.perfis.indexOf(u.perfil_rbac) === -1) {
    _negar(u, contexto, 'Perfil ' + u.perfil_rbac + ' sem permissão operacional');
  }

  if (opcoes.nivelMinimo && _peso(u.nivel_hierarquico) < _peso(opcoes.nivelMinimo)) {
    _negar(u, contexto, 'Nível ' + u.nivel_hierarquico +
                        ' abaixo do mínimo exigido (' + opcoes.nivelMinimo + ')');
  }

  if (u.nivel_rebaixado_por_inconsistencia) {
    registrarLog({
      matricula_usuario: u.matricula, perfil_rbac_no_momento: u.perfil_rbac,
      nivel_hierarquico_no_momento: u.nivel_hierarquico,
      acao_realizada: 'ALTERACAO_PERMISSAO', tabela_afetada: CFG.ABAS.FUNCIONARIOS,
      id_registro_afetado: u.matricula, resultado: 'NEGADO_RBAC', criticidade: 'CRITICO',
      justificativa: 'Combinação perfil/nível inválida na base. Nível rebaixado para ' +
                     u.nivel_hierarquico + '. Verificar cadastro.'
    });
  }

  return u;
}

function _negar(u, contexto, motivo) {
  registrarLog({
    matricula_usuario: u ? u.matricula : 'DESCONHECIDO',
    perfil_rbac_no_momento: u ? u.perfil_rbac : 'SISTEMA',
    nivel_hierarquico_no_momento: u ? u.nivel_hierarquico : 'SISTEMA',
    acao_realizada: 'CONSULTA_SENSIVEL', tabela_afetada: contexto,
    resultado: 'NEGADO_RBAC', criticidade: 'AVISO', justificativa: motivo
  });
  throw new Error('Acesso negado: ' + motivo + '.');
}

function _resolverEscopo(usuario) {
  const cs = CFG.COL_SETORES;
  const setores = _lerTudo(CFG.ABAS.SETORES).filter(function (s) {
    return s[cs.id_setor - 1] && String(s[cs.status - 1]).toUpperCase() === 'ATIVO';
  });

  const nivelHierarquico = usuario ? String(usuario.nivel_hierarquico || '').toUpperCase() : '';
  const escopoDef = CFG.HIERARQUIA[nivelHierarquico];
  const escopo = escopoDef ? escopoDef.escopo : 'PROPRIO';
  let visiveis;

  if (escopo === 'GLOBAL') {
    const unidades = usuario ? _listar(usuario.unidades_visiveis) : [];
    visiveis = unidades.length
      ? setores.filter(function (s) {
          return unidades.indexOf(String(s[cs.id_unidade - 1])) !== -1;
        })
      : setores;

  } else if (escopo === 'SETORIAL') {
    const matricula = usuario ? String(usuario.matricula) : '';
    visiveis = setores.filter(function (s) {
      return String(s[cs.id_gestor_responsavel - 1]) === matricula ||
             String(s[cs.id_gestor_substituto - 1]) === matricula;
    });
    if (!visiveis.length && usuario) {
      visiveis = setores.filter(function (s) {
        return String(s[cs.id_setor - 1]) === String(usuario.setor);
      });
    }

  } else {
    const setor = usuario ? String(usuario.setor) : '';
    visiveis = setores.filter(function (s) {
      return String(s[cs.id_setor - 1]) === setor;
    });
  }

  return {
    tipo: escopo,
    apenas_proprios_dados: escopo === 'PROPRIO',
    ve_dado_nominal_sensivel: _veDadoNominalSensivel(usuario),
    setores: visiveis.map(function (s) {
      return {
        id_setor: s[cs.id_setor - 1],
        nome_setor: s[cs.nome_setor - 1],
        id_unidade: s[cs.id_unidade - 1],
        centro_custo: s[cs.centro_custo - 1],
        nivel_criticidade: s[cs.nivel_criticidade - 1]
      };
    }),
    ids_setores: visiveis.map(function (s) { return String(s[cs.id_setor - 1]); })
  };
}

function api_MinhasPermissoes(matricula) {
  const u = _obterUsuario(matricula);
  if (!u) return { erro: 'Matrícula não cadastrada.' };
  const escopo = _resolverEscopo(u);
  return {
    matricula: u.matricula, nome: u.nome_completo,
    perfil_rbac: u.perfil_rbac,
    nivel_hierarquico: u.nivel_hierarquico,
    rebaixado_por_inconsistencia: u.nivel_rebaixado_por_inconsistencia,
    escopo: escopo.tipo,
    setores_visiveis: escopo.setores.length,
    ve_dado_nominal_sensivel: escopo.ve_dado_nominal_sensivel
  };
}
