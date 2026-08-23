/**************************************************************************************************
 * EHS SMART ENTERPRISE v2.0 — INGESTÃO DE FUNCIONÁRIOS (ETL)
 * Arquivo: ETL_Ingestao.gs
 * ------------------------------------------------------------------------------------------------
 * Reescrito para alinhar com o Code.gs canônico da Sala 1 (v2.0).
 *
 * CONTRATO PÚBLICO (preservado):
 *   importarFuncionariosEmLote({ registros: [...], origem: '...', matriculaSolicitante?: '...' })
 *
 * MAPA DE VOCABULÁRIO WORKER → CANÔNICO (etl_worker.js NÃO é alterado — ver nota abaixo):
 *   id_funcionario  →  matricula         (col 1)
 *   nome            →  nome_completo     (col 2)
 *   vinculo         →  tipo_vinculo      (col 4)  NATIVO / TERCEIRIZADO
 *   id_cracha       →  cartao_rfid       (col 12)
 *   perfil_acesso   →  perfil_rbac       (col 8)  ← SEMPRE rebaixado na gravação
 *   (novo)          →  nivel_hierarquico (col 23) ← SEMPRE 'OPERACIONAL' na gravação
 *   email           →  email_corporativo (col 25)
 *   status          →  status            (col 16) — NÃO confundir com status_efetivo (col 21, fórmula)
 *
 * BLINDAGEM DE ELEVAÇÃO DE PRIVILÉGIO:
 *   A planilha NUNCA define perfil_rbac nem nivel_hierarquico.
 *   • Funcionário/Nativo  → ('FUNCIONARIO',  'OPERACIONAL')
 *   • Terceirizado        → ('TERCEIRIZADO', 'OPERACIONAL')
 *   Qualquer valor diferente é rebaixado silenciosamente e registrado no log com criticidade AVISO.
 *
 * NOTA SOBRE etl_worker.js:
 *   O worker continua usando vocabulário legado (CAMPOS_DESTINO, normalizarPerfil etc.).
 *   Este backend traduz tudo na entrada. O worker NÃO deve ser alterado sem que o
 *   Hooks_ETL.html (não presente neste disco) seja revalidado em conjunto.
 *
 * ANTES DE DEPLOY:
 *   Rode teste_8_importacaoBlindada() no editor. Ela valida:
 *   1. Escalonamento rebaixado → ('FUNCIONARIO','OPERACIONAL') + log AVISO
 *   2. Vocabulário legado traduzido → tipo_vinculo, cartao_rfid
 **************************************************************************************************/

var LIMITE_IMPORTACAO = 500;


/* ═══════════════════════════════════════════════════════════════════════════
   HELPER LOCAL — normalização sem acentos, trim, uppercase.
   Substitui o antigo normalizar_() que não existe no Code.gs canônico.
═══════════════════════════════════════════════════════════════════════════ */

function _norm(v) {
  return String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
}


/* ═══════════════════════════════════════════════════════════════════════════
   IMPORTAÇÃO EM LOTE — assinatura pública preservada
═══════════════════════════════════════════════════════════════════════════ */

/**
 * Importa funcionários a partir de linhas já mapeadas pelo worker de ETL.
 *
 * @param  {Object}  p
 * @param  {Object[]} p.registros           linhas mapeadas pelo worker
 * @param  {string}  p.origem               descrição da origem (auditoria)
 * @param  {string}  [p.matriculaSolicitante]  matrícula do admin que dispara (opcional;
 *                                             se omitida, resolve por Session Desktop)
 * @return {Object}  { sucesso, importados, ignorados, idsLog, mensagem }
 */
function importarFuncionariosEmLote(p) {
  p = p || {};

  /* ── PASSO 3 · Resolver identidade do solicitante ─────────────────────── */
  var matriculaSolicitante = String(p.matriculaSolicitante || '').trim();
  if (!matriculaSolicitante) {
    // Modelo Híbrido Desktop: e-mail da sessão Apps Script
    var emailSessao = Session.getActiveUser().getEmail();
    if (!emailSessao) {
      throw new Error('ETL não conseguiu identificar o solicitante: sessão sem e-mail.');
    }
    var usuarioSessao = _obterUsuarioPorEmail(emailSessao);
    if (!usuarioSessao) {
      throw new Error('ETL não conseguiu identificar o solicitante: e-mail "' +
                       emailSessao + '" não corresponde a nenhum funcionário ativo.');
    }
    matriculaSolicitante = usuarioSessao.matricula;
  }

  /* ── PASSO 4 · Autorização (só ADMIN + MASTER_ADMIN) ──────────────────── */
  var admin = _exigirAcesso(matriculaSolicitante, {
    perfis: ['ADMIN'],
    nivelMinimo: 'MASTER_ADMIN',
    contexto: 'ETL_IMPORT_FUNCIONARIOS'
  });

  var registros = p.registros || [];
  var origem = String(p.origem || 'não informada');

  if (registros.length === 0) {
    return { sucesso: false, motivo: 'LOTE_VAZIO', mensagem: 'Nenhum registro para importar.' };
  }
  if (registros.length > LIMITE_IMPORTACAO) {
    return { sucesso: false, motivo: 'LOTE_EXCEDIDO',
             mensagem: 'Limite de ' + LIMITE_IMPORTACAO + ' registros por importação. Divida o arquivo.' };
  }

  /* ── PASSO 5 · Lock canônico ──────────────────────────────────────────── */
  var trava = LockService.getScriptLock();
  trava.waitLock(CFG.TIMEOUT_LOCK);

  var resultado = { sucesso: true, importados: 0, ignorados: [], idsLog: [] };

  try {
    /* ── PASSO 6 · Ler existentes via helpers canônicos ──────────────────── */
    var linhasAtuais = _lerTudo(CFG.ABAS.FUNCIONARIOS);
    var C = CFG.COL_FUNCIONARIOS;

    var idsExistentes = {};
    var emailsExistentes = {};
    for (var i = 0; i < linhasAtuais.length; i++) {
      var l = linhasAtuais[i];
      idsExistentes[_norm(l[C.matricula - 1])] = true;
      var emailLinha = _norm(l[C.email_corporativo - 1]);
      if (emailLinha) emailsExistentes[emailLinha] = true;
    }

    var totalColunas = 25;   // canônico v2.0 — definido pelo CFG.COL_FUNCIONARIOS
    var linhasNovas = [];
    var eventos = [];

    /* ── PASSO 8 · Loop de leitura do payload do worker ──────────────────── */
    for (var k = 0; k < registros.length; k++) {
      var item = registros[k] || {};

      // Fallbacks traduzem vocabulário do worker (legado) para canônico
      var matricula   = String(item.matricula || item.id_funcionario || item.id || '').trim();
      var nome        = String(item.nome_completo || item.nome || '').trim();
      var email       = String(item.email_corporativo || item.email || '').trim().toLowerCase();
      var rfid        = String(item.cartao_rfid || item.id_cracha || item.cracha || '').trim();
      var setor       = String(item.setor || '').trim();
      var funcao      = String(item.funcao || '').trim();
      var tipoVinculo = _norm(item.tipo_vinculo || item.vinculo) === 'TERCEIRIZADO'
                        ? 'TERCEIRIZADO'
                        : 'NATIVO';
      var status      = _norm(item.status) === 'INATIVO' ? 'INATIVO' : 'ATIVO';

      // Validação mínima
      if (!matricula || !nome) {
        resultado.ignorados.push({ id: matricula || '(vazio)', motivo: 'matrícula ou nome ausente' });
        continue;
      }

      // Duplicidade por PK
      if (idsExistentes[_norm(matricula)]) {
        resultado.ignorados.push({ id: matricula, motivo: 'matrícula já cadastrada' });
        continue;
      }

      // Duplicidade por e-mail (só se ambos os lados têm valor)
      var emailNorm = _norm(email);
      if (emailNorm && emailsExistentes[emailNorm]) {
        resultado.ignorados.push({ id: matricula, motivo: 'e-mail já cadastrado' });
        continue;
      }

      /* ── PASSO 9 · RBAC: elevação de privilégio jamais nasce de planilha ── */
      var perfilRbacFinal = (tipoVinculo === 'TERCEIRIZADO') ? 'TERCEIRIZADO' : 'FUNCIONARIO';
      var nivelFinal      = 'OPERACIONAL';   // fixo — elevação exige ação manual do ADMIN

      var perfilSugerido = _norm(item.perfil_rbac || item.perfil_acesso || item.perfil);
      var nivelSugerido  = _norm(item.nivel_hierarquico || item.nivel);
      var foiRebaixado   = (perfilSugerido && perfilSugerido !== perfilRbacFinal) ||
                           (nivelSugerido  && nivelSugerido  !== nivelFinal);

      /* ── PASSO 10 · Montar linha com posições canônicas ─────────────────── */
      var linhaNova = new Array(totalColunas).fill('');
      linhaNova[C.matricula - 1]         = matricula;
      linhaNova[C.nome_completo - 1]     = nome;
      linhaNova[C.tipo_vinculo - 1]      = tipoVinculo;
      linhaNova[C.setor - 1]             = setor;
      linhaNova[C.funcao - 1]            = funcao;
      linhaNova[C.perfil_rbac - 1]       = perfilRbacFinal;
      linhaNova[C.cartao_rfid - 1]       = rfid;
      linhaNova[C.status - 1]            = status;
      linhaNova[C.nivel_hierarquico - 1] = nivelFinal;
      linhaNova[C.email_corporativo - 1] = email;
      linhaNova[C.criado_em - 1]         = new Date();
      linhaNova[C.atualizado_em - 1]     = new Date();
      linhaNova[C.atualizado_por - 1]    = admin.matricula;
      // Colunas não preenchidas (cpf, empresa, senha_hash, salt, id_gestor,
      // id_biometrico, data_admissao, data_fim_contrato, motivo_bloqueio,
      // status_efetivo, motivo_bloqueio_automatico, unidades_visiveis)
      // ficam com '' — o _obterUsuario já lida com colunas vazias.

      linhasNovas.push(linhaNova);
      idsExistentes[_norm(matricula)] = true;
      if (emailNorm) emailsExistentes[emailNorm] = true;

      /* ── PASSO 11 · Evento de log com schema canônico ───────────────────── */
      eventos.push({
        matricula_usuario: admin.matricula,
        perfil_rbac_no_momento: admin.perfil_rbac,
        nivel_hierarquico_no_momento: admin.nivel_hierarquico,
        acao_realizada: 'ETL_IMPORTAR_FUNCIONARIO',
        tabela_afetada: CFG.ABAS.FUNCIONARIOS,
        id_registro_afetado: matricula,
        valor_novo: 'Nome: ' + nome + ' | Setor: ' + setor + ' | Vínculo: ' + tipoVinculo +
                    ' | Perfil: ' + perfilRbacFinal + ' | Nível: ' + nivelFinal,
        justificativa: foiRebaixado
          ? 'Arquivo/IA sugeriu perfil "' + perfilSugerido + '" e nível "' + nivelSugerido +
            '". Rebaixado para (' + perfilRbacFinal + ', ' + nivelFinal + ') por política.'
          : '',
        origem_acao: 'ETL',
        resultado: 'SUCESSO',
        criticidade: foiRebaixado ? 'AVISO' : 'INFO'
      });

      resultado.importados++;
    }

    /* ── PASSOS 12 + 13 · Gravar linhas e logs dentro da MESMA trava ─────── */
    if (linhasNovas.length > 0) {
      // PASSO 12 — gravação em bloco via aba canônica
      var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG.ABAS.FUNCIONARIOS);
      sh.getRange(sh.getLastRow() + 1, 1, linhasNovas.length, totalColunas).setValues(linhasNovas);

      // PASSO 14 — evento-resumo do lote (empurrado para a lista antes do loop)
      eventos.push({
        matricula_usuario: admin.matricula,
        perfil_rbac_no_momento: admin.perfil_rbac,
        nivel_hierarquico_no_momento: admin.nivel_hierarquico,
        acao_realizada: 'ETL_LOTE_RESUMO',
        tabela_afetada: CFG.ABAS.FUNCIONARIOS,
        id_registro_afetado: '',
        valor_novo: 'Gravados: ' + resultado.importados + ' | Ignorados: ' +
                    resultado.ignorados.length + ' | Enviados: ' + registros.length +
                    ' | Origem: ' + origem,
        justificativa: '',
        origem_acao: 'ETL',
        resultado: 'SUCESSO',
        criticidade: 'INFO'
      });

      // PASSO 13 — hash chain exige gravação sequencial (um por vez).
      // Usamos _gravarLogSemTrava porque já estamos dentro do LockService.
      var idsLog = [];
      for (var e = 0; e < eventos.length; e++) {
        idsLog.push(_gravarLogSemTrava(eventos[e]));
      }
      resultado.idsLog = idsLog;
      SpreadsheetApp.flush();
    }

  } catch (erro) {
    resultado.sucesso = false;
    resultado.motivo = 'ERRO_EXECUCAO';
    resultado.mensagem = String(erro.message || erro);
    return resultado;
  } finally {
    trava.releaseLock();
  }

  resultado.mensagem = resultado.importados + ' funcionário(s) importado(s). ' +
                       resultado.ignorados.length + ' ignorado(s).';
  return resultado;
}


/* ═══════════════════════════════════════════════════════════════════════════
   TESTE DE REGRESSÃO
   Rode no editor antes de qualquer deploy que toque esta função.
   Valida: (1) escalonamento rebaixado, (2) vocabulário legado traduzido,
           (3) log com criticidade AVISO para rebaixamento.
═══════════════════════════════════════════════════════════════════════════ */

function teste_8_importacaoBlindada() {

  // Resolve matrícula do admin de teste (precisa existir na aba Funcionarios
  // com perfil ADMIN e nível MASTER_ADMIN para passar no _exigirAcesso).
  var emailTeste = Session.getActiveUser().getEmail();
  var adminTeste = _obterUsuarioPorEmail(emailTeste);
  if (!adminTeste || adminTeste.perfil_rbac !== 'ADMIN') {
    throw new Error('teste_8_importacaoBlindada: a conta de teste precisa ter perfil ADMIN na aba Funcionarios.');
  }

  // ── Limpar registros de teste de execuções anteriores ─────────────────
  // Sem isso, F901/F902 já existem → duplicatas ignoradas → falso positivo.
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CFG.ABAS.FUNCIONARIOS);
  var dados = sh.getDataRange().getValues();
  var C = CFG.COL_FUNCIONARIOS;
  var linhasParaRemover = [];
  for (var r = dados.length - 1; r >= 1; r--) {   // de baixo para cima
    var pk = String(dados[r][C.matricula - 1]).trim();
    if (pk === 'F901' || pk === 'F902') linhasParaRemover.push(r + 1);  // 1-indexed
  }
  for (var w = 0; w < linhasParaRemover.length; w++) {
    sh.deleteRow(linhasParaRemover[w]);
  }
  if (linhasParaRemover.length > 0) {
    Logger.log('Limpos ' + linhasParaRemover.length + ' registro(s) de teste anterior(es).');
  }

  var resposta = importarFuncionariosEmLote({
    origem: 'teste de regressão — v2.0',
    matriculaSolicitante: adminTeste.matricula,
    registros: [
      // F901: tenta escalonamento → deve entrar como ('FUNCIONARIO','OPERACIONAL') com log AVISO
      {
        matricula: 'F901', nome_completo: 'Teste Escalonamento', setor: 'TI',
        perfil_rbac: 'ADMIN', nivel_hierarquico: 'MASTER_ADMIN', status: 'ATIVO'
      },
      // F902: vocabulário legado do worker → deve traduzir tipo_vinculo e cartao_rfid
      {
        id_funcionario: 'F902', nome_completo: 'Teste Vocabulario Legado',
        id_cracha: '55555', setor: 'Logística', vinculo: 'TERCEIRIZADO'
      }
    ]
  });

  Logger.log('Resposta da importação: ' + JSON.stringify(resposta, null, 2));

  // ── Checagem 1: F901 foi rebaixado ──────────────────────────────────
  dados = sh.getDataRange().getValues();   // relê após a gravação

  var linhaF901 = null;
  for (var i = 1; i < dados.length; i++) {   // pula cabeçalho
    if (String(dados[i][C.matricula - 1]).trim() === 'F901') {
      linhaF901 = dados[i];
      break;
    }
  }

  if (!linhaF901) {
    Logger.log('FALHOU: F901 não encontrada na aba após importação.');
    return;
  }

  var perfilGravado  = String(linhaF901[C.perfil_rbac - 1]).trim();
  var nivelGravado   = String(linhaF901[C.nivel_hierarquico - 1]).trim();
  var vinculoGravado = String(linhaF901[C.tipo_vinculo - 1]).trim();

  Logger.log(perfilGravado === 'FUNCIONARIO' && nivelGravado === 'OPERACIONAL'
    ? 'APROVADO (1/3): escalonamento rebaixado → (FUNCIONARIO, OPERACIONAL).'
    : 'FALHOU (1/3): perfil="' + perfilGravado + '" nivel="' + nivelGravado +
      '" — esperado (FUNCIONARIO, OPERACIONAL).');

  // ── Checagem 2: F902 vocabulário legado traduzido ───────────────────
  var linhaF902 = null;
  for (var j = 1; j < dados.length; j++) {
    if (String(dados[j][C.matricula - 1]).trim() === 'F902') {
      linhaF902 = dados[j];
      break;
    }
  }

  if (!linhaF902) {
    Logger.log('FALHOU: F902 não encontrada na aba após importação.');
    return;
  }

  var vinculoGravado2  = String(linhaF902[C.tipo_vinculo - 1]).trim();
  var rfidGravado      = String(linhaF902[C.cartao_rfid - 1]).trim();
  var perfilGravado2   = String(linhaF902[C.perfil_rbac - 1]).trim();
  var nivelGravado2    = String(linhaF902[C.nivel_hierarquico - 1]).trim();

  Logger.log(vinculoGravado2 === 'TERCEIRIZADO' && perfilGravado2 === 'TERCEIRIZADO'
    ? 'APROVADO (2/3): vocabulário legado traduzido → tipo_vinculo=TERCEIRIZADO, perfil_rbac=TERCEIRIZADO.'
    : 'FALHOU (2/3): vinculo="' + vinculoGravado2 + '" perfil="' + perfilGravado2 +
      '" — esperado (TERCEIRIZADO, TERCEIRIZADO).');

  Logger.log(rfidGravado === '55555'
    ? 'APROVADO (2b/3): id_cracha do worker gravado em cartao_rfid.'
    : 'FALHOU (2b/3): cartao_rfid="' + rfidGravado + '" — esperado "55555".');

  Logger.log(nivelGravado2 === 'OPERACIONAL'
    ? 'APROVADO (2c/3): nível fixo OPERACIONAL para terceirizado.'
    : 'FALHOU (2c/3): nivel="' + nivelGravado2 + '" — esperado OPERACIONAL.');

  // ── Checagem 3: log contém entrada AVISO para F901 ──────────────────
  var logDados = _lerTudo(CFG.ABAS.LOG);
  var COL_LOG = CFG.COL_LOG;
  var achouAvisoF901 = false;

  for (var x = 0; x < logDados.length; x++) {
    var registro = logDados[x];
    var idReg = String(registro[COL_LOG.id_registro_afetado - 1]).trim();
    var acao  = String(registro[COL_LOG.acao_realizada - 1]).trim();
    var critic = String(registro[COL_LOG.criticidade - 1]).trim();
    var justif = String(registro[COL_LOG.justificativa - 1] || '').trim();

    if (idReg === 'F901' && acao === 'ETL_IMPORTAR_FUNCIONARIO' && critic === 'AVISO') {
      achouAvisoF901 = true;
      break;
    }
  }

  Logger.log(achouAvisoF901
    ? 'APROVADO (3/3): log de auditoria contém entrada AVISO para rebaixamento de F901.'
    : 'FALHOU (3/3): nenhuma entrada AVISO no log para F901 — investigar.');
}
