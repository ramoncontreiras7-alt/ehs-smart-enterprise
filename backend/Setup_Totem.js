/**
 * Utilit�rio de Setup - Executar apenas via Editor do Google Apps Script
 */
function inicializarTotemKey() {
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty("TOTEM_KEY");
  
  if (!key) {
    key = Utilities.getUuid(); // Gera chave segura
    props.setProperty("TOTEM_KEY", key);
    Logger.log("SUCESSO: Nova TOTEM_KEY gerada.");
  } else {
    Logger.log("AVISO: TOTEM_KEY j� existente encontrada.");
  }
  
  const devUrl = ScriptApp.getService().getUrl();
  Logger.log("=========================================");
  Logger.log("URL DE ACESSO AO TOTEM:");
  Logger.log(devUrl + "?page=totem&totem_key=" + key);
  Logger.log("=========================================");
}