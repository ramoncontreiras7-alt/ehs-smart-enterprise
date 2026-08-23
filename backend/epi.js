/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EHS SMART ENTERPRISE · epi.js — v2.0
 * API do Totem e entregas de EPI (append-only).
 * ═══════════════════════════════════════════════════════════════════════════
 */

function api_ValidarTotem(matricula, idTotem) {
  if (!_totemDentroDoLimite(idTotem)) {
    return {
      status: 'BLOQUEADO',
      nome: '—',
      motivos: ['Muitas consultas neste totem. Aguarde alguns instantes.']
    };
  }

  const v = validarColaborador(matricula);

  if (!v.pessoa) {
    registrarLog({
      matricula_usuario: 'SISTEMA', acao_realizada: 'BLOQUEIO_ATIVIDADE',
      tabela_afetada: CFG.ABAS.FUNCIONARIOS, id_registro_afetado: matricula,
      origem_acao: 'TOTEM', id_dispositivo: idTotem || 'TOTEM',
      resultado: 'NEGADO_REGRA', criticidade: 'AVISO',
      justificativa: 'Matrícula não cadastrada'
    });
    return { status: 'BLOQUEADO', nome: '—', motivos: ['Crachá não reconhecido'] };
  }

  registrarLog({
    matricula_usuario: v.pessoa.matricula,
    perfil_rbac_no_momento: v.pessoa.perfil_rbac,
    nivel_hierarquico_no_momento: v.pessoa.nivel_hierarquico,
    acao_realizada: v.liberado ? 'LOGIN' : 'BLOQUEIO_ATIVIDADE',
    tabela_afetada: CFG.ABAS.FUNCIONARIOS, id_registro_afetado: v.pessoa.matricula,
    origem_acao: 'TOTEM', id_dispositivo: idTotem || 'TOTEM',
    resultado: v.liberado ? 'SUCESSO' : 'NEGADO_REGRA',
    criticidade: v.liberado ? 'INFO' : 'CRITICO',
    justificativa: v.motivos.join(' | ')
  });

  return {
    status: v.liberado ? 'LIBERADO' : 'BLOQUEADO',
    matricula: v.pessoa.matricula,
    nome: v.pessoa.nome_completo,
    funcao: v.funcao ? v.funcao.nome_funcao : '',
    setor: v.setor ? v.setor.nome_setor : '',
    tipo_vinculo: v.pessoa.tipo_vinculo,
    motivos: v.motivos,
    alertas: v.alertas,
    epis: v.liberado ? _listarEpisDevidos(v.funcao) : []
  };
}

function _listarEpisDevidos(funcao) {
  if (!funcao) return [];
  const ce = CFG.COL_EQUIPAMENTOS;
  const catalogo = _lerTudo(CFG.ABAS.EQUIPAMENTOS);

  const alvos = []
    .concat(funcao.epis_obrigatorios.map(function (c) { return { cod: c, exig: 'OBRIGATÓRIO' }; }))
    .concat(funcao.epis_condicionais.map(function (c) { return { cod: c, exig: 'CONDICIONAL' }; }));

  return alvos.map(function (alvo) {
    const linha = catalogo.filter(function (e) {
      return String(e[ce.codigo_epi - 1]).trim().toUpperCase() === alvo.cod.toUpperCase();
    })[0];
    if (!linha) return null;

    const statusCA = String(linha[ce.status_ca - 1]).toUpperCase();
    const estoque = Number(linha[ce.estoque_atual - 1]) || 0;
    const bloqueios = [];

    if (statusCA === 'VENCIDO') bloqueios.push('CA ' + linha[ce.numero_ca - 1] + ' vencido');
    if (String(linha[ce.status_item - 1]).toUpperCase() === 'DESCONTINUADO') bloqueios.push('Item descontinuado');
    if (estoque <= 0) bloqueios.push('Sem estoque');

    return {
      codigo_epi: linha[ce.codigo_epi - 1],
      nome: linha[ce.nome - 1],
      numero_ca: linha[ce.numero_ca - 1],
      status_ca: statusCA,
      vida_util_dias: Number(linha[ce.vida_util_dias - 1]) || 0,
      estoque_atual: estoque,
      custo_unitario: Number(linha[ce.custo_unitario - 1]) || 0,
      exigencia: alvo.exig,
      bloqueios: bloqueios,
      liberavel: bloqueios.length === 0
    };
  }).filter(function (e) { return e !== null; });
}

function api_RegistrarEntregaEPI(params) {
  const lock = LockService.getScriptLock();
  lock.waitLock(CFG.TIMEOUT_LOCK);

  try {
    const matricula = params.matricula;
    const codigoEpi = params.codigo_epi;
    const tipo = String(params.tipo_movimentacao || 'ENTREGA').toUpperCase();
    const motivo = String(params.motivo_troca || 'N/A').toUpperCase();
    const idTotem = params.id_totem || 'TOTEM';
    const responsavel = params.responsavel_almox;

    const operador = _obterUsuario(responsavel);
    if (!operador || CFG.PERFIS_ALMOXARIFADO.indexOf(operador.perfil_rbac) === -1) {
      _gravarLogSemTrava({
        matricula_usuario: responsavel, acao_realizada: 'ENTREGA_EPI',
        perfil_rbac_no_momento: operador ? operador.perfil_rbac : '',
        nivel_hierarquico_no_momento: operador ? operador.nivel_hierarquico : '',
        tabela_afetada: CFG.ABAS.MOVIMENTACOES, origem_acao: 'TOTEM',
        id_dispositivo: idTotem, resultado: 'NEGADO_RBAC', criticidade: 'AVISO',
        justificativa: 'Operador sem permissão de almoxarifado'
      });
      return { ok: false, erro: 'Operador sem permissão para registrar entregas.' };
    }

    const v = validarColaborador(matricula);
    if (!v.liberado) {
      _gravarLogSemTrava({
        matricula_usuario: responsavel, perfil_rbac_no_momento: operador.perfil_rbac,
        nivel_hierarquico_no_momento: operador.nivel_hierarquico,
        acao_realizada: 'BLOQUEIO_ATIVIDADE', tabela_afetada: CFG.ABAS.MOVIMENTACOES,
        id_registro_afetado: matricula, origem_acao: 'TOTEM', id_dispositivo: idTotem,
        resultado: 'NEGADO_REGRA', criticidade: 'CRITICO',
        justificativa: v.motivos.join(' | ')
      });
      return { ok: false, erro: 'Entrega bloqueada.', motivos: v.motivos };
    }

    const eqRow = _buscarLinha(CFG.ABAS.EQUIPAMENTOS, CFG.COL_EQUIPAMENTOS.codigo_epi, codigoEpi);
    if (!eqRow) return { ok: false, erro: 'EPI não cadastrado: ' + codigoEpi };

    const ce = CFG.COL_EQUIPAMENTOS;
    const statusCA = String(eqRow.dados[ce.status_ca - 1]).toUpperCase();
    const estoque = Number(eqRow.dados[ce.estoque_atual - 1]) || 0;
    const vidaUtil = Number(eqRow.dados[ce.vida_util_dias - 1]) || 0;
    const numeroCA = eqRow.dados[ce.numero_ca - 1];

    if (statusCA === 'VENCIDO') {
      _gravarLogSemTrava({
        matricula_usuario: responsavel, perfil_rbac_no_momento: operador.perfil_rbac,
        nivel_hierarquico_no_momento: operador.nivel_hierarquico,
        acao_realizada: 'BLOQUEIO_ATIVIDADE', tabela_afetada: CFG.ABAS.EQUIPAMENTOS,
        id_registro_afetado: codigoEpi, origem_acao: 'TOTEM', id_dispositivo: idTotem,
        resultado: 'NEGADO_REGRA', criticidade: 'CRITICO',
        justificativa: 'NR-06: CA ' + numeroCA + ' vencido'
      });
      return { ok: false, erro: 'NR-06: o CA ' + numeroCA + ' está vencido. Entrega proibida.' };
    }
    if (estoque <= 0) return { ok: false, erro: 'Sem estoque disponível para ' + codigoEpi + '.' };
    if (tipo === 'TROCA' && motivo === 'N/A') return { ok: false, erro: 'Informe o motivo da troca.' };

    const sh = _aba(CFG.ABAS.MOVIMENTACOES);
    const agora = new Date();
    const seq = sh.getLastRow();
    const idMov = 'MOV-' +
      Utilities.formatDate(agora, Session.getScriptTimeZone(), 'yyyyMMdd') + '-' +
      ('0000' + seq).slice(-4);
    const validade = new Date(agora.getTime() + vidaUtil * 86400000);
    const cm = CFG.COL_MOVIMENTACOES;

    const linha = [];
    linha[cm.id_movimentacao - 1] = idMov;
    linha[cm.data_hora - 1] = agora;
    linha[cm.matricula - 1] = v.pessoa.matricula;
    linha[cm.codigo_epi - 1] = codigoEpi;
    linha[cm.tipo_movimentacao - 1] = tipo;
    linha[cm.quantidade - 1] = Number(params.quantidade) || 1;
    linha[cm.motivo_troca - 1] = motivo;
    linha[cm.ca_no_momento - 1] = numeroCA;
    linha[cm.lote - 1] = params.lote || '';
    linha[cm.data_validade_calculada - 1] = validade;
    linha[cm.status_confirmacao_totem - 1] = 'PENDENTE';
    linha[cm.id_totem - 1] = idTotem;
    linha[cm.responsavel_almox - 1] = responsavel;
    linha[cm.observacao - 1] = params.observacao || '';

    for (let i = 0; i < cm.hash_registro; i++) if (linha[i] === undefined) linha[i] = '';
    linha[cm.hash_registro - 1] = _sha256(linha.join('|'));
    sh.appendRow(linha);

    _gravarLogSemTrava({
      matricula_usuario: responsavel, perfil_rbac_no_momento: operador.perfil_rbac,
      nivel_hierarquico_no_momento: operador.nivel_hierarquico,
      acao_realizada: tipo === 'TROCA' ? 'TROCA_EPI' : 'ENTREGA_EPI',
      tabela_afetada: CFG.ABAS.MOVIMENTACOES, id_registro_afetado: idMov,
      origem_acao: 'TOTEM', id_dispositivo: idTotem, resultado: 'SUCESSO',
      valor_novo: JSON.stringify({
        matricula: v.pessoa.matricula, codigo_epi: codigoEpi,
        ca: numeroCA, status: 'PENDENTE'
      })
    });

    return {
      ok: true, id_movimentacao: idMov, nome: v.pessoa.nome_completo,
      epi: eqRow.dados[ce.nome - 1], validade: _formatarData(validade),
      status_confirmacao_totem: 'PENDENTE'
    };

  } finally {
    lock.releaseLock();
  }
}

function api_ConfirmarRecebimento(idMovimentacao, metodo, matriculaConfirmante) {
  const lock = LockService.getScriptLock();
  lock.waitLock(CFG.TIMEOUT_LOCK);

  try {
    const r = _buscarLinha(CFG.ABAS.MOVIMENTACOES,
                           CFG.COL_MOVIMENTACOES.id_movimentacao, idMovimentacao);
    if (!r) return { ok: false, erro: 'Movimentação não encontrada.' };

    const cm = CFG.COL_MOVIMENTACOES;
    const statusAtual = String(r.dados[cm.status_confirmacao_totem - 1]).toUpperCase();
    if (statusAtual !== 'PENDENTE') {
      return { ok: false, erro: 'Esta movimentação já está como ' + statusAtual + '.' };
    }

    const dono = String(r.dados[cm.matricula - 1]).trim().toUpperCase();
    if (dono !== String(matriculaConfirmante).trim().toUpperCase()) {
      _gravarLogSemTrava({
        matricula_usuario: matriculaConfirmante, acao_realizada: 'ENTREGA_EPI',
        tabela_afetada: CFG.ABAS.MOVIMENTACOES, id_registro_afetado: idMovimentacao,
        origem_acao: 'TOTEM', resultado: 'NEGADO_REGRA', criticidade: 'CRITICO',
        justificativa: 'Tentativa de confirmar recebimento de terceiro'
      });
      return { ok: false, erro: 'A confirmação precisa ser feita pelo próprio colaborador.' };
    }

    const sh = _aba(CFG.ABAS.MOVIMENTACOES);
    const ultimaCol = sh.getLastColumn();
    const linhaCompleta = sh.getRange(r.linha, 1, 1, ultimaCol).getValues()[0];
    linhaCompleta[cm.status_confirmacao_totem - 1] = 'CONFIRMADO';
    linhaCompleta[cm.metodo_confirmacao - 1] = metodo;
    linhaCompleta[cm.timestamp_confirmacao - 1] = new Date();
    sh.getRange(r.linha, 1, 1, ultimaCol).setValues([linhaCompleta]);

    const conf = _obterUsuario(matriculaConfirmante);
    _gravarLogSemTrava({
      matricula_usuario: matriculaConfirmante,
      perfil_rbac_no_momento: conf ? conf.perfil_rbac : '',
      nivel_hierarquico_no_momento: conf ? conf.nivel_hierarquico : '',
      acao_realizada: 'ENTREGA_EPI', tabela_afetada: CFG.ABAS.MOVIMENTACOES,
      id_registro_afetado: idMovimentacao, origem_acao: 'TOTEM',
      id_dispositivo: r.dados[cm.id_totem - 1], resultado: 'SUCESSO', criticidade: 'INFO',
      valor_anterior: JSON.stringify({ status: 'PENDENTE' }),
      valor_novo: JSON.stringify({ status: 'CONFIRMADO', metodo_confirmacao: metodo })
    });

    return { ok: true, id_movimentacao: idMovimentacao, status: 'CONFIRMADO' };

  } finally {
    lock.releaseLock();
  }
}

function api_EstornarMovimentacao(idMovimentacao, justificativa, matriculaSolicitante) {
  const solicitante = _exigirAcesso(matriculaSolicitante, {
    perfis: CFG.PERFIS_INVESTIGACAO, contexto: 'ESTORNO_MOVIMENTACAO'
  });

  if (!justificativa || String(justificativa).trim().length < 10) {
    return { ok: false, erro: 'Justificativa obrigatória (mínimo 10 caracteres).' };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(CFG.TIMEOUT_LOCK);

  try {
    const r = _buscarLinha(CFG.ABAS.MOVIMENTACOES,
                           CFG.COL_MOVIMENTACOES.id_movimentacao, idMovimentacao);
    if (!r) return { ok: false, erro: 'Movimentação não encontrada.' };

    const cm = CFG.COL_MOVIMENTACOES;
    const sh = _aba(CFG.ABAS.MOVIMENTACOES);
    const agora = new Date();
    const seq = sh.getLastRow();
    const idEstorno = 'MOV-' +
      Utilities.formatDate(agora, Session.getScriptTimeZone(), 'yyyyMMdd') + '-' +
      ('0000' + seq).slice(-4);

    const linha = [];
    linha[cm.id_movimentacao - 1] = idEstorno;
    linha[cm.data_hora - 1] = agora;
    linha[cm.matricula - 1] = r.dados[cm.matricula - 1];
    linha[cm.codigo_epi - 1] = r.dados[cm.codigo_epi - 1];
    linha[cm.tipo_movimentacao - 1] = 'ESTORNO';
    linha[cm.quantidade - 1] = r.dados[cm.quantidade - 1];
    linha[cm.motivo_troca - 1] = 'N/A';
    linha[cm.ca_no_momento - 1] = r.dados[cm.ca_no_momento - 1];
    linha[cm.status_confirmacao_totem - 1] = 'CONFIRMADO';
    linha[cm.id_totem - 1] = r.dados[cm.id_totem - 1];
    linha[cm.responsavel_almox - 1] = solicitante.matricula;
    linha[cm.observacao - 1] = justificativa;
    linha[cm.id_movimentacao_estornada - 1] = idMovimentacao;

    for (let i = 0; i < cm.hash_registro; i++) if (linha[i] === undefined) linha[i] = '';
    linha[cm.hash_registro - 1] = _sha256(linha.join('|'));
    sh.appendRow(linha);

    _gravarLogSemTrava({
      matricula_usuario: solicitante.matricula,
      perfil_rbac_no_momento: solicitante.perfil_rbac,
      nivel_hierarquico_no_momento: solicitante.nivel_hierarquico,
      acao_realizada: 'ESTORNO', tabela_afetada: CFG.ABAS.MOVIMENTACOES,
      id_registro_afetado: idEstorno, origem_acao: 'WEB_DESKTOP',
      resultado: 'SUCESSO', criticidade: 'AVISO', justificativa: justificativa,
      valor_anterior: JSON.stringify({ estornando: idMovimentacao })
    });

    return { ok: true, id_estorno: idEstorno, estornou: idMovimentacao };

  } finally {
    lock.releaseLock();
  }
}

function api_ListarEstoque() {
  try {
    const dados = _lerTudo(CFG.ABAS.EQUIPAMENTOS);
    const ce = CFG.COL_EQUIPAMENTOS;
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

    return dados.map(row => {
      const rawVal = row[ce.validade_ca - 1];
      let validadeCA = rawVal instanceof Date ? new Date(rawVal.getTime()) : new Date(rawVal);
      let dias = !isNaN(validadeCA.getTime()) ? Math.round((validadeCA - hoje) / 86400000) : null;
      const estoque = Number(row[ce.estoque_atual - 1]) || 0;
      const min = Number(row[ce.ponto_pedido - 1]) || 0;
      const statusCA = String(row[ce.status_ca - 1]).toUpperCase();

      return {
        codigo: row[ce.codigo_epi - 1],
        nome: row[ce.nome - 1],
        estoque: estoque,
        pontoPedido: min,
        validade: (!isNaN(validadeCA.getTime())) ? Utilities.formatDate(validadeCA, Session.getScriptTimeZone(), 'dd/MM/yyyy') : 'N/A',
        status_ca: statusCA,
        alerta: (estoque < min) || (dias !== null && dias <= 30) || (statusCA === 'VENCIDO')
      };
    });
  } catch (err) {
    console.error('api_ListarEstoque:', err);
    return [];
  }
}

function api_ListarEstoquePorSetor(idSetor) {
  try {
    const dados = _lerTudo(CFG.ABAS.EQUIPAMENTOS);
    const ce = CFG.COL_EQUIPAMENTOS;
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

    return dados
      .filter(row => String(row[ce.localizacao_almox - 1]).trim().toUpperCase() === String(idSetor || '').trim().toUpperCase())
      .map(row => {
        const rawVal = row[ce.validade_ca - 1];
        let validadeCA = rawVal instanceof Date ? new Date(rawVal.getTime()) : new Date(rawVal);
        let dias = !isNaN(validadeCA.getTime()) ? Math.round((validadeCA - hoje) / 86400000) : null;
        return {
          codigo: row[ce.codigo_epi - 1],
          nome: row[ce.nome - 1],
          estoque: Number(row[ce.estoque_atual - 1]) || 0,
          validade: (!isNaN(validadeCA.getTime())) ? Utilities.formatDate(validadeCA, Session.getScriptTimeZone(), 'dd/MM/yyyy') : 'N/A',
          alerta: (dias !== null && dias <= 30) || String(row[ce.status_ca - 1]).toUpperCase() === 'VENCIDO'
        };
      });
  } catch (err) {
    console.error('api_ListarEstoquePorSetor:', err);
    return [];
  }
}

function _totemDentroDoLimite(idTotem) {
  const cache = CacheService.getScriptCache();
  const chave = 'rt_totem_' + (idTotem || 'DESCONHECIDO');

  const atual = Number(cache.get(chave) || 0);
  if (atual >= CFG_TOTEM.LIMITE_POR_MIN) return false;

  cache.put(chave, String(atual + 1), CFG_TOTEM.JANELA_SEG);
  return true;
}
