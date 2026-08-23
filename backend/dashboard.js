/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EHS SMART ENTERPRISE · dashboard.js — v2.0
 * APIs do Dashboard Executivo (histórico, ranking, exemplares, busca).
 * 
 * DEPENDÊNCIAS:
 *   - Motor_Regras.js: _listarMentorias (necessário para api_FuncionariosExemplares)
 *   - utils.js, audit.js, rbac.js
 * ═══════════════════════════════════════════════════════════════════════════
 */

function api_HistoricoColaborador(matriculaSolicitante, matriculaAlvo) {
  const u = _exigirAcesso(matriculaSolicitante, {
    perfis: CFG.PERFIS_SENSIVEIS, nivelMinimo: 'GESTOR', contexto: 'HISTORICO_COLABORADOR'
  });

  const alvo = _obterUsuario(matriculaAlvo);
  if (!alvo) return { erro: 'Colaborador não encontrado.' };

  const escopo = _resolverEscopo(u);
  if (escopo.tipo !== 'GLOBAL' && escopo.ids_setores.indexOf(String(alvo.setor)) === -1) {
    return { erro: 'Acesso negado: colaborador fora do seu escopo.' };
  }

  const cm = CFG.COL_MOVIMENTACOES;
  const ce = CFG.COL_EQUIPAMENTOS;
  const catalogo = {};
  _lerTudo(CFG.ABAS.EQUIPAMENTOS).forEach(function (e) {
    catalogo[String(e[ce.codigo_epi - 1]).toUpperCase()] = {
      nome: e[ce.nome - 1],
      custo: Number(e[ce.custo_unitario - 1]) || 0
    };
  });

  const historico = _lerTudo(CFG.ABAS.MOVIMENTACOES).filter(function (m) {
    return String(m[cm.matricula - 1] || '').trim().toUpperCase() === String(matriculaAlvo).trim().toUpperCase();
  }).sort(function (a, b) {
    return new Date(b[cm.data_hora - 1]) - new Date(a[cm.data_hora - 1]);
  }).map(function (m) {
    const cod = String(m[cm.codigo_epi - 1] || '').toUpperCase();
    const epi = catalogo[cod] || { nome: m[cm.codigo_epi - 1], custo: 0 };
    const qtd = Number(m[cm.quantidade - 1]) || 1;
    return {
      data_hora: m[cm.data_hora - 1],
      tipo: m[cm.tipo_movimentacao - 1],
      codigo_epi: m[cm.codigo_epi - 1],
      nome_epi: epi.nome,
      quantidade: qtd,
      custo_unitario: epi.custo,
      custo_total: Math.round(epi.custo * qtd * 100) / 100,
      id_totem: m[cm.id_totem - 1],
      status_confirmacao: m[cm.status_confirmacao_totem - 1],
      perc_vida_util_aproveitada: Number(m[cm.perc_vida_util_aproveitada - 1]) || 0,
      impacto_gamificacao: m[cm.impacto_gamificacao - 1]
    };
  });

  const custoTotal = historico.reduce(function (s, m) { return s + m.custo_total; }, 0);

  registrarLog({
    matricula_usuario: u.matricula, perfil_rbac_no_momento: u.perfil_rbac,
    nivel_hierarquico_no_momento: u.nivel_hierarquico,
    acao_realizada: 'CONSULTA_SENSIVEL', tabela_afetada: 'HISTORICO_COLABORADOR',
    id_registro_afetado: matriculaAlvo, origem_acao: 'WEB_DESKTOP',
    resultado: 'SUCESSO', criticidade: 'INFO'
  });

  return {
    colaborador: { matricula: alvo.matricula, nome: alvo.nome_completo, setor: alvo.setor, funcao: alvo.funcao },
    total_movimentacoes: historico.length,
    custo_total: Math.round(custoTotal * 100) / 100,
    historico: historico
  };
}

function api_RankingGastadores(matriculaSolicitante) {
  _exigirAcesso(matriculaSolicitante, {
    perfis: CFG.PERFIS_SENSIVEIS, nivelMinimo: 'GESTOR', contexto: 'RANKING_GASTADORES'
  });

  const u = _obterUsuario(matriculaSolicitante);
  const escopo = _resolverEscopo(u);
  const cm = CFG.COL_MOVIMENTACOES;
  const ce = CFG.COL_EQUIPAMENTOS;
  const cf = CFG.COL_FUNCIONARIOS;

  const catalogo = {};
  _lerTudo(CFG.ABAS.EQUIPAMENTOS).forEach(function (e) {
    catalogo[String(e[ce.codigo_epi - 1]).toUpperCase()] = Number(e[ce.custo_unitario - 1]) || 0;
  });

  const porMatricula = {};
  const porNome = {};

  const funcionariosFiltrados = _lerTudo(CFG.ABAS.FUNCIONARIOS).filter(function (f) {
    const setor = String(f[cf.setor - 1] || '').trim().toUpperCase();
    return escopo.tipo === 'GLOBAL' || escopo.ids_setores.indexOf(setor) !== -1;
  });

  funcionariosFiltrados.forEach(function (f) {
    const mat = String(f[cf.matricula - 1] || '').trim().toUpperCase();
    if (mat) porNome[mat] = String(f[cf.nome_completo - 1] || mat);
  });

  const movimentacoesFiltradas = _lerTudo(CFG.ABAS.MOVIMENTACOES).filter(function (m) {
    const mat = String(m[cm.matricula - 1] || '').trim().toUpperCase();
    return mat && porNome[mat];
  });

  movimentacoesFiltradas.forEach(function (m) {
    const mat = String(m[cm.matricula - 1] || '').trim().toUpperCase();
    const tipo = String(m[cm.tipo_movimentacao - 1] || '').toUpperCase();
    if (tipo !== 'ENTREGA' && tipo !== 'TROCA') return;

    const cod = String(m[cm.codigo_epi - 1] || '').toUpperCase();
    const qtd = Number(m[cm.quantidade - 1]) || 1;
    const custo = (catalogo[cod] || 0) * qtd;

    if (!porMatricula[mat]) porMatricula[mat] = { custo: 0, entregas: 0, trocas: 0, trocas_negativas: 0 };
    porMatricula[mat].custo += custo;
    if (tipo === 'ENTREGA') porMatricula[mat].entregas += qtd;
    else porMatricula[mat].trocas += qtd;

    const impacto = String(m[cm.impacto_gamificacao - 1] || '').toUpperCase();
    if (impacto === 'NEGATIVO') porMatricula[mat].trocas_negativas += qtd;
  });

  const ranking = Object.keys(porMatricula).map(function (mat) {
    return {
      matricula: mat,
      nome: porNome[mat] || mat,
      custo_total: Math.round(porMatricula[mat].custo * 100) / 100,
      total_entregas: porMatricula[mat].entregas,
      total_trocas: porMatricula[mat].trocas,
      trocas_negativas: porMatricula[mat].trocas_negativas
    };
  }).sort(function (a, b) { return b.custo_total - a.custo_total; });

  return { ranking: ranking.slice(0, 25) };
}

function api_FuncionariosExemplares(matriculaSolicitante) {
  _exigirAcesso(matriculaSolicitante, {
    perfis: CFG.PERFIS_SENSIVEIS, nivelMinimo: 'GESTOR', contexto: 'FUNCIONARIOS_EXEMPLARES'
  });

  const u = _obterUsuario(matriculaSolicitante);
  const escopo = _resolverEscopo(u);
  const cm = CFG.COL_MOVIMENTACOES;
  const cf = CFG.COL_FUNCIONARIOS;

  const exemplares = [];
  const funcionarios = _lerTudo(CFG.ABAS.FUNCIONARIOS);

  const movsPorMatricula = {};
  _lerTudo(CFG.ABAS.MOVIMENTACOES).forEach(function (m) {
    const mat = String(m[cm.matricula - 1] || '').trim().toUpperCase();
    if (!mat) return;
    if (!movsPorMatricula[mat]) movsPorMatricula[mat] = [];
    movsPorMatricula[mat].push(m);
  });

  funcionarios.forEach(function (f) {
    const mat = String(f[cf.matricula - 1] || '').trim().toUpperCase();
    if (!mat) return;
    if (String(f[cf.status_efetivo - 1] || f[cf.status - 1]).toUpperCase() !== 'ATIVO') return;
    if (escopo.tipo !== 'GLOBAL' && escopo.ids_setores.indexOf(String(f[cf.setor - 1])) === -1) return;

    const movs = movsPorMatricula[mat] || [];

    let soma = 0, n = 0, neg = 0;
    movs.forEach(function (m) {
      const perc = Number(m[cm.perc_vida_util_aproveitada - 1]) || 0;
      if (perc > 0) { soma += perc; n++; }
      if (String(m[cm.impacto_gamificacao - 1] || '').toUpperCase() === 'NEGATIVO') neg++;
    });

    const conservacao = n ? Math.round((soma / n) * 10) / 10 : 0;
    if (conservacao >= 70 && neg === 0 && movs.length >= 2) {
      const usuario = _obterUsuario(f[cf.matricula - 1]);
      exemplares.push({
        matricula: mat,
        nome: usuario ? usuario.nome_completo : mat,
        conservacao_media: conservacao,
        total_movimentacoes: movs.length,
        trocas_negativas: neg,
        tipo_vinculo: usuario ? usuario.tipo_vinculo : ''
      });
    }
  });

  exemplares.sort(function (a, b) { return b.conservacao_media - a.conservacao_media; });

  const mentoresTop = _listarMentorias(escopo.ids_setores).map(function (v) {
    return {
      mentor: v.mentor,
      mentorado: v.mentorado,
      saldo_bonus_mentor: Math.round(v.saldo_bonus_mentor * 100) / 100,
      evolucao_liquida: Math.round(v.evolucao_liquida * 100) / 100
    };
  }).sort(function (a, b) { return b.saldo_bonus_mentor - a.saldo_bonus_mentor; });

  return { exemplares: exemplares.slice(0, 20), mentores_top: mentoresTop.slice(0, 15) };
}

function api_BuscarColaboradorFiltrado(matriculaSolicitante, termo) {
  const u = _exigirAcesso(matriculaSolicitante, {
    perfis: CFG.PERFIS_SENSIVEIS, nivelMinimo: 'GESTOR', contexto: 'BUSCA_COLABORADOR'
  });

  const escopo = _resolverEscopo(u);
  const cf = CFG.COL_FUNCIONARIOS;
  const termoUpper = String(termo || '').trim().toUpperCase();

  if (!termoUpper) return { resultados: [] };

  const resultados = _lerTudo(CFG.ABAS.FUNCIONARIOS).filter(function (f) {
    const mat = String(f[cf.matricula - 1] || '').trim().toUpperCase();
    const nome = String(f[cf.nome_completo - 1] || '').trim().toUpperCase();
    const cpf = String(f[cf.cpf - 1] || '').trim().toUpperCase();
    const setor = String(f[cf.setor - 1] || '').trim().toUpperCase();

    if (escopo.tipo !== 'GLOBAL' && escopo.ids_setores.indexOf(setor) === -1) return false;
    if (String(f[cf.status_efetivo - 1] || f[cf.status - 1]).toUpperCase() === 'DESLIGADO') return false;

    return mat.indexOf(termoUpper) !== -1 ||
           nome.indexOf(termoUpper) !== -1 ||
           cpf.indexOf(termoUpper) !== -1;
  }).map(function (f) {
    const usuario = _obterUsuario(f[cf.matricula - 1]);
    return {
      matricula: f[cf.matricula - 1],
      nome: usuario ? usuario.nome_completo : f[cf.nome_completo - 1],
      cpf: f[cf.cpf - 1],
      setor: f[cf.setor - 1],
      funcao: f[cf.funcao - 1],
      perfil_rbac: f[cf.perfil_rbac - 1],
      nivel_hierarquico: f[cf.nivel_hierarquico - 1],
      tipo_vinculo: f[cf.tipo_vinculo - 1]
    };
  }).slice(0, 50);

  return { resultados: resultados };
}
