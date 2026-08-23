/**************************************************************************************************
 * EHS SMART ENTERPRISE v2.0 — SETUP DE SCHEMA (MODO DEMO)
 * Arquivo: Setup_Schema.gs
 * ------------------------------------------------------------------------------------------------
 * Reconstrói a planilha no schema v2.0 que o Code.gs espera.
 *
 * ORDEM OBRIGATÓRIA DE EXECUÇÃO — uma função por vez, conferindo o log entre elas:
 *
 *   1. setup_BackupPlanilha()        → cria cópia datada no Drive. NÃO altera nada.
 *   2. setup_CriarSchemaCompleto()   → cria as 11 abas do CFG com cabeçalhos corretos.
 *                                       Aba que já existe é PULADA, nunca sobrescrita.
 *   3. setup_SeedDemo()              → popula dados de demonstração + seu usuário ADMIN.
 *   4. diag_Schema()                 → confere que ficou tudo certo (Diagnostico_Schema.gs)
 *
 *   5. setup_RemoverAbasAntigas()    → OPCIONAL e DESTRUTIVO. Só rode depois de conferir
 *                                       que o backup do passo 1 existe no Drive.
 *
 *   6. setup_GerarTokensTotem()      → gera os tokens de autorização dos totens e
 *                                       devolve as URLs prontas. Rode depois do seed.
 *
 * O ADMIN é criado com o e-mail da conta que RODA o script (Session.getActiveUser()).
 * Não há e-mail hardcoded — se você rodar logado na conta certa, fica certo.
 **************************************************************************************************/


/* ═══════════════════════════════════════════════════════════════════════════
   PASSO 1 · BACKUP — não altera a planilha atual
═══════════════════════════════════════════════════════════════════════════ */

function setup_BackupPlanilha() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var arquivo = DriveApp.getFileById(ss.getId());

  var carimbo = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd_HHmm');
  var nomeBackup = '[BACKUP ' + carimbo + '] ' + ss.getName();

  var pasta = arquivo.getParents().hasNext() ? arquivo.getParents().next() : DriveApp.getRootFolder();
  var copia = arquivo.makeCopy(nomeBackup, pasta);

  var msg = 'BACKUP CRIADO\n' +
            '  Nome: ' + nomeBackup + '\n' +
            '  ID:   ' + copia.getId() + '\n' +
            '  URL:  ' + copia.getUrl() + '\n\n' +
            'Confira no Drive antes de seguir para o passo 2.';
  Logger.log(msg);
  return msg;
}


/* ═══════════════════════════════════════════════════════════════════════════
   PASSO 2 · CRIAR AS 11 ABAS DO CFG
   Aba existente é preservada. Só cria o que falta.
═══════════════════════════════════════════════════════════════════════════ */

function setup_CriarSchemaCompleto() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var log = [];

  // Mapa aba → objeto de colunas do CFG. A ordem dos cabeçalhos sai daqui,
  // então nunca diverge do que o Code.gs lê.
  var mapa = [
    { aba: CFG.ABAS.FUNCIONARIOS,      cols: CFG.COL_FUNCIONARIOS },
    { aba: CFG.ABAS.EQUIPAMENTOS,      cols: CFG.COL_EQUIPAMENTOS },
    { aba: CFG.ABAS.MOVIMENTACOES,     cols: CFG.COL_MOVIMENTACOES },
    { aba: CFG.ABAS.LOG,               cols: CFG.COL_LOG },
    { aba: CFG.ABAS.GAMIFICACAO,       cols: CFG.COL_GAMIFICACAO },
    { aba: CFG.ABAS.SETORES,           cols: CFG.COL_SETORES },
    { aba: CFG.ABAS.FUNCOES,           cols: CFG.COL_FUNCOES },
    { aba: CFG.ABAS.EMPRESAS,          cols: CFG.COL_EMPRESAS },
    { aba: CFG.ABAS.TREINAMENTOS,      cols: CFG.COL_TREINAMENTOS },
    { aba: CFG.ABAS.JORNADA,           cols: CFG.COL_JORNADA },
    { aba: CFG.ABAS.ACOES_PREVENTIVAS, cols: CFG.COL_ACOES_PREVENTIVAS }
  ];

  mapa.forEach(function (item) {
    var existente = ss.getSheetByName(item.aba);
    if (existente) {
      log.push('PULADA (já existe): ' + item.aba);
      return;
    }
    var sh = ss.insertSheet(item.aba);
    var cabecalhos = _setupCabecalhosDe(item.cols);
    sh.getRange(1, 1, 1, cabecalhos.length).setValues([cabecalhos]);
    sh.getRange(1, 1, 1, cabecalhos.length)
      .setFontWeight('bold')
      .setBackground('#12161A')
      .setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
    log.push('CRIADA: ' + item.aba + '  (' + cabecalhos.length + ' colunas)');
  });

  var saida = 'SCHEMA v2.0\n' + log.join('\n') +
              '\n\nPróximo passo: setup_SeedDemo()';
  Logger.log(saida);
  return saida;
}


/**
 * Converte {matricula:1, nome_completo:2, ...} no array ordenado de cabeçalhos.
 * Respeita a posição declarada, não a ordem de escrita do objeto.
 */
function _setupCabecalhosDe(cols) {
  var maior = 0;
  Object.keys(cols).forEach(function (k) { if (cols[k] > maior) maior = cols[k]; });

  var arr = new Array(maior).fill('');
  Object.keys(cols).forEach(function (k) { arr[cols[k] - 1] = k; });
  return arr;
}


/* ═══════════════════════════════════════════════════════════════════════════
   PASSO 3 · SEED DE DEMONSTRAÇÃO
   Idempotente: se a matrícula já existe, não duplica.
═══════════════════════════════════════════════════════════════════════════ */

function setup_SeedDemo() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var emailAdmin = Session.getActiveUser().getEmail();
  var agora = new Date();
  var log = [];

  if (!emailAdmin) {
    throw new Error('Não consegui ler o e-mail da sessão. Rode este script logado na conta que será ADMIN.');
  }

  /* ── SETORES ──────────────────────────────────────────────────────────── */
  log.push(_setupInserir(ss, CFG.ABAS.SETORES, CFG.COL_SETORES, 'id_setor', [
    { id_setor: 'SET-01', nome_setor: 'Produção',      centro_custo: 'CC-1001', id_unidade: 'UNI-01',
      id_gestor_responsavel: 'ADM-001', nivel_criticidade: 'ALTA',
      nrs_aplicaveis: 'NR-06;NR-12;NR-35', exige_liberacao_previa: 'SIM',
      permite_terceirizado: 'SIM', descricao_riscos: 'Máquinas rotativas, altura', status: 'ATIVO' },
    { id_setor: 'SET-02', nome_setor: 'Manutenção',    centro_custo: 'CC-1002', id_unidade: 'UNI-01',
      id_gestor_responsavel: 'ADM-001', nivel_criticidade: 'ALTA',
      nrs_aplicaveis: 'NR-06;NR-10;NR-33', exige_liberacao_previa: 'SIM',
      permite_terceirizado: 'SIM', descricao_riscos: 'Elétrica, espaço confinado', status: 'ATIVO' },
    { id_setor: 'SET-03', nome_setor: 'Logística',     centro_custo: 'CC-1003', id_unidade: 'UNI-01',
      id_gestor_responsavel: 'ADM-001', nivel_criticidade: 'MEDIA',
      nrs_aplicaveis: 'NR-06;NR-11', exige_liberacao_previa: 'NAO',
      permite_terceirizado: 'SIM', descricao_riscos: 'Empilhadeira, movimentação de carga', status: 'ATIVO' },
    { id_setor: 'SET-04', nome_setor: 'Administrativo', centro_custo: 'CC-1004', id_unidade: 'UNI-01',
      id_gestor_responsavel: 'ADM-001', nivel_criticidade: 'BAIXA',
      nrs_aplicaveis: 'NR-17', exige_liberacao_previa: 'NAO',
      permite_terceirizado: 'NAO', descricao_riscos: 'Ergonomia', status: 'ATIVO' }
  ]));

  /* ── FUNÇÕES ──────────────────────────────────────────────────────────── */
  log.push(_setupInserir(ss, CFG.ABAS.FUNCOES, CFG.COL_FUNCOES, 'id_funcao', [
    { id_funcao: 'FUN-01', nome_funcao: 'Operador de Produção', id_setor_vinculado: 'SET-01',
      cbo: '8121-05', epis_obrigatorios: 'EPI-001;EPI-002;EPI-003',
      nrs_obrigatorias: 'NR-06;NR-12', treinamentos_obrigatorios: 'NR-06;NR-12',
      atividades_criticas_permitidas: '', exige_aso_especifico: 'SIM',
      grau_exposicao_risco: 'ALTO', limite_horas_extras_mes: 40,
      elegivel_gamificacao: 'SIM', status: 'ATIVO' },
    { id_funcao: 'FUN-02', nome_funcao: 'Eletricista',          id_setor_vinculado: 'SET-02',
      cbo: '7156-10', epis_obrigatorios: 'EPI-001;EPI-004;EPI-005',
      nrs_obrigatorias: 'NR-06;NR-10', treinamentos_obrigatorios: 'NR-10;NR-33',
      atividades_criticas_permitidas: 'ELETRICA', exige_aso_especifico: 'SIM',
      grau_exposicao_risco: 'ALTO', limite_horas_extras_mes: 30,
      elegivel_gamificacao: 'SIM', status: 'ATIVO' },
    { id_funcao: 'FUN-03', nome_funcao: 'Operador de Empilhadeira', id_setor_vinculado: 'SET-03',
      cbo: '7823-05', epis_obrigatorios: 'EPI-001;EPI-002',
      nrs_obrigatorias: 'NR-06;NR-11', treinamentos_obrigatorios: 'NR-11',
      atividades_criticas_permitidas: 'EMPILHADEIRA', exige_aso_especifico: 'SIM',
      grau_exposicao_risco: 'MEDIO', limite_horas_extras_mes: 40,
      elegivel_gamificacao: 'SIM', status: 'ATIVO' },
    { id_funcao: 'FUN-04', nome_funcao: 'Analista Administrativo', id_setor_vinculado: 'SET-04',
      cbo: '4110-05', epis_obrigatorios: '',
      nrs_obrigatorias: 'NR-17', treinamentos_obrigatorios: '',
      atividades_criticas_permitidas: '', exige_aso_especifico: 'NAO',
      grau_exposicao_risco: 'BAIXO', limite_horas_extras_mes: 20,
      elegivel_gamificacao: 'NAO', status: 'ATIVO' }
  ]));

  /* ── EQUIPAMENTOS (EPI) ───────────────────────────────────────────────── */
  var caFuturo = new Date(agora.getFullYear() + 2, agora.getMonth(), agora.getDate());
  log.push(_setupInserir(ss, CFG.ABAS.EQUIPAMENTOS, CFG.COL_EQUIPAMENTOS, 'codigo_epi', [
    { codigo_epi: 'EPI-001', nome: 'Capacete de Segurança', categoria: 'PROTECAO_CABECA',
      grupo_protecao: 'CABECA', fabricante: '3M', numero_ca: '31469', validade_ca: caFuturo,
      status_ca: 'VALIDO', vida_util_dias: 1825, exige_higienizacao: 'NAO',
      periodicidade_higien_dias: '', unidade_medida: 'UN', estoque_atual: 120,
      ponto_pedido: 30, estoque_seguranca: 15, status_estoque: 'OK',
      custo_unitario: 28.90, localizacao_almox: 'A1-P1', nrs_associadas: 'NR-06', status_item: 'ATIVO' },
    { codigo_epi: 'EPI-002', nome: 'Protetor Auricular Plug', categoria: 'PROTECAO_AUDITIVA',
      grupo_protecao: 'AUDICAO', fabricante: '3M', numero_ca: '23456', validade_ca: caFuturo,
      status_ca: 'VALIDO', vida_util_dias: 180, exige_higienizacao: 'SIM',
      periodicidade_higien_dias: 30, unidade_medida: 'PAR', estoque_atual: 400,
      ponto_pedido: 100, estoque_seguranca: 50, status_estoque: 'OK',
      custo_unitario: 4.20, localizacao_almox: 'A1-P2', nrs_associadas: 'NR-06', status_item: 'ATIVO' },
    { codigo_epi: 'EPI-003', nome: 'Luva de Raspa', categoria: 'PROTECAO_MAOS',
      grupo_protecao: 'MAOS', fabricante: 'Marluvas', numero_ca: '34567', validade_ca: caFuturo,
      status_ca: 'VALIDO', vida_util_dias: 90, exige_higienizacao: 'NAO',
      periodicidade_higien_dias: '', unidade_medida: 'PAR', estoque_atual: 200,
      ponto_pedido: 60, estoque_seguranca: 30, status_estoque: 'OK',
      custo_unitario: 18.90, localizacao_almox: 'A2-P1', nrs_associadas: 'NR-06', status_item: 'ATIVO' },
    { codigo_epi: 'EPI-004', nome: 'Óculos Ampla Visão', categoria: 'PROTECAO_VISUAL',
      grupo_protecao: 'OLHOS', fabricante: '3M', numero_ca: '45678', validade_ca: caFuturo,
      status_ca: 'VALIDO', vida_util_dias: 365, exige_higienizacao: 'SIM',
      periodicidade_higien_dias: 15, unidade_medida: 'UN', estoque_atual: 150,
      ponto_pedido: 40, estoque_seguranca: 20, status_estoque: 'OK',
      custo_unitario: 12.30, localizacao_almox: 'A2-P2', nrs_associadas: 'NR-06', status_item: 'ATIVO' },
    { codigo_epi: 'EPI-005', nome: 'Botina Bico de Aço', categoria: 'PROTECAO_PES',
      grupo_protecao: 'PES', fabricante: 'Fujiwara', numero_ca: '56789', validade_ca: caFuturo,
      status_ca: 'VALIDO', vida_util_dias: 365, exige_higienizacao: 'NAO',
      periodicidade_higien_dias: '', unidade_medida: 'PAR', estoque_atual: 180,
      ponto_pedido: 50, estoque_seguranca: 25, status_estoque: 'OK',
      custo_unitario: 89.00, localizacao_almox: 'A3-P1', nrs_associadas: 'NR-06', status_item: 'ATIVO' }
  ]));

  /* ── FUNCIONÁRIOS ─────────────────────────────────────────────────────── */
  var admissao = new Date(agora.getFullYear() - 2, 0, 15);
  log.push(_setupInserir(ss, CFG.ABAS.FUNCIONARIOS, CFG.COL_FUNCIONARIOS, 'matricula', [
    // Você — ADMIN + MASTER_ADMIN, e-mail lido da sessão
    { matricula: 'ADM-001', nome_completo: 'Administrador do Sistema', cpf: '',
      tipo_vinculo: 'NATIVO', empresa: '', setor: 'SET-04', funcao: 'FUN-04',
      perfil_rbac: 'ADMIN', senha_hash: '', salt: '', id_gestor: '',
      cartao_rfid: 'RFID-0001', id_biometrico: '', data_admissao: admissao,
      data_fim_contrato: '', status: 'ATIVO', motivo_bloqueio: '',
      criado_em: agora, atualizado_em: agora, atualizado_por: 'SETUP',
      status_efetivo: '', motivo_bloqueio_automatico: '',
      nivel_hierarquico: 'MASTER_ADMIN', unidades_visiveis: '',
      email_corporativo: emailAdmin },

    { matricula: 'GES-001', nome_completo: 'Carlos Eduardo Pereira', cpf: '',
      tipo_vinculo: 'NATIVO', empresa: '', setor: 'SET-01', funcao: 'FUN-01',
      perfil_rbac: 'GESTOR', senha_hash: '', salt: '', id_gestor: 'ADM-001',
      cartao_rfid: 'RFID-0002', id_biometrico: '', data_admissao: admissao,
      data_fim_contrato: '', status: 'ATIVO', motivo_bloqueio: '',
      criado_em: agora, atualizado_em: agora, atualizado_por: 'SETUP',
      status_efetivo: '', motivo_bloqueio_automatico: '',
      nivel_hierarquico: 'GESTOR', unidades_visiveis: '', email_corporativo: '' },

    { matricula: 'FUN-1001', nome_completo: 'Ana Beatriz Costa', cpf: '',
      tipo_vinculo: 'NATIVO', empresa: '', setor: 'SET-01', funcao: 'FUN-01',
      perfil_rbac: 'FUNCIONARIO', senha_hash: '', salt: '', id_gestor: 'GES-001',
      cartao_rfid: 'RFID-1001', id_biometrico: '', data_admissao: admissao,
      data_fim_contrato: '', status: 'ATIVO', motivo_bloqueio: '',
      criado_em: agora, atualizado_em: agora, atualizado_por: 'SETUP',
      status_efetivo: '', motivo_bloqueio_automatico: '',
      nivel_hierarquico: 'OPERACIONAL', unidades_visiveis: '', email_corporativo: '' },

    { matricula: 'FUN-1002', nome_completo: 'Marcos Antônio Ribeiro', cpf: '',
      tipo_vinculo: 'NATIVO', empresa: '', setor: 'SET-02', funcao: 'FUN-02',
      perfil_rbac: 'FUNCIONARIO', senha_hash: '', salt: '', id_gestor: 'GES-001',
      cartao_rfid: 'RFID-1002', id_biometrico: '', data_admissao: admissao,
      data_fim_contrato: '', status: 'ATIVO', motivo_bloqueio: '',
      criado_em: agora, atualizado_em: agora, atualizado_por: 'SETUP',
      status_efetivo: '', motivo_bloqueio_automatico: '',
      nivel_hierarquico: 'OPERACIONAL', unidades_visiveis: '', email_corporativo: '' },

    { matricula: 'TER-2001', nome_completo: 'Rafael Souza Lima', cpf: '',
      tipo_vinculo: 'TERCEIRIZADO', empresa: 'EMP-01', setor: 'SET-03', funcao: 'FUN-03',
      perfil_rbac: 'TERCEIRIZADO', senha_hash: '', salt: '', id_gestor: 'GES-001',
      cartao_rfid: 'RFID-2001', id_biometrico: '', data_admissao: admissao,
      data_fim_contrato: '', status: 'ATIVO', motivo_bloqueio: '',
      criado_em: agora, atualizado_em: agora, atualizado_por: 'SETUP',
      status_efetivo: '', motivo_bloqueio_automatico: '',
      nivel_hierarquico: 'OPERACIONAL', unidades_visiveis: '', email_corporativo: '' }
  ]));

  /* ── EMPRESA TERCEIRA ─────────────────────────────────────────────────── */
  var fimContrato = new Date(agora.getFullYear() + 1, agora.getMonth(), agora.getDate());
  log.push(_setupInserir(ss, CFG.ABAS.EMPRESAS, CFG.COL_EMPRESAS, 'id_empresa', [
    { id_empresa: 'EMP-01', cnpj: '00.000.000/0001-00', razao_social: 'Terceira Serviços Industriais LTDA',
      nome_fantasia: 'Terceira Serviços', numero_contrato: 'CT-2024-001',
      objeto_contrato: 'Movimentação de carga e apoio logístico',
      data_inicio_contrato: admissao, data_fim_contrato: fimContrato,
      contrato_vigente: 'SIM', status_contrato: 'VIGENTE', status_documentacao: 'REGULAR',
      pgr_entregue: 'SIM', pcmso_entregue: 'SIM', validade_documentacao: fimContrato,
      responsavel_tecnico: 'Eng. Responsável', contato_email: 'contato@terceira.exemplo',
      contato_telefone: '(00) 0000-0000', setores_autorizados: 'SET-03',
      fornece_proprio_epi: 'NAO', qtd_colaboradores_ativos: 1, status: 'ATIVO' }
  ]));

  var saida = 'SEED DEMO CONCLUÍDO\n' +
              '  ADMIN criado com e-mail: ' + emailAdmin + '\n\n' +
              log.join('\n') +
              '\n\nPróximo passo: rode diag_Schema() e depois abra a URL do app.';
  Logger.log(saida);
  return saida;
}


/**
 * Insere linhas numa aba pulando as que já existem (compara pelo campo-chave).
 * Retorna string de log.
 */
function _setupInserir(ss, nomeAba, cols, campoChave, registros) {
  var sh = ss.getSheetByName(nomeAba);
  if (!sh) return 'ERRO: aba "' + nomeAba + '" não existe. Rode setup_CriarSchemaCompleto() antes.';

  var totalCols = _setupCabecalhosDe(cols).length;
  var posChave = cols[campoChave];

  // Chaves já presentes
  var existentes = {};
  if (sh.getLastRow() > 1) {
    var atuais = sh.getRange(2, posChave, sh.getLastRow() - 1, 1).getValues();
    atuais.forEach(function (l) { existentes[String(l[0]).trim().toUpperCase()] = true; });
  }

  var novas = [];
  var pulados = 0;

  registros.forEach(function (reg) {
    var chave = String(reg[campoChave] || '').trim().toUpperCase();
    if (!chave || existentes[chave]) { pulados++; return; }

    var linha = new Array(totalCols).fill('');
    Object.keys(reg).forEach(function (campo) {
      var pos = cols[campo];
      if (pos) linha[pos - 1] = reg[campo];
    });
    novas.push(linha);
    existentes[chave] = true;
  });

  if (novas.length > 0) {
    sh.getRange(sh.getLastRow() + 1, 1, novas.length, totalCols).setValues(novas);
  }

  return nomeAba + ': ' + novas.length + ' inserida(s), ' + pulados + ' pulada(s por já existir).';
}


/* ═══════════════════════════════════════════════════════════════════════════
   PASSO 5 · REMOÇÃO DAS ABAS ANTIGAS — DESTRUTIVO
   Só rode depois de conferir que o backup do passo 1 está no Drive.
   Remove apenas abas que NÃO estão no CFG.ABAS.
═══════════════════════════════════════════════════════════════════════════ */

function setup_RemoverAbasAntigas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var esperadas = {};
  Object.keys(CFG.ABAS).forEach(function (k) { esperadas[CFG.ABAS[k]] = true; });

  var removidas = [];
  var mantidas = [];

  ss.getSheets().forEach(function (sh) {
    var nome = sh.getName();
    if (esperadas[nome]) { mantidas.push(nome); return; }
    removidas.push(nome);
  });

  if (removidas.length === 0) {
    var nada = 'Nada a remover. Todas as abas presentes pertencem ao CFG.';
    Logger.log(nada);
    return nada;
  }

  // A planilha precisa manter pelo menos uma aba visível — o Sheets não deixa
  // apagar a última. Como o CFG cria 11, isso nunca é problema aqui, mas
  // conferimos mesmo assim antes de destruir.
  if (mantidas.length === 0) {
    throw new Error('Nenhuma aba do CFG existe ainda. Rode setup_CriarSchemaCompleto() antes de remover as antigas.');
  }

  removidas.forEach(function (nome) { ss.deleteSheet(ss.getSheetByName(nome)); });

  var saida = 'ABAS REMOVIDAS (' + removidas.length + '):\n  ✗ ' + removidas.join('\n  ✗ ') +
              '\n\nABAS MANTIDAS (' + mantidas.length + '):\n  ✓ ' + mantidas.join('\n  ✓ ');
  Logger.log(saida);
  return saida;
}


/* ═══════════════════════════════════════════════════════════════════════════
   PASSO 6 · TOKENS DE AUTORIZAÇÃO DOS TOTENS
   Sem token válido na URL, o doGet recusa servir a tela do totem.
   Os tokens ficam em Script Properties — nunca na planilha, nunca no HTML.
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Gera (ou regenera) os tokens dos totens e devolve as URLs prontas para colar no kiosk.
 *
 * @param {string[]} [ids]  lista de totens. Default: ['TOTEM_01','TOTEM_02','TOTEM_03'].
 *
 * Rodar de novo INVALIDA as URLs antigas — é assim que se revoga um tablet perdido.
 */
function setup_GerarTokensTotem(ids) {
  ids = ids || ['TOTEM_01', 'TOTEM_02', 'TOTEM_03'];

  var tokens = {};
  ids.forEach(function (id) {
    tokens[id] = Utilities.getUuid().replace(/-/g, '');
  });

  PropertiesService.getScriptProperties()
    .setProperty(CFG_TOTEM.CHAVE_PROPS, JSON.stringify(tokens));

  var base = ScriptApp.getService().getUrl();
  var linhas = ['TOKENS DE TOTEM GERADOS', ''];

  ids.forEach(function (id) {
    linhas.push(id + ':');
    linhas.push('  ' + base + '?tela=totem&id=' + id + '&token=' + tokens[id]);
    linhas.push('');
  });

  linhas.push('Cole cada URL no navegador do tablet correspondente e fixe em modo kiosk.');
  linhas.push('Rodar esta função de novo invalida todas as URLs acima (use para revogar acesso).');

  var saida = linhas.join('\n');
  Logger.log(saida);
  return saida;
}


/**
 * Mostra quais totens estão autorizados, sem revelar os tokens.
 * Útil para conferir o estado sem gerar credencial nova.
 */
function setup_ListarTotens() {
  var bruto = PropertiesService.getScriptProperties().getProperty(CFG_TOTEM.CHAVE_PROPS);
  if (!bruto) {
    var vazio = 'Nenhum token cadastrado. Rode setup_GerarTokensTotem().';
    Logger.log(vazio);
    return vazio;
  }

  var tokens = JSON.parse(bruto);
  var ids = Object.keys(tokens);
  var saida = 'TOTENS AUTORIZADOS (' + ids.length + '):\n  • ' + ids.join('\n  • ') +
              '\n\nTokens ocultos por segurança. Para reemitir: setup_GerarTokensTotem().';
  Logger.log(saida);
  return saida;
}
