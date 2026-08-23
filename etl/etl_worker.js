/**************************************************************************************************
 * EHS SMART ENTERPRISE — ETL WORKER (v2)
 * Arquivo: etl_worker.js
 * ------------------------------------------------------------------------------------------------
 * NOVIDADE DESTA VERSÃO: leitura de .xlsx/.xls, além de .csv/.tsv/.txt.
 * Planilha de RH antiga quase nunca é CSV — é Excel, com logotipo na A1, título mesclado na A2,
 * cabeçalho de verdade lá pela linha 5, às vezes três abas com layouts diferentes e uma linha de
 * "TOTAL GERAL" no rodapé. Este arquivo trata as quatro coisas antes de qualquer dado chegar à IA.
 *
 * PIPELINE, AGORA EM SEIS ETAPAS:
 *   1. LEITURA        — csv/tsv por parser próprio; xlsx/xls via SheetJS (carregado por CDN).
 *   2. ESTRUTURAÇÃO   — só para xlsx: escolhe a melhor aba, acha a linha real de cabeçalho,
 *                        resolve células mescladas no cabeçalho, descarta linhas de rodapé.
 *   3. RTK            — compressão antes da IA (igual à v1): vazios fora, amostra mínima.
 *   4. OMNIROUTE       — mapeamento semântico das colunas (igual à v1).
 *   5. TRANSFORMAÇÃO   — aplica o mapeamento a todas as linhas, classifica válido/duplicado/inválido.
 *   6. PRÉVIA          — devolve o resumo. Nada é gravado por este arquivo.
 *
 * SHEETJS POR CDN — por quê:
 *   O parser de .xlsx é um formato ZIP com XML dentro; escrever isso à mão não vale o risco de bug
 *   silencioso em dado de folha de pagamento. SheetJS é o padrão de mercado para isso no navegador.
 *   Carregado via importScripts() — funciona dentro de Worker, e o worker já roda isolado do DOM,
 *   então não há conflito de escopo. Se a rede bloquear o CDN, o pipeline avisa e ainda funciona
 *   para CSV, que não depende de biblioteca nenhuma.
 **************************************************************************************************/

/* ================================================================================================
 * CONFIGURAÇÃO
 * ============================================================================================== */

const OMNIROUTE_URL = 'http://localhost:20128/v1/chat/completions';
const SHEETJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

const CFG = {
  MODELO: 'gpt-4o-mini',
  LINHAS_AMOSTRA: 3,
  MAX_CARACTERES_CELULA: 120,
  TIMEOUT_IA_MS: 20000,
  MAX_REGISTROS: 2000,

  // --- específico de planilhas Excel malformatadas ---
  MAX_LINHAS_VARREDURA_CABECALHO: 20,   // até onde procurar o cabeçalho real
  MIN_CELULAS_PARA_CABECALHO: 3,        // linha candidata precisa de pelo menos isso preenchido
  PALAVRAS_RODAPE: ['total', 'subtotal', 'soma', 'geral', 'totais', 'resumo']
};

const CAMPOS_DESTINO = [
  'id_funcionario', 'nome_completo', 'email_corporativo', 'id_cracha',
  'setor', 'funcao', 'vinculo', 'perfil_acesso', 'status'
];

const SINONIMOS = {
  id_funcionario:    ['matricula', 'matrícula', 'id', 'codigo', 'código', 'registro', 'chapa'],
  nome_completo:     ['nome', 'nome completo', 'funcionario', 'funcionário', 'colaborador', 'peao', 'peão', 'trabalhador'],
  email_corporativo: ['email', 'e-mail', 'email corporativo', 'login', 'e mail'],
  id_cracha:         ['cracha', 'crachá', 'cartao', 'cartão', 'badge', 'id cracha'],
  setor:             ['setor', 'departamento', 'area', 'área', 'lotacao', 'lotação', 'centro de custo'],
  funcao:            ['funcao', 'função', 'cargo', 'atividade', 'ocupacao', 'ocupação'],
  vinculo:           ['vinculo', 'vínculo', 'tipo', 'contrato', 'regime', 'empresa'],
  perfil_acesso:     ['perfil', 'nivel', 'nível', 'acesso', 'permissao', 'permissão'],
  status:            ['status', 'situacao', 'situação', 'ativo', 'condicao', 'condição']
};

/* ================================================================================================
 * CANAL COM A TELA
 * ============================================================================================== */

function etapa(nome, detalhe) { self.postMessage({ tipo: 'etapa', nome, detalhe }); }
function log(texto, nivel)    { self.postMessage({ tipo: 'log', texto, nivel: nivel || '' }); }
function progresso(atual, total) { self.postMessage({ tipo: 'progresso', atual, total }); }

/* ================================================================================================
 * ETAPA 1a — LEITURA DE CSV/TSV (texto puro, sem dependência externa)
 * ============================================================================================== */

function detectarSeparador(primeiraLinha) {
  const candidatos = [';', ',', '\t', '|'];
  let melhor = ';', maiorContagem = 0;
  candidatos.forEach(sep => {
    const quantidade = primeiraLinha.split(sep).length;
    if (quantidade > maiorContagem) { maiorContagem = quantidade; melhor = sep; }
  });
  return melhor;
}

/** Parser de CSV escrito à mão: respeita aspas, aspas duplicadas e quebras de linha em campo. */
function lerCsv(texto, separador) {
  const linhas = [];
  let campo = '', linha = [], dentroDeAspas = false;
  if (texto.charCodeAt(0) === 0xFEFF) texto = texto.slice(1);   // remove BOM do Excel

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (dentroDeAspas) {
      if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else dentroDeAspas = false; }
      else campo += c;
      continue;
    }
    if (c === '"') { dentroDeAspas = true; continue; }
    if (c === separador) { linha.push(campo); campo = ''; continue; }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      linha.push(campo); linhas.push(linha); linha = []; campo = '';
      continue;
    }
    campo += c;
  }
  if (campo !== '' || linha.length > 0) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

/* ================================================================================================
 * ETAPA 1b — LEITURA DE XLSX/XLS (via SheetJS)
 * ============================================================================================== */

let sheetJsCarregado = false;

function garantirSheetJs() {
  if (sheetJsCarregado || typeof XLSX !== 'undefined') { sheetJsCarregado = true; return; }
  try {
    importScripts(SHEETJS_URL);
    sheetJsCarregado = true;
  } catch (e) {
    throw new Error('Não foi possível carregar o leitor de Excel (SheetJS) via CDN. ' +
                    'Verifique a conexão de internet — arquivos .csv continuam funcionando sem isso.');
  }
}

/**
 * Converte cada aba do workbook em matriz bruta (array de arrays) e calcula uma "densidade de
 * dados": células preenchidas / total de células. É essa densidade que decide qual aba é a
 * planilha de gente de verdade e qual é a aba de rascunho, legenda ou gráfico dinâmico ao lado.
 */
function inventariarPlanilhas(workbook) {
  return workbook.SheetNames.map(nome => {
    const ws = workbook.Sheets[nome];
    const matriz = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '', raw: false });

    let preenchidas = 0, total = 0;
    matriz.forEach(linha => linha.forEach(c => { total++; if (String(c || '').trim() !== '') preenchidas++; }));

    return {
      nome, matriz, mesclagens: ws['!merges'] || [],
      linhas: matriz.length,
      densidade: total > 0 ? preenchidas / total : 0,
      pontuacao: matriz.length * (total > 0 ? preenchidas / total : 0)   // linhas úteis, não só densidade
    };
  });
}

/** Escolhe a aba mais provável de conter a base de gente — ou usa a forçada pelo usuário. */
function escolherPlanilha(inventario, nomeForcado) {
  if (nomeForcado) {
    const achada = inventario.find(p => p.nome === nomeForcado);
    if (achada) return achada;
    log('aba "' + nomeForcado + '" não encontrada; escolhendo automaticamente', 'alerta');
  }
  return inventario.slice().sort((a, b) => b.pontuacao - a.pontuacao)[0];
}

/**
 * Acha a linha real do cabeçalho dentro das primeiras N linhas.
 * Heurística deliberadamente simples e TRANSPARENTE: pontua cada linha candidata por quantidade
 * de células preenchidas e por serem predominantemente texto (cabeçalho raramente é numérico).
 * Não é infalível — por isso o resultado vai para o log e existe o parâmetro linhaForcada para
 * quem precisar corrigir manualmente um arquivo fora do padrão.
 */
function detectarLinhaCabecalho(matriz, linhaForcada) {
  if (Number.isInteger(linhaForcada) && matriz[linhaForcada]) return linhaForcada;

  const limite = Math.min(CFG.MAX_LINHAS_VARREDURA_CABECALHO, matriz.length);
  let melhorLinha = 0, melhorPontuacao = -1;

  for (let i = 0; i < limite; i++) {
    const linha = matriz[i] || [];
    const preenchidas = linha.filter(c => String(c || '').trim() !== '');
    if (preenchidas.length < CFG.MIN_CELULAS_PARA_CABECALHO) continue;

    const textuais = preenchidas.filter(c => isNaN(Number(String(c).replace(',', '.'))));
    const proporcaoTexto = textuais.length / preenchidas.length;

    // A linha seguinte precisa parecer "dado" (mais preenchida ou de outro tipo) — cabeçalho
    // isolado sem corpo abaixo normalmente é título, não cabeçalho de tabela.
    const proximaLinha = matriz[i + 1] || [];
    const proximaPreenchida = proximaLinha.filter(c => String(c || '').trim() !== '').length;
    if (proximaPreenchida < CFG.MIN_CELULAS_PARA_CABECALHO) continue;

    const pontuacao = preenchidas.length * (0.5 + proporcaoTexto);
    if (pontuacao > melhorPontuacao) { melhorPontuacao = pontuacao; melhorLinha = i; }
  }
  return melhorLinha;
}

/**
 * Resolve mesclagens QUE CAEM SOBRE A LINHA DE CABEÇALHO, preenchendo as células vazias do
 * intervalo mesclado com o valor da célula-âncora. Só mexe no que está de fato mesclado — não
 * "adivinha" preenchimento em colunas que apenas estão vazias por acaso.
 */
function resolverMesclagensDoCabecalho(linhaCabecalho, indiceLinha, mesclagens) {
  const linha = linhaCabecalho.slice();
  mesclagens
    .filter(m => m.s.r <= indiceLinha && m.e.r >= indiceLinha)
    .forEach(m => {
      const valorAncora = linha[m.s.c];
      if (String(valorAncora || '').trim() === '') return;
      for (let c = m.s.c; c <= m.e.c; c++) {
        if (String(linha[c] || '').trim() === '') linha[c] = valorAncora;
      }
    });
  return linha;
}

/** Remove linhas de rodapé (totais, somatórios) que ficariam misturadas aos dados. */
function removerLinhasDeRodape(linhas) {
  let removidas = 0;
  const filtradas = linhas.filter(linha => {
    const primeiraCelula = String(linha[0] || '').toLowerCase().trim();
    const ehRodape = CFG.PALAVRAS_RODAPE.some(p => primeiraCelula.indexOf(p) !== -1) ||
                     CFG.PALAVRAS_RODAPE.some(p => linha.join(' ').toLowerCase().indexOf(p) === 0);
    if (ehRodape) removidas++;
    return !ehRodape;
  });
  return { linhas: filtradas, removidas };
}

/**
 * Orquestra a leitura de xlsx: inventaria abas, escolhe uma, acha o cabeçalho, resolve
 * mesclagens e tira rodapé. Devolve no MESMO formato que o parser de CSV devolve — cabeçalho
 * na primeira posição, corpo depois — para que o resto do pipeline não precise saber a origem.
 */
function lerXlsx(buffer, sheetForcado, linhaForcada, workbookExistente) {
  garantirSheetJs();

  // Se já lemos este arquivo antes (troca de aba), reaproveita o workbook em memória em vez de
  // reler o ArrayBuffer — mais rápido e evita manter o buffer inteiro duplicado na thread.
  const workbook = workbookExistente || XLSX.read(buffer, { type: 'array', cellDates: true });
  const inventario = inventariarPlanilhas(workbook);

  log(inventario.length + ' aba(s) encontrada(s): ' +
      inventario.map(p => p.nome + ' (' + p.linhas + ' linhas)').join(', '));

  const escolhida = escolherPlanilha(inventario, sheetForcado);
  log('aba selecionada: "' + escolhida.nome + '"' +
      (inventario.length > 1 ? ' — escolhida por densidade de dados entre ' + inventario.length + ' abas' : ''));

  const indiceCabecalho = detectarLinhaCabecalho(escolhida.matriz, linhaForcada);
  if (indiceCabecalho > 0) {
    log('cabeçalho encontrado na linha ' + (indiceCabecalho + 1) +
        ' da planilha (' + indiceCabecalho + ' linha(s) de título/logotipo ignoradas)', 'alerta');
  }

  const cabecalhoBruto = escolhida.matriz[indiceCabecalho] || [];
  const cabecalhoResolvido = resolverMesclagensDoCabecalho(cabecalhoBruto, indiceCabecalho, escolhida.mesclagens);

  let corpo = escolhida.matriz.slice(indiceCabecalho + 1);
  const { linhas: corpoSemRodape, removidas } = removerLinhasDeRodape(corpo);
  if (removidas > 0) log(removidas + ' linha(s) de rodapé (total/soma) removida(s)');

  return {
    matrizCompleta: [cabecalhoResolvido].concat(corpoSemRodape),
    workbook,   // devolvido para ficar em cache no worker e permitir troca de aba sem reler o arquivo
    metadados: {
      totalPlanilhas: inventario.length,
      planilhaEscolhida: escolhida.nome,
      planilhasDisponiveis: inventario.map(p => ({ nome: p.nome, linhas: p.linhas })),
      linhaCabecalhoDetectada: indiceCabecalho
    }
  };
}

/* ================================================================================================
 * ETAPA 3 — RTK: COMPRESSÃO ANTES DA IA (genérico: serve para csv e para xlsx já estruturado)
 * ============================================================================================== */

function comprimir(matriz) {
  const estatisticas = { linhasOriginais: matriz.length, linhasVazias: 0, colunasVazias: 0, celulasTruncadas: 0 };
  if (matriz.length === 0) return { cabecalho: [], linhas: [], estatisticas };

  let cabecalho = matriz[0].map(c => String(c || '').trim());
  let corpo = matriz.slice(1);

  corpo = corpo.filter(linha => {
    const temConteudo = linha.some(c => String(c || '').trim() !== '');
    if (!temConteudo) estatisticas.linhasVazias++;
    return temConteudo;
  });

  const colunasUteis = [];
  for (let c = 0; c < cabecalho.length; c++) {
    const cabecalhoVazio = cabecalho[c] === '';
    const colunaVazia = corpo.every(linha => String(linha[c] || '').trim() === '');
    if (cabecalhoVazio && colunaVazia) { estatisticas.colunasVazias++; continue; }
    colunasUteis.push(c);
  }

  cabecalho = colunasUteis.map(c => cabecalho[c] || ('coluna_' + (c + 1)));
  corpo = corpo.map(linha => colunasUteis.map(c => {
    let valor = String(linha[c] || '').trim().replace(/\s+/g, ' ');
    if (valor.length > CFG.MAX_CARACTERES_CELULA) { valor = valor.slice(0, CFG.MAX_CARACTERES_CELULA); estatisticas.celulasTruncadas++; }
    return valor;
  }));

  return { cabecalho, linhas: corpo, estatisticas };
}

function montarAmostra(cabecalho, linhas) {
  return { colunas: cabecalho, amostra: linhas.slice(0, CFG.LINHAS_AMOSTRA).map(l => l.slice(0, cabecalho.length)) };
}

/* ================================================================================================
 * ETAPA 4 — OMNIROUTE: MAPEAMENTO SEMÂNTICO
 * ============================================================================================== */

const PROMPT_SISTEMA =
  'Você mapeia colunas de planilhas de RH industriais brasileiras para um esquema fixo. ' +
  'Responda EXCLUSIVAMENTE com um objeto JSON, sem texto antes ou depois, sem crases. ' +
  'O objeto tem como chaves os campos de destino e como valores o nome EXATO da coluna de origem ' +
  'correspondente, ou null quando não houver correspondência. ' +
  'Campos de destino: ' + CAMPOS_DESTINO.join(', ') + '. ' +
  'Não invente colunas que não estejam na lista de origem.';

async function pedirMapeamentoIA(amostra) {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), CFG.TIMEOUT_IA_MS);
  try {
    const resposta = await fetch(OMNIROUTE_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controle.signal,
      body: JSON.stringify({
        model: CFG.MODELO, temperature: 0,
        messages: [{ role: 'system', content: PROMPT_SISTEMA }, { role: 'user', content: JSON.stringify(amostra) }]
      })
    });
    if (!resposta.ok) throw new Error('Omniroute respondeu HTTP ' + resposta.status);

    const dados = await resposta.json();
    const bruto = (dados.choices && dados.choices[0] && dados.choices[0].message && dados.choices[0].message.content) || '';
    const limpo = bruto.replace(/```json|```/g, '').trim();
    const inicio = limpo.indexOf('{'), fim = limpo.lastIndexOf('}');
    if (inicio === -1 || fim === -1) throw new Error('Resposta da IA sem JSON reconhecível');
    return JSON.parse(limpo.slice(inicio, fim + 1));
  } finally {
    clearTimeout(relogio);
  }
}

function mapearPorSinonimos(cabecalho) {
  const normalizar = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                                          .toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const mapa = {};
  CAMPOS_DESTINO.forEach(campo => {
    const termos = SINONIMOS[campo] || [];
    let achado = null;
    for (const coluna of cabecalho) {
      const alvo = normalizar(coluna);
      if (alvo === normalizar(campo)) { achado = coluna; break; }
      if (termos.some(t => alvo === normalizar(t))) { achado = coluna; break; }
    }
    if (!achado) {
      for (const coluna of cabecalho) {
        const alvo = normalizar(coluna);
        if (termos.some(t => alvo.indexOf(normalizar(t)) !== -1)) { achado = coluna; break; }
      }
    }
    mapa[campo] = achado;
  });
  return mapa;
}

function validarMapeamento(mapa, cabecalho) {
  const limpo = {}; let aproveitados = 0;
  CAMPOS_DESTINO.forEach(campo => {
    const origem = mapa ? mapa[campo] : null;
    if (origem && cabecalho.indexOf(origem) !== -1) { limpo[campo] = origem; aproveitados++; }
    else limpo[campo] = null;
  });
  return { mapa: limpo, aproveitados };
}

/* ================================================================================================
 * ETAPA 5 — TRANSFORMAÇÃO E CLASSIFICAÇÃO
 * ============================================================================================== */

function normalizarTexto(t) { return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase(); }

function normalizarVinculo(valor) {
  const v = normalizarTexto(valor);
  if (!v) return 'NATIVO';
  if (v.indexOf('TERCEIR') !== -1 || v.indexOf('EMPREIT') !== -1 || v.indexOf('PJ') === 0) return 'TERCEIRIZADO';
  return 'NATIVO';
}

function normalizarStatus(valor) {
  const v = normalizarTexto(valor);
  if (!v) return 'ATIVO';
  if (v.indexOf('INATIV') !== -1 || v.indexOf('DESLIG') !== -1 || v.indexOf('AFAST') !== -1 ||
      v === 'NAO' || v === 'N' || v === 'FALSE') return 'INATIVO';
  return 'ATIVO';
}

function normalizarPerfil(valor) {
  const v = normalizarTexto(valor).replace(/[\s-]/g, '_');
  const validos = ['MASTER_ADMIN', 'DIRETORIA', 'GESTOR', 'SST', 'OPERACIONAL'];
  return validos.indexOf(v) !== -1 ? v : 'OPERACIONAL';
  // Nota: isto é só rótulo informativo na prévia. Quem decide de verdade é o back-end
  // (importarFuncionariosEmLote), que força OPERACIONAL na gravação — defesa em profundidade.
}

function transformar(cabecalho, linhas, mapa, existentes) {
  const posicao = {};
  CAMPOS_DESTINO.forEach(campo => { posicao[campo] = mapa[campo] ? cabecalho.indexOf(mapa[campo]) : -1; });

  const indiceId     = new Set((existentes.ids || []).map(normalizarTexto));
  const indiceCracha = new Set((existentes.crachas || []).map(normalizarTexto));
  const indiceEmail  = new Set((existentes.emails || []).map(normalizarTexto));
  const vistosNoArquivo = new Set();

  const validos = [], duplicados = [], invalidos = [];
  const pegar = (linha, campo) => posicao[campo] === -1 ? '' : String(linha[posicao[campo]] || '').trim();

  linhas.forEach((linha, i) => {
    if (i % 200 === 0) progresso(i, linhas.length);

    const registro = {
      id_funcionario:    pegar(linha, 'id_funcionario'),
      nome_completo:     pegar(linha, 'nome_completo'),
      email_corporativo: pegar(linha, 'email_corporativo').toLowerCase(),
      id_cracha:         pegar(linha, 'id_cracha'),
      setor:             pegar(linha, 'setor'),
      funcao:            pegar(linha, 'funcao'),
      vinculo:           normalizarVinculo(pegar(linha, 'vinculo')),
      perfil_acesso:     normalizarPerfil(pegar(linha, 'perfil_acesso')),
      status:            normalizarStatus(pegar(linha, 'status')),
      _linhaOrigem:      i + 2
    };

    if (!registro.id_funcionario || !registro.nome_completo) {
      invalidos.push({ linha: registro._linhaOrigem,
                       motivo: !registro.id_funcionario ? 'sem matrícula' : 'sem nome',
                       amostra: linha.slice(0, 4).join(' | ') });
      return;
    }

    const chaveId = normalizarTexto(registro.id_funcionario);
    if (vistosNoArquivo.has(chaveId)) { duplicados.push({ id: registro.id_funcionario, nome: registro.nome_completo, motivo: 'repetido no próprio arquivo' }); return; }
    if (indiceId.has(chaveId)) { duplicados.push({ id: registro.id_funcionario, nome: registro.nome_completo, motivo: 'matrícula já cadastrada' }); return; }
    if (registro.id_cracha && indiceCracha.has(normalizarTexto(registro.id_cracha))) { duplicados.push({ id: registro.id_funcionario, nome: registro.nome_completo, motivo: 'crachá já em uso' }); return; }
    if (registro.email_corporativo && indiceEmail.has(normalizarTexto(registro.email_corporativo))) { duplicados.push({ id: registro.id_funcionario, nome: registro.nome_completo, motivo: 'e-mail já cadastrado' }); return; }

    vistosNoArquivo.add(chaveId);
    validos.push(registro);
  });

  progresso(linhas.length, linhas.length);
  return { validos, duplicados, invalidos };
}

/* ================================================================================================
 * ORQUESTRAÇÃO
 * ------------------------------------------------------------------------------------------------
 * Guarda o resultado da leitura em memória do worker (ultimaLeitura) para permitir reprocessar
 * com outra aba/linha de cabeçalho sem que a thread principal precise reenviar o arquivo inteiro.
 * ============================================================================================== */

let ultimaLeitura = null;   // { nomeArquivo, extensao, existentes, workbook } — só existe para xlsx

self.onmessage = async (evento) => {
  const dados = evento.data || {};

  if (dados.tipo === 'trocarPlanilha') {
    await reprocessarComEstrutura(dados.sheetForcado, dados.linhaForcada);
    return;
  }

  if (dados.tipo !== 'iniciar') return;
  await processarArquivo(dados);
};

async function processarArquivo(dados) {
  const { nomeArquivo, extensao, conteudoTexto, bufferPlanilha, existentes } = dados;
  const comecou = Date.now();

  try {
    let cabecalho, linhas, estatisticas, metadadosPlanilha = null;

    /* ---------- 1. LEITURA ---------- */
    etapa('Leitura', 'analisando ' + (nomeArquivo || 'arquivo'));

    const ext = (extensao || '').toLowerCase();
    let matrizBruta;

    if (ext === 'xlsx' || ext === 'xls') {
      const resultado = lerXlsx(bufferPlanilha);
      matrizBruta = resultado.matrizCompleta;
      metadadosPlanilha = resultado.metadados;
      ultimaLeitura = { nomeArquivo, extensao: ext, existentes, workbook: resultado.workbook };
    } else {
      ultimaLeitura = null;   // troca de aba não se aplica a CSV/TSV
      const primeiraQuebra = conteudoTexto.indexOf('\n');
      const separador = detectarSeparador(conteudoTexto.slice(0, primeiraQuebra === -1 ? conteudoTexto.length : primeiraQuebra));
      matrizBruta = lerCsv(conteudoTexto, separador);
      log('separador "' + (separador === '\t' ? 'TAB' : separador) + '" · ' + matrizBruta.length + ' linhas brutas');
    }

    if (matrizBruta.length < 2) throw new Error('O arquivo não tem cabeçalho e pelo menos uma linha de dados.');

    /* ---------- 2. RTK ---------- */
    etapa('Compressão RTK', 'removendo vazios e preparando amostra');
    ({ cabecalho, linhas, estatisticas } = comprimir(matrizBruta));

    if (linhas.length === 0) throw new Error('Nenhuma linha com conteúdo depois da limpeza.');
    if (linhas.length > CFG.MAX_REGISTROS) throw new Error('Arquivo com ' + linhas.length + ' linhas excede o limite de ' + CFG.MAX_REGISTROS + ' por importação.');

    log('descartados: ' + estatisticas.linhasVazias + ' linhas vazias, ' +
        estatisticas.colunasVazias + ' colunas vazias, ' + estatisticas.celulasTruncadas + ' células truncadas');

    await continuarPipeline(cabecalho, linhas, existentes, metadadosPlanilha, comecou);

  } catch (erro) {
    self.postMessage({ tipo: 'erro', mensagem: erro.message || String(erro) });
  }
}

/**
 * Reprocessa um xlsx já lido escolhendo outra aba e/ou outra linha de cabeçalho, SEM que a tela
 * precise reenviar o arquivo. Só funciona para xlsx (ultimaLeitura.workbook fica em memória do
 * worker entre mensagens, já que o worker não é destruído entre uma chamada e outra).
 */
async function reprocessarComEstrutura(sheetForcado, linhaForcada) {
  if (!ultimaLeitura || !ultimaLeitura.workbook) {
    self.postMessage({ tipo: 'erro', mensagem: 'Nenhuma planilha Excel em memória para reprocessar. Importe o arquivo novamente.' });
    return;
  }
  const comecou = Date.now();
  try {
    etapa('Reprocessamento', 'aplicando nova seleção de aba/cabeçalho');

    const resultado = lerXlsx(null, sheetForcado, linhaForcada, ultimaLeitura.workbook);
    const { cabecalho, linhas, estatisticas } = comprimir(resultado.matrizCompleta);

    log('descartados: ' + estatisticas.linhasVazias + ' linhas vazias, ' + estatisticas.colunasVazias + ' colunas vazias');
    await continuarPipeline(cabecalho, linhas, ultimaLeitura.existentes, resultado.metadados, comecou);

  } catch (erro) {
    self.postMessage({ tipo: 'erro', mensagem: erro.message || String(erro) });
  }
}

async function continuarPipeline(cabecalho, linhas, existentes, metadadosPlanilha, comecou) {
  const amostra = montarAmostra(cabecalho, linhas);
  const tokensCheios  = Math.ceil(JSON.stringify({ colunas: cabecalho, amostra: linhas }).length / 4);
  const tokensAmostra = Math.ceil(JSON.stringify(amostra).length / 4);
  const economia = tokensCheios > 0 ? Math.round((1 - tokensAmostra / tokensCheios) * 100) : 0;

  /* ---------- 3. OMNIROUTE ---------- */
  etapa('Omniroute', 'mapeamento semântico das colunas');
  log('à IA vão ' + cabecalho.length + ' colunas + ' + amostra.amostra.length + ' linhas de amostra (~' +
      tokensAmostra + ' tokens no lugar de ~' + tokensCheios + ' — economia de ' + economia + '%)', 'ok');

  let mapaBruto = null, origemMapa = 'IA';
  try {
    mapaBruto = await pedirMapeamentoIA(amostra);
    log('mapeamento recebido do Omniroute');
  } catch (erroIa) {
    origemMapa = 'dicionário local';
    log('Omniroute indisponível (' + erroIa.message + '). Usando dicionário local.', 'alerta');
    mapaBruto = mapearPorSinonimos(cabecalho);
  }

  const { mapa, aproveitados } = validarMapeamento(mapaBruto, cabecalho);
  if (!mapa.id_funcionario || !mapa.nome_completo) {
    const reserva = mapearPorSinonimos(cabecalho);
    mapa.id_funcionario = mapa.id_funcionario || reserva.id_funcionario;
    mapa.nome_completo  = mapa.nome_completo  || reserva.nome_completo;
    log('campos essenciais completados pelo dicionário local', 'alerta');
  }
  if (!mapa.id_funcionario || !mapa.nome_completo) {
    throw new Error('Não foi possível identificar as colunas de matrícula e nome. ' +
                    (metadadosPlanilha ? 'Confira se a aba/linha de cabeçalho escolhida está certa.' : 'Renomeie os cabeçalhos e tente de novo.'));
  }
  log(aproveitados + ' de ' + CAMPOS_DESTINO.length + ' campos mapeados via ' + origemMapa);

  /* ---------- 4. TRANSFORMAÇÃO ---------- */
  etapa('Transformação', 'aplicando o mapeamento em ' + linhas.length + ' linhas');
  const resultado = transformar(cabecalho, linhas, mapa, existentes || {});
  log(resultado.validos.length + ' válidos · ' + resultado.duplicados.length + ' duplicados · ' + resultado.invalidos.length + ' inválidos');

  /* ---------- 5. PRÉVIA ---------- */
  self.postMessage({
    tipo: 'previa',
    duracaoMs: Date.now() - comecou,
    origemMapa, mapa, estatisticas: { celulasTruncadas: 0 }, economiaTokens: economia,
    metadadosPlanilha,               // { totalPlanilhas, planilhaEscolhida, planilhasDisponiveis, linhaCabecalhoDetectada } ou null p/ CSV
    novos: resultado.validos, duplicados: resultado.duplicados, invalidos: resultado.invalidos
  });
}
