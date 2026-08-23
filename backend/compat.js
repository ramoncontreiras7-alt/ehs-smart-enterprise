/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EHS SMART ENTERPRISE · compat.js — v2.0
 * Funções de compatibilidade com Index.html / Setor_Almoxarifado v2.9
 * ═══════════════════════════════════════════════════════════════════════════
 */

function api_AutenticarComSenha(identificador, senhaPura) {
  const dados = _lerTudo(CFG.ABAS.FUNCIONARIOS);
  const c = CFG.COL_FUNCIONARIOS;
  const alvo = String(identificador || '').trim().toUpperCase();

  for (let i = 0; i < dados.length; i++) {
    const matricula = String(dados[i][c.matricula - 1] || '').trim().toUpperCase();
    const email = String(dados[i][c.email_corporativo - 1] || '').trim().toLowerCase();

    if (matricula !== alvo && email !== alvo.toLowerCase()) continue;

    const senhaHashGravada = String(dados[i][c.senha_hash - 1] || '').trim();
    const saltGravado = String(dados[i][c.salt - 1] || '').trim();

    if (senhaHashGravada && saltGravado && senhaHashGravada === _sha256(senhaPura + saltGravado)) {
      const u = _obterUsuario(dados[i][c.matricula - 1]);
      registrarLog({
        matricula_usuario: u.matricula, perfil_rbac_no_momento: u.perfil_rbac,
        nivel_hierarquico_no_momento: u.nivel_hierarquico,
        acao_realizada: 'LOGIN', tabela_afetada: CFG.ABAS.FUNCIONARIOS,
        id_registro_afetado: u.matricula, origem_acao: 'WEB_DESKTOP',
        resultado: 'SUCESSO', criticidade: 'INFO'
      });
      return { ok: true, contexto: _criarContextoCompat(u) };
    }

    if (senhaHashGravada === String(senhaPura).trim() && senhaHashGravada !== '') {
      const u = _obterUsuario(dados[i][c.matricula - 1]);
      registrarLog({
        matricula_usuario: u.matricula, perfil_rbac_no_momento: u.perfil_rbac,
        nivel_hierarquico_no_momento: u.nivel_hierarquico,
        acao_realizada: 'LOGIN', tabela_afetada: CFG.ABAS.FUNCIONARIOS,
        id_registro_afetado: u.matricula, origem_acao: 'WEB_DESKTOP',
        resultado: 'AVISO', criticidade: 'AVISO',
        justificativa: 'Autenticado via senha em texto plano. Rehash para SHA-256 pendente.'
      });
      return { ok: true, contexto: _criarContextoCompat(u), rehash_necessario: true };
    }
  }

  return { ok: false, erro: 'Usuário não encontrado.' };
}

function _criarContextoCompat(u) {
  const escopo = _resolverEscopo(u);
  return {
    matricula: u.matricula,
    nome_completo: u.nome_completo,
    tipo_vinculo: u.tipo_vinculo,
    setor: u.setor,
    funcao: u.funcao,
    perfil_rbac: u.perfil_rbac,
    nivel_hierarquico: u.nivel_hierarquico,
    permissoes: {
      acessoAlmoxarifado: CFG.PERFIS_ALMOXARIFADO.indexOf(u.perfil_rbac) !== -1,
      ve_dashboard_gestor: CFG.PERFIS_SENSIVEIS.indexOf(u.perfil_rbac) !== -1,
      abre_investigacao_rca: CFG.PERFIS_INVESTIGACAO.indexOf(u.perfil_rbac) !== -1,
      estorna_movimentacao: CFG.PERFIS_INVESTIGACAO.indexOf(u.perfil_rbac) !== -1,
      ve_painel_diretoria: CFG.HIERARQUIA[u.nivel_hierarquico].peso >= CFG.HIERARQUIA.DIRETORIA.peso
    },
    setores_visiveis: escopo.setores,
    avisos: u.nivel_rebaixado_por_inconsistencia
      ? ['Combinação perfil/nível inválida. Contate o Admin.']
      : []
  };
}

function api_CadastrarNovoEPI(codigo, nome, estoque, pontoPedido) {
  try {
    const sh = _aba(CFG.ABAS.EQUIPAMENTOS);
    const ce = CFG.COL_EQUIPAMENTOS;
    const linha = new Array(ce.status_item).fill('');
    linha[ce.codigo_epi - 1]   = String(codigo || '').trim().toUpperCase();
    linha[ce.nome - 1]         = String(nome || '').trim();
    linha[ce.categoria - 1]    = 'PADRAO';
    linha[ce.numero_ca - 1]    = 'N/A';
    linha[ce.validade_ca - 1]  = null;
    linha[ce.status_ca - 1]    = 'ATIVO';
    linha[ce.vida_util_dias - 1] = 0;
    linha[ce.exige_higienizacao - 1] = 'NAO';
    linha[ce.unidade_medida - 1] = 'UN';
    linha[ce.estoque_atual - 1] = Number(estoque) || 0;
    linha[ce.ponto_pedido - 1]  = Number(pontoPedido) || 0;
    linha[ce.estoque_seguranca - 1] = 0;
    linha[ce.status_estoque - 1] = 'NORMAL';
    linha[ce.status_item - 1]   = 'ATIVO';

    sh.appendRow(linha);
    registrarLog({
      matricula_usuario: 'SISTEMA', acao_realizada: 'CADASTRO_EPI',
      tabela_afetada: CFG.ABAS.EQUIPAMENTOS, id_registro_afetado: codigo,
      origem_acao: 'WEB_DESKTOP', resultado: 'SUCESSO', criticidade: 'INFO',
      valor_novo: JSON.stringify({ nome: nome, estoque: estoque })
    });
    return { ok: true, mensagem: 'Item cadastrado com sucesso!' };
  } catch (err) {
    console.error('api_CadastrarNovoEPI:', err);
    return { ok: false, erro: 'Falha ao cadastrar EPI: ' + err.message };
  }
}

function api_RegistrarSaidaEPI(matricula, codigoEPI, quantidade, motivo) {
  try {
    const ce = CFG.COL_EQUIPAMENTOS;
    const cm = CFG.COL_MOVIMENTACOES;
    const shMov = _aba(CFG.ABAS.MOVIMENTACOES);
    const shEst = _aba(CFG.ABAS.EQUIPAMENTOS);

    const res = _buscarLinha(CFG.ABAS.EQUIPAMENTOS, ce.codigo_epi, codigoEPI);
    if (!res) return { ok: false, erro: 'EPI não encontrado: ' + codigoEPI };

    const estoqueAtual = Number(res.dados[ce.estoque_atual - 1] || 0);
    const qtd = Number(quantidade) || 1;
    if (estoqueAtual < qtd) return { ok: false, erro: 'Estoque insuficiente!' };

    const agora = new Date();
    const idMov = 'MOV-' + Utilities.formatDate(agora, Session.getScriptTimeZone(), 'yyyyMMdd') + '-' +
      ('0000' + shMov.getLastRow()).slice(-4);

    shMov.appendRow([
      idMov, agora, matricula, codigoEPI, 'SAIDA', qtd,
      motivo || 'Baixa via Painel', res.dados[ce.numero_ca - 1], 'LOTE_PADRAO',
      agora, 0, 0, 'CONFIRMADO', '', agora, '', 'ALMOX', '', null, 0, ''
    ]);

    shEst.getRange(res.linha, ce.estoque_atual).setValue(estoqueAtual - qtd);
    registrarLog({
      matricula_usuario: matricula || 'SISTEMA', acao_realizada: 'SAIDA_EPI',
      tabela_afetada: CFG.ABAS.MOVIMENTACOES, id_registro_afetado: idMov,
      origem_acao: 'WEB_DESKTOP', resultado: 'SUCESSO', criticidade: 'INFO',
      valor_novo: JSON.stringify({ codigo_epi: codigoEPI, quantidade: qtd })
    });
    return { ok: true, mensagem: 'Saída registrada com sucesso!' };
  } catch (err) {
    console.error('api_RegistrarSaidaEPI:', err);
    return { ok: false, erro: 'Falha na saída: ' + err.message };
  }
}
