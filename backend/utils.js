/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EHS SMART ENTERPRISE · utils.js — v2.0
 * Funções utilitárias de leitura/escrita na planilha.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const _CACHE_EM_MEMORIA = {};
const _CACHE_ABAS_EM_MEMORIA = {};
const _CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
const _CACHE_METRICAS = { leituras: 0, hits: 0, misses: 0 };

function _aba(nome) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nomeSeguro = nome ? String(nome) : 'SEM_NOME';
  let sh = ss.getSheetByName(nomeSeguro);
  if (!sh) {
    sh = ss.insertSheet(nomeSeguro);
    sh.appendRow([nomeSeguro]);
  }
  return sh;
}

function _lerTudo(nomeAba) {
  const chave = String(nomeAba || '');
  
  const cacheMem = _CACHE_ABAS_EM_MEMORIA[chave];
  if (cacheMem && (Date.now() - cacheMem.ts) < _CACHE_TTL_MS) {
    _CACHE_METRICAS.hits++;
    return cacheMem.dados;
  }
  
  const cacheService = CacheService.getScriptCache();
  const cachedService = cacheService.get('aba_' + chave);
  if (cachedService) {
    _CACHE_METRICAS.hits++;
    const dados = JSON.parse(cachedService);
    _CACHE_ABAS_EM_MEMORIA[chave] = { dados: dados, ts: Date.now() };
    return dados;
  }
  
  _CACHE_METRICAS.leituras++;
  _CACHE_METRICAS.misses++;
  
  const sh = _aba(nomeAba);
  const ultima = sh.getLastRow();
  if (ultima < 2) {
    const vazio = [];
    _CACHE_ABAS_EM_MEMORIA[chave] = { dados: vazio, ts: Date.now() };
    cacheService.put('aba_' + chave, JSON.stringify(vazio), 300);
    return vazio;
  }
  
  const dados = sh.getRange(2, 1, ultima - 1, sh.getLastColumn()).getValues();
  _CACHE_ABAS_EM_MEMORIA[chave] = { dados: dados, ts: Date.now() };
  cacheService.put('aba_' + chave, JSON.stringify(dados), 300);
  return dados;
}

function _invalidarCache(nomeAba) {
  const chave = String(nomeAba || '');
  delete _CACHE_ABAS_EM_MEMORIA[chave];
  delete _CACHE_EM_MEMORIA['FUNCIONARIOS_MATRICULA'];
  delete _CACHE_EM_MEMORIA['FUNCIONARIOS_EMAIL'];
}

function _invalidarCacheGeral() {
  for (const k in _CACHE_ABAS_EM_MEMORIA) delete _CACHE_ABAS_EM_MEMORIA[k];
  for (const k in _CACHE_EM_MEMORIA) delete _CACHE_EM_MEMORIA[k];
}

function _buscarLinha(nomeAba, coluna, chave) {
  const dados = _lerTudo(nomeAba);
  const alvo = String(chave).trim().toUpperCase();
  for (let i = 0; i < dados.length; i++) {
    if (String(dados[i][coluna - 1]).trim().toUpperCase() === alvo) {
      return { linha: i + 2, dados: dados[i] };
    }
  }
  return null;
}

function _obterUsuario(matricula) {
  if (!matricula) return null;
  const chave = 'FUNCIONARIOS_MATRICULA';
  const cache = _CACHE_EM_MEMORIA[chave];
  if (!cache || (Date.now() - cache.ts) >= _CACHE_TTL_MS) {
    const c = CFG.COL_FUNCIONARIOS;
    const mapa = {};
    _lerTudo(CFG.ABAS.FUNCIONARIOS).forEach(function (f) {
      const mat = String(f[c.matricula - 1] || '').trim().toUpperCase();
      if (mat) mapa[mat] = f;
    });
    _CACHE_EM_MEMORIA[chave] = { mapa: mapa, ts: Date.now() };
  }

  const c = CFG.COL_FUNCIONARIOS;
  const alvo = String(matricula).trim().toUpperCase();
  const cacheEntry = _CACHE_EM_MEMORIA[chave];
  const r = (cacheEntry && cacheEntry.mapa) ? cacheEntry.mapa[alvo] : undefined;
  if (!r) return null;

  const perfil = String(r[c.perfil_rbac - 1] || '').trim().toUpperCase();

  let nivel = String(r[c.nivel_hierarquico - 1] || '').trim().toUpperCase();
  if (!CFG.HIERARQUIA[nivel]) nivel = _nivelPadraoPara(perfil);

  const combinacoesOk = CFG.COMBINACOES_VALIDAS[nivel] || [];
  let rebaixado = false;
  if (combinacoesOk.indexOf(perfil) === -1) {
    nivel = _nivelPadraoPara(perfil);
    rebaixado = true;
  }

  return {
    matricula: r[c.matricula - 1],
    nome_completo: r[c.nome_completo - 1],
    tipo_vinculo: r[c.tipo_vinculo - 1],
    empresa: r[c.empresa - 1],
    setor: r[c.setor - 1],
    funcao: r[c.funcao - 1],
    perfil_rbac: perfil,
    nivel_hierarquico: nivel,
    nivel_rebaixado_por_inconsistencia: rebaixado,
    unidades_visiveis: _listar(r[c.unidades_visiveis - 1]),
    id_gestor: r[c.id_gestor - 1],
    data_fim_contrato: r[c.data_fim_contrato - 1],
    status: r[c.status - 1],
    status_efetivo: r[c.status_efetivo - 1] || r[c.status - 1],
    motivo_bloqueio_automatico: r[c.motivo_bloqueio_automatico - 1] || r[c.motivo_bloqueio - 1] || '',
    linha: r.linha
  };
}

function _obterUsuarioPorEmail(email) {
  if (!email) return null;
  const chave = 'FUNCIONARIOS_EMAIL';
  const cache = _CACHE_EM_MEMORIA[chave];
  if (!cache || (Date.now() - cache.ts) >= _CACHE_TTL_MS) {
    const c = CFG.COL_FUNCIONARIOS;
    const mapa = {};
    _lerTudo(CFG.ABAS.FUNCIONARIOS).forEach(function (f) {
      const emailLinha = String(f[c.email_corporativo - 1] || '').trim().toLowerCase();
      if (emailLinha) mapa[emailLinha] = f[c.matricula - 1];
    });
    _CACHE_EM_MEMORIA[chave] = { mapa: mapa, ts: Date.now() };
  }

  const alvo = String(email).trim().toLowerCase();
  const mat = _CACHE_EM_MEMORIA[chave].mapa[alvo];
  return mat ? _obterUsuario(mat) : null;
}

function _listar(texto) {
  if (!texto) return [];
  return String(texto).split(';')
    .map(function (t) { return t.trim(); })
    .filter(function (t) { return t !== ''; });
}

function _diasAte(data) {
  if (!data) return null;
  const d = (data instanceof Date) ? data : new Date(data);
  if (isNaN(d.getTime())) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - hoje) / 86400000);
}

function _formatarData(d) {
  if (!d) return '';
  return Utilities.formatDate(new Date(d), Session.getScriptTimeZone(), 'dd/MM/yyyy');
}

function _sha256(texto) {
  const entrada = texto ? String(texto) : '';
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, entrada, Utilities.Charset.UTF_8);
  return bytes.map(function (b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
}

function _norm(v) {
  return String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
}

function _validarEmail(email) {
  if (!email) return { ok: false, erro: 'E-mail vazio.' };
  const e = String(email).trim().toLowerCase();
  if (e.indexOf('@') === -1) return { ok: false, erro: 'E-mail sem @.' };
  const [local, dominio] = e.split('@');
  if (!local || !dominio) return { ok: false, erro: 'E-mail incompleto.' };
  if (dominio.indexOf('.') === -1) return { ok: false, erro: 'Domínio inválido.' };
  if (local.length > 64 || dominio.length > 255) return { ok: false, erro: 'E-mail excede tamanho máximo.' };
  return { ok: true, normalizado: e };
}
