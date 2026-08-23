/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EHS SMART ENTERPRISE · Setup_Schema.gs (Otimizado)
 * ═══════════════════════════════════════════════════════════════════════════
 */

function setup_GerarTokensTotem(ids) {
  ids = ids || ['TOTEM_01', 'TOTEM_02'];
  const tokens = {};
  ids.forEach((id) => { tokens[id] = Utilities.getUuid().replace(/-/g, ''); });

  // Salva usando a MESMA chave que o Code.gs lê (CFG_TOTEM.CHAVE_PROPS = 'TOTEM_TOKENS')
  PropertiesService.getScriptProperties().setProperty('TOTEM_TOKENS', JSON.stringify(tokens));

  const base = ScriptApp.getService().getUrl();
  const linhas = ['TOKENS GERADOS COM SUCESSO:', ''];
  ids.forEach((id) => {
    linhas.push(id + ': ' + base + '?tela=totem&token=' + tokens[id]);
  });
  console.log(linhas.join('\n'));
  return linhas.join('\n');
}