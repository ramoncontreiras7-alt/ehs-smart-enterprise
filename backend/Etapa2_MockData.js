/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EHS SMART ENTERPRISE · Etapa 2 — Mock Data (Ambiente de Testes)
 * Injeta dados fictícios nas planilhas distribuídos por hierarquia RBAC:
 * MASTER_ADMIN, DIRETORIA, GESTOR, SST, ADMIN, FUNCIONARIO, TERCEIRIZADO.
 *
 * Gera relatório de conferência com: Nome, E-mail, CPF, Credencial,
 * Nível Hierárquico e Perfil RBAC.
 *
 * Execute: util_GerarMassaFicticia()
 * ═══════════════════════════════════════════════════════════════════════════
 */

const MOCK = {
  NOMES: ['Ramon', 'João', 'Maria', 'Pedro', 'Ana', 'Lucas', 'Beatriz', 'Carlos', 'Fernanda',
          'Rafael', 'Juliana', 'Marcelo', 'Patrícia', 'Bruno', 'Camila', 'Diego', 'Larissa',
          'Thiago', 'Mariana', 'Felipe', 'Aline', 'Gustavo', 'Renata', 'Eduardo'],
  SOBRENOMES: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Costa', 'Almeida',
               'Ferreira', 'Rodrigues', 'Gomes', 'Martins', 'Araújo', 'Barbosa', 'Contreiras'],
  DOMINIO: 'empresa.com',
  EPIS: ['EPI-01', 'EPI-02', 'EPI-03', 'EPI-04', 'EPI-05', 'EPI-06'],
  SETORES: ['SET-01', 'SET-02', 'SET-03', 'SET-04'],
  FUNCOES: ['FUN-01', 'FUN-02', 'FUN-03', 'FUN-04'],
  MASTER_ADMIN_EMAIL: 'ramoncontreiras7@gmail.com'
};

/** Gera CPF com dígitos verificadores válidos (formato xxx.xxx.xxx-xx). */
function _gerarCPF() {
  const n = [];
  for (let i = 0; i < 9; i++) n.push(Math.floor(Math.random() * 10));
  const d1 = _digitoCPF(n);
  const d2 = _digitoCPF(n.concat(d1));
  const base = n.join('') + d1 + d2;
  return `${base.slice(0, 3)}.${base.slice(3, 6)}.${base.slice(6, 9)}-${base.slice(9)}`;
}
function _digitoCPF(digs) {
  let soma = 0, peso = digs.length + 1;
  for (const d of digs) { soma += d * peso; peso--; }
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

/** Matrícula fictícia sequencial, prefixada para não colidir com a base real. */
function _proximaMatriculaFicticia() {
  const c = CFG.COL_FUNCIONARIOS;
  const existentes = _lerTudo(CFG.ABAS.FUNCIONARIOS)
    .map(f => String(f[c.matricula - 1] || ''))
    .filter(m => m.startsWith('FIC-'))
    .map(m => Number(m.slice(4)) || 0);
  const maximo = existentes.length ? Math.max.apply(null, existentes) : 0;
  const seq = maximo + 1;
  return 'FIC-' + ('0000' + seq).slice(-4);
}

function _sortear(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function _randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

/**
 * Cria um colaborador fictício com hierarquia e perfil RBAC definidos.
 * Perfis suportados:
 *   master_admin, diretoria, gestor, sst, admin, funcionario, terceirizado
 */
function _montarLinhaFuncionario(matricula, nome, cpf, email, perfilRBAC, nivelHierarquico, rfid) {
  const c = CFG.COL_FUNCIONARIOS;
  const linha = new Array(c.email_corporativo).fill('');

  const vinculo = (perfilRBAC === 'TERCEIRIZADO') ? 'TERCEIRIZADO' : 'NATIVO';
  const setor = _sortear(MOCK.SETORES);
  const funcao = _sortear(MOCK.FUNCOES);

  linha[c.matricula - 1]            = matricula;
  linha[c.nome_completo - 1]        = nome;
  linha[c.cpf - 1]                  = cpf;
  linha[c.tipo_vinculo - 1]         = vinculo;
  linha[c.empresa - 1]              = (perfilRBAC === 'TERCEIRIZADO') ? 'Terceira Tech' : 'Matriz';
  linha[c.setor - 1]                = setor;
  linha[c.funcao - 1]               = funcao;
  linha[c.perfil_rbac - 1]          = perfilRBAC.toUpperCase();
  linha[c.senha_hash - 1]           = '';
  linha[c.salt - 1]                 = '';
  linha[c.id_gestor - 1]            = (nivelHierarquico === 'OPERACIONAL' || nivelHierarquico === 'GESTOR') ? '1000' : '';
  linha[c.cartao_rfid - 1]          = rfid;
  linha[c.id_biometrico - 1]        = '';
  linha[c.data_admissao - 1]        = new Date(2023, _randInt(0, 5), _randInt(1, 28));
  linha[c.data_fim_contrato - 1]    = (perfilRBAC === 'TERCEIRIZADO') ? new Date(2026, 11, 31) : '';
  linha[c.status - 1]               = 'ATIVO';
  linha[c.motivo_bloqueio - 1]      = '';
  linha[c.criado_em - 1]            = new Date();
  linha[c.atualizado_em - 1]        = new Date();
  linha[c.atualizado_por - 1]       = 'MOCK';
  linha[c.status_efetivo - 1]       = 'ATIVO';
  linha[c.motivo_bloqueio_automatico - 1] = '';
  linha[c.nivel_hierarquico - 1]    = nivelHierarquico.toUpperCase();
  linha[c.unidades_visiveis - 1]    = (nivelHierarquico === 'DIRETORIA' || nivelHierarquico === 'MASTER_ADMIN') ? 'UNI-01;UNI-02' : '';
  linha[c.email_corporativo - 1]    = email;

  return linha;
}

/** Gera movimentações de EPI com métrica de vida útil boa ou ruim. */
function _gerarMovimentacoes(matricula, indice, perfil) {
  const cm = CFG.COL_MOVIMENTACOES;
  const cens = perfil === 'boa'
    ? { perc: [75, 98], impacto: 'POSITIVO' }
    : { perc: [8, 35], impacto: 'NEGATIVO' };
  const perc = cens.perc[0] + Math.floor(Math.random() * (cens.perc[1] - cens.perc[0]));
  const codigo = _sortear(MOCK.EPIS);
  const agora = new Date();
  const id = 'MOV-' + Utilities.formatDate(agora, Session.getScriptTimeZone(), 'yyyyMMdd') +
             '-' + ('0000' + (indice + 1)).slice(-4);

  const linha = new Array(cm.hash_registro).fill('');
  linha[cm.id_movimentacao - 1]           = id;
  linha[cm.data_hora - 1]                 = new Date(agora.getTime() - 86400000 * indice);
  linha[cm.matricula - 1]                 = matricula;
  linha[cm.codigo_epi - 1]                = codigo;
  linha[cm.tipo_movimentacao - 1]         = indice % 4 === 0 ? 'TROCA' : 'ENTREGA';
  linha[cm.quantidade - 1]                = 1;
  linha[cm.motivo_troca - 1]              = indice % 4 === 0 ? 'DESGASTE_NATURAL' : 'N/A';
  linha[cm.ca_no_momento - 1]             = 'CA-' + _randInt(1000, 9999);
  linha[cm.lote - 1]                      = 'LOTE-' + _randInt(100, 999);
  linha[cm.data_validade_calculada - 1]   = new Date(agora.getTime() + 86400000 * 90);
  linha[cm.perc_vida_util_aproveitada - 1] = perc;
  linha[cm.status_confirmacao_totem - 1]  = 'CONFIRMADO';
  linha[cm.id_totem - 1]                  = 'TOTEM-MOCK';
  linha[cm.responsavel_almox - 1]         = '1000';
  linha[cm.observacao - 1]                = '';
  linha[cm.impacto_gamificacao - 1]       = cens.impacto;
  linha[cm.hash_registro - 1]             = _sha256(linha.join('|'));
  return linha;
}

/** Cria vínculo de mentoria (REGRA ANTI-FRAUDE). */
function _montarLinhaMentoria(idVinculo, mentor, mentorado, perfilMentorado) {
  const cg = CFG.COL_GAMIFICACAO;
  const base = 100 + Math.floor(Math.random() * 200);
  const atual = perfilMentorado === 'ruim'
    ? base + Math.floor(Math.random() * 500)
    : base + Math.floor(Math.random() * 100);
  const repasse = 0.20 + Math.random() * 0.10;

  const linha = new Array(cg.observacoes_sst).fill('');
  linha[cg.id_vinculo - 1]                 = idVinculo;
  linha[cg.matricula_mentor - 1]           = mentor;
  linha[cg.matricula_mentorado - 1]        = mentorado;
  linha[cg.id_setor - 1]                   = _sortear(MOCK.SETORES);
  linha[cg.data_inicio_vinculo - 1]        = new Date(2024, 0, 1);
  linha[cg.data_fim_vinculo - 1]           = '';
  linha[cg.status_vinculo - 1]             = 'ATIVO';
  linha[cg.pontos_acumulados_mentorado - 1] = atual;
  linha[cg.pontos_base_inicial - 1]        = base;
  linha[cg.percentual_repasse_mentor - 1]  = Math.round(repasse * 100) / 100;
  linha[cg.saldo_bonus_mentor - 1]         = 0;
  linha[cg.saldo_bonus_acumulado_historico - 1] = 0;
  linha[cg.infracoes_mentorado - 1]        = 0;
  linha[cg.impacto_infracoes_no_mentor - 1] = 0;
  linha[cg.perc_vida_util_media_mentorado - 1] = perfilMentorado === 'ruim' ? 25 : 85;
  linha[cg.qtd_trocas_positivas - 1]       = perfilMentorado === 'ruim' ? 1 : 5;
  linha[cg.nivel_evolucao - 1]             = perfilMentorado === 'ruim' ? 'EM_DESENVOLVIMENTO' : 'APTO_A_MENTORAR';
  linha[cg.validado_por_sst - 1]           = true;
  linha[cg.data_validacao_sst - 1]         = new Date();
  linha[cg.observacoes_sst - 1]            = 'Mock gerado automaticamente';
  return linha;
}

/**
 * ENTRADA PRINCIPAL. Popula a base fictícia por hierarquia RBAC.
 * Retorna relatório de conferência com todos os usuários criados.
 */
function util_GerarMassaFicticia(opcoes) {
  const opt = opcoes || {};
  const shFunc = _aba(CFG.ABAS.FUNCIONARIOS);
  const shMov  = _aba(CFG.ABAS.MOVIMENTACOES);
  const shMent = _aba(CFG.ABAS.GAMIFICACAO);

  const novoFunc = [];
  const novasMov = [];
  const mentorados = [];
  const relatorio = [];

  let idx = 0;
  let seqMat = 1;

  const criar = (perfilRBAC, nivelHierarquico, nomeSobrenome, emailOverride, rfidOverride) => {
    const matr = 'FIC-' + ('0000' + seqMat).slice(-4);
    seqMat++;
    const nome = nomeSobrenome || (MOCK.NOMES[idx % MOCK.NOMES.length] + ' ' + MOCK.SOBRENOMES[(idx * 3) % MOCK.SOBRENOMES.length]);
    const cpf = _gerarCPF();
    const email = emailOverride || (nome.split(' ')[0].toLowerCase() + '.' + nome.split(' ')[1].toLowerCase() + seqMat + '@' + MOCK.DOMINIO);
    const rfid = rfidOverride || 'RFID-FIC' + ('0000' + (idx + 1)).slice(-4);

    const perfilMov = (perfilRBAC === 'TERCEIRIZADO') ? 'ruim' : (idx % 3 === 0 ? 'ruim' : 'boa');
    novoFunc.push(_montarLinhaFuncionario(matr, nome, cpf, email, perfilRBAC, nivelHierarquico, rfid));
    for (let m = 0; m < 3; m++) novasMov.push(_gerarMovimentacoes(matr, idx * 3 + m, perfilMov));
    mentorados.push({ matr, perfil: perfilMov, perfilRBAC, nivelHierarquico });
    relatorio.push({ matricula: matr, nome, cpf, email, rfid, perfilRBAC, nivelHierarquico });
    idx++;
  };

  // 1) Master Admin / TI
  criar('MASTER_ADMIN', 'MASTER_ADMIN', 'Ramon Contreiras', MOCK.MASTER_ADMIN_EMAIL, 'RFID-MASTER-1000');

  // 2) Diretoria
  for (let i = 0; i < 3; i++) criar('ADMIN', 'DIRETORIA');

  // 3) Gestor / Supervisor
  for (let i = 0; i < 4; i++) criar('GESTOR', 'GESTOR');

  // 4) SST
  for (let i = 0; i < 3; i++) criar('SST', 'GESTOR');

  // 5) Almoxarifado (perfil FUNCIONARIO com acesso Almox)
  for (let i = 0; i < 4; i++) criar('FUNCIONARIO', 'OPERACIONAL');

  // 6) Funcionário / Operacional Nato
  for (let i = 0; i < 12; i++) criar('FUNCIONARIO', 'OPERACIONAL');

  // 7) Terceirizados
  for (let i = 0; i < 8; i++) criar('TERCEIRIZADO', 'OPERACIONAL');

  if (novoFunc.length) shFunc.getRange(shFunc.getLastRow() + 1, 1, novoFunc.length, novoFunc[0].length).setValues(novoFunc);
  if (novasMov.length) shMov.getRange(shMov.getLastRow() + 1, 1, novasMov.length, novasMov[0].length).setValues(novasMov);

  const mentores = mentorados.filter(x => x.perfil === 'boa');
  const ruins = mentorados.filter(x => x.perfil === 'ruim');
  const linhasMent = [];
  const totalVinculos = Math.min(mentores.length, Math.max(1, ruins.length));
  for (let i = 0; i < totalVinculos; i++) {
    linhasMent.push(_montarLinhaMentoria(
      'MNT-' + ('0000' + (i + 1)).slice(-4), mentores[i].matr, ruins[i].matr, 'ruim'));
  }
  if (linhasMent.length) shMent.getRange(shMent.getLastRow() + 1, 1, linhasMent.length, linhasMent[0].length).setValues(linhasMent);

  registrarLog({
    matricula_usuario: 'SISTEMA', acao_realizada: 'CADASTRO_MASSA',
    tabela_afetada: CFG.ABAS.FUNCIONARIOS, origem_acao: 'WEB_DESKTOP',
    resultado: 'SUCESSO', criticidade: 'INFO',
    justificativa: `Mock: ${novoFunc.length} funcionários, ${novasMov.length} movimentações, ${linhasMent.length} vínculos.`
  });

  return {
    ok: true,
    total_funcionarios: novoFunc.length,
    total_movimentacoes: novasMov.length,
    total_vinculos: linhasMent.length,
    relatorio: relatorio,
    resumo_por_perfil: _resumoPorPerfil(relatorio)
  };
}

function _resumoPorPerfil(lista) {
  const resumo = {};
  lista.forEach(u => {
    const k = u.perfilRBAC + ' | ' + u.nivelHierarquico;
    if (!resumo[k]) resumo[k] = 0;
    resumo[k]++;
  });
  return resumo;
}

/** Menu de um clique para popular a base a partir do próprio Sheets. */
function onOpen() {
  SpreadsheetApp.getActiveSpreadsheet().addMenu('EHS ▸ Testes', [
    { name: 'Gerar Massa Fictícia (Mock)', functionName: 'util_GerarMassaFicticia' },
    { name: 'Definir Senha Compartilhada (teste)', functionName: 'api_DefinirSenhaCompartilhadaMenu' }
  ]);
}

/** Atalho de menu: define senha padrão de teste (apenas primeiro acesso). */
function api_DefinirSenhaCompartilhadaMenu() {
  const existente = PropertiesService.getScriptProperties()
    .getProperty(CFG_LOGIN.CHAVE_SENHA_COMPARTILHADA);
  if (existente) {
    return { ok: false, erro: 'Senha já definida. Use api_DefinirSenhaCompartilhada via código (exige MASTER_ADMIN).' };
  }
  return api_DefinirSenhaCompartilhada('Ehs@2026', '1000');
}
