/**
 * Utilitário de Setup — Padroniza e renomeia automaticamente as abas da planilha
 * para corresponderem exatamente ao dicionário CFG.ABAS do Code.js v2.0.
 */
function util_PadronizarNomesAbas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Mapeamento de termos antigos/alternativos para o nome oficial correto
  const dePara = {
    'Colaboradores': 'Funcionarios',
    'Entregas_EPI': 'Movimentacoes_Trocas',
    'Gamificacao': 'Gamificacao_Mentoria',
    'Controle_Acidentes': 'Acoes_Preventivas'
  };

  // 1. Renomeia apenas se o destino ainda não existir para evitar conflitos
  for (const antigo in dePara) {
    const novo = dePara[antigo];
    const abaAntiga = ss.getSheetByName(antigo);
    const abaNova = ss.getSheetByName(novo);

    if (abaAntiga && !abaNova && antigo !== novo) {
      abaAntiga.setName(novo);
      console.log('Renomeado: "' + antigo + '" ➔ "' + novo + '"');
    }
  }

  // 2. Cria abas oficiais ausentes de forma segura
  const oficiais = [
    'Funcionarios', 'Equipamentos_EPI_EPC', 'Movimentacoes_Trocas',
    'Log_Auditoria', 'Gamificacao_Mentoria', 'Setores', 'Funcoes',
    'Empresas_Terceiras', 'Treinamentos', 'Jornada_Consolidada', 'Acoes_Preventivas'
  ];

  oficiais.forEach((nomeOficial) => {
    if (!ss.getSheetByName(nomeOficial)) {
      ss.insertSheet(nomeOficial);
      console.log('Criada aba ausente: "' + nomeOficial + '"');
    }
  });

  console.log('SUCESSO: Todas as abas foram padronizadas e verificadas!');
}