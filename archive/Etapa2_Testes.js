function testarSistemaCompleto() {
  console.log('Teste 1 - Login:', api_LoginUnificado('222.222.222-22', 'Ehs@2026'));
  console.log('Teste 2 - Bater Ponto:', api_BaterPonto('222.222.222-22', 'TOTEM-01'));
  console.log('Teste 3 - Alertas Supervisor:', api_BuscarAlertasSupervisor('1000'));
  console.log('Teste 4 - Relatorio Gamificacao:', api_RelatorioGamificacao('1000'));
}
