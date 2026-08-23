/**
 * Utilit�rio de Setup � Popula a base de dados com informa��es completas
 * para teste e garante o e-mail do criador como MASTER_ADMIN absoluto.
 */
function util_GerarMassaDeDados() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const emailAdmin = 'ramoncontreiras7@gmail.com'; // Seu e-mail absoluto

  // 1. Limpa os dados de teste antigos (preserva cabe�alhos)
  const abasLimpar = ['Funcionarios', 'Setores', 'Funcoes', 'Equipamentos_EPI_EPC', 'Movimentacoes_Trocas', 'Acoes_Preventivas', 'Log_Auditoria'];
  abasLimpar.forEach(function(nome) {
    const aba = ss.getSheetByName(nome);
    if (aba && aba.getLastRow() > 1) {
      aba.getRange(2, 1, aba.getLastRow() - 1, aba.getLastColumn()).clearContent();
    }
  });

  // 2. Cria Setores
  const abaSetores = ss.getSheetByName('Setores');
  abaSetores.getRange(2, 1, 2, 12).setValues([
    ['SET-01', 'Produ��o Principal', 'CC-100', 'UNI-01', '1000', '', 'ALTO', 'NR-06;NR-12', 'N�O', 'SIM', 'Ru�do, M�quinas', 'ATIVO'],
    ['SET-02', 'Manuten��o Geral', 'CC-200', 'UNI-01', '1000', '', 'CR�TICO', 'NR-06;NR-10;NR-35', 'SIM', 'SIM', 'El�trico, Altura', 'ATIVO']
  ]);

  // 3. Cria Fun��es com EPIs e NRs amarradas
  const abaFuncoes = ss.getSheetByName('Funcoes');
  abaFuncoes.getRange(2, 1, 3, 14).setValues([
    ['FUN-01', 'Operador de M�quina', 'SET-01', '7891', 'EPI-01;EPI-02', '', 'NR-06;NR-12', '', '', 'N�O', '3', '40', 'SIM', 'ATIVO'],
    ['FUN-02', 'Mec�nico de Manuten��o', 'SET-02', '9101', 'EPI-01;EPI-03', 'EPI-04', 'NR-06;NR-10;NR-35', '', '', 'SIM', '4', '40', 'SIM', 'ATIVO'],
    ['FUN-03', 'Diretor Geral / EHS', 'SET-01', '1111', '', '', '', '', '', 'N�O', '1', '0', 'N�O', 'ATIVO']
  ]);

  // 4. Cria Equipamentos no Estoque (EPIs)
  const abaEpis = ss.getSheetByName('Equipamentos_EPI_EPC');
  abaEpis.getRange(2, 1, 4, 20).setValues([
    ['EPI-01', 'Capacete de Seguran�a', 'EPI', 'Cabe�a', 'MSA', '12345', '2030-01-01', 'V�LIDO', '1800', 'N�O', '', 'UN', '500', '50', '20', 'NORMAL', '35.50', 'ALMOX-A', 'NR-06', 'ATIVO'],
    ['EPI-02', 'Protetor Auricular Plug', 'EPI', 'Audi��o', '3M', '54321', '2030-01-01', 'V�LIDO', '30', 'SIM', '7', 'UN', '1000', '100', '50', 'NORMAL', '2.50', 'ALMOX-A', 'NR-06', 'ATIVO'],
    ['EPI-03', 'Luva de Vaqueta', 'EPI', 'M�os', 'Danny', '98765', '2030-01-01', 'V�LIDO', '60', 'N�O', '', 'PAR', '300', '30', '10', 'NORMAL', '15.00', 'ALMOX-B', 'NR-06', 'ATIVO'],
    ['EPI-04', 'Cinto de Seguran�a', 'EPI', 'Queda', 'Carabina', '11223', '2030-01-01', 'V�LIDO', '1800', 'N�O', '', 'UN', '50', '5', '2', 'NORMAL', '150.00', 'ALMOX-C', 'NR-35', 'ATIVO']
  ]);

  // 5. Cadastra Funcion�rios e as Permiss�es
  const abaFunc = ss.getSheetByName('Funcionarios');
  const dadosFunc = [
    // VOC�: Chave-mestra absoluta (Matr�cula 1000)
    ['1000', 'Ramon Contreiras (Mestre)', '111.111.111-11', 'NATIVO', 'Matriz', 'SET-01', 'FUN-03', 'ADMIN', '', '', '', 'RFID-1000', '', '2020-01-01', '', 'ATIVO', '', new Date(), '', '', 'ATIVO', '', 'MASTER_ADMIN', '', emailAdmin],
    // Operador comum para testes no Totem (Matr�cula 2001)
    ['2001', 'Carlos Silva (Operador)', '222.222.222-22', 'NATIVO', 'Matriz', 'SET-01', 'FUN-01', 'FUNCIONARIO', '', '', '1000', 'RFID-2001', '', '2023-01-01', '', 'ATIVO', '', new Date(), '', '', 'ATIVO', '', 'OPERACIONAL', '', ''],
    // Operadora (Matr�cula 2002)
    ['2002', 'Ana Souza (Operadora)', '333.333.333-33', 'NATIVO', 'Matriz', 'SET-01', 'FUN-01', 'FUNCIONARIO', '', '', '1000', 'RFID-2002', '', '2023-02-01', '', 'ATIVO', '', new Date(), '', '', 'ATIVO', '', 'OPERACIONAL', '', ''],
    // Mec�nico para testar NR-35/NR-10 (Matr�cula 3001)
    ['3001', 'Roberto Santos (Mec�nico)', '444.444.444-44', 'NATIVO', 'Matriz', 'SET-02', 'FUN-02', 'FUNCIONARIO', '', '', '1000', 'RFID-3001', '', '2022-05-15', '', 'ATIVO', '', new Date(), '', '', 'ATIVO', '', 'OPERACIONAL', '', ''],
    // Terceirizado para testar bloqueios (Matr�cula 4001)
    ['4001', 'Fernando Terceiro', '555.555.555-55', 'TERCEIRIZADO', 'Empresa X', 'SET-02', 'FUN-02', 'TERCEIRIZADO', '', '', '1000', 'RFID-4001', '', '2024-01-01', '', 'ATIVO', '', new Date(), '', '', 'ATIVO', '', 'OPERACIONAL', '', '']
  ];
  abaFunc.getRange(2, 1, dadosFunc.length, 25).setValues(dadosFunc);

  Logger.log('SUCESSO TOTAL! A base foi populada e seu e-mail configurado como MASTER_ADMIN absoluto (Matr�cula: 1000).');
}