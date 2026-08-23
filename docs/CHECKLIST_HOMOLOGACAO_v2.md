# Checklist de Homologação — EHS Smart Enterprise v2.0
**Data:** 2026-08-19  
**Versão:** Alinhada ao `1-SALA DE CONTROLE GERAL/Code.gs` (canônico) + `3-ETL/ETL_Ingestao.gs` (refatorado) + `2-FRONTEND` (dois painéis)  
**Como usar:** Abra o editor Apps Script do projeto. Cada linha tem um **Comando/Teste** que você cola no console (ou executa como função). Marque ✅ quando o **Resultado Esperado** acontecer. Se ❌, anote o erro na coluna **Observação**.

---

## 1. SCHEMA & CONFIGURAÇÃO (Code.gs)

| # | Item | Comando / Teste | Resultado Esperado | ✅/❌ | Observação |
|---|------|-----------------|--------------------|------|------------|
| 1.1 | `CFG.ABAS` tem nomes corretos | `Logger.log(JSON.stringify(CFG.ABAS))` | `{FUNCIONARIOS:"Funcionarios",EQUIPAMENTOS:"Equipamentos_EPI_EPC",LOG:"Log_Auditoria",ACOES_PREVENTIVAS:"Acoes_Preventivas",...}` | | |
| 1.2 | `CFG.COL_FUNCIONARIOS` posições fixas 1–25 | `Logger.log(JSON.stringify(CFG.COL_FUNCIONARIOS))` | `matricula:1, nome_completo:2, cpf:3, tipo_vinculo:4, empresa:5, setor:6, funcao:7, perfil_rbac:8, cartao_rfid:12, status:16, status_efetivo:21, nivel_hierarquico:23, email_corporativo:25` | | |
| 1.3 | `CFG.PERFIS` = 5 valores canônicos | `Logger.log(CFG.PERFIS)` | `["FUNCIONARIO","TERCEIRIZADO","GESTOR","SST","ADMIN"]` | | |
| 1.4 | `CFG.HIERARQUIA` = 4 níveis com pesos | `Logger.log(JSON.stringify(CFG.HIERARQUIA))` | `OPERACIONAL(peso:1), GESTOR(peso:2), DIRETORIA(peso:3), MASTER_ADMIN(peso:4)` | | |
| 1.5 | `CFG.COMBINACOES_VALIDAS` bate com docs | `Logger.log(JSON.stringify(CFG.COMBINACOES_VALIDAS))` | `MASTER_ADMIN:["ADMIN"], DIRETORIA:["ADMIN","GESTOR","SST"], GESTOR:["GESTOR","SST","ADMIN"], OPERACIONAL:["FUNCIONARIO","TERCEIRIZADO","GESTOR","SST","ADMIN"]` | | |
| 1.6 | `CFG.TIMEOUT_LOCK` = 20000 | `Logger.log(CFG.TIMEOUT_LOCK)` | `20000` | | |
| 1.7 | Aba `Funcionarios` existe com 25 colunas | `SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Funcionarios').getLastColumn()` | `25` | | |
| 1.8 | Aba `Equipamentos_EPI_EPC` existe | `!!SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Equipamentos_EPI_EPC')` | `true` | | |
| 1.9 | Aba `Log_Auditoria` existe com 19 colunas | `SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Log_Auditoria').getLastColumn()` | `19` | | |
| 1.10 | Nenhuma constante legada (`CONFIG`, `COLUNAS`, `STATUS_ATIVO`) | `grep -r "CONFIG\\|COLUNAS\\|STATUS_ATIVO" Code.gs` | **Nenhuma ocorrência** (0 matches) | | |

---

## 2. RBAC BIDIMENSIONAL — COMBINAÇÕES CRÍTICAS

| # | Item | Comando / Teste | Resultado Esperado | ✅/❌ | Observação |
|---|------|-----------------|--------------------|------|------------|
| 2.1 | `_exigirAcesso` existe e lança em negado | `_exigirAcesso('INEXISTENTE',{perfis:['ADMIN'],nivelMinimo:'MASTER_ADMIN',contexto:'TESTE'})` | **Throw** "Acesso negado: usuário não identificado." | | |
| 2.2 | Admin válido (ADMIN + MASTER_ADMIN) passa | Criar usuário teste: matrícula `ADM001`, `perfil_rbac=ADMIN`, `nivel_hierarquico=MASTER_ADMIN`, `status=ATIVO`. Executar: `_exigirAcesso('ADM001',{perfis:['ADMIN'],nivelMinimo:'MASTER_ADMIN',contexto:'TESTE'})` | Retorna objeto usuário (não throw) | | |
| 2.3 | ADMIN + GESTOR é REBAIXADO (combinação inválida) | Criar usuário `ADM002`: `perfil_rbac=ADMIN`, `nivel_hierarquico=GESTOR`. Executar `_exigirAcesso('ADM002',{perfis:['ADMIN'],nivelMinimo:'MASTER_ADMIN',contexto:'TESTE'})` | **Throw** "Nível GESTOR abaixo do mínimo exigido (MASTER_ADMIN)" + log CRÍTICO em `Log_Auditoria` com `justificativa` contendo "rebaixado" | | |
| 2.4 | GESTOR + SETORIAL passa para perfis GESTOR/SST/ADMIN | Criar `GES001`: `perfil_rbac=GESTOR`, `nivel_hierarquico=GESTOR`. `_exigirAcesso('GES001',{perfis:['GESTOR','SST','ADMIN'],nivelMinimo:'GESTOR',contexto:'TESTE'})` | Retorna usuário | | |
| 2.5 | OPERACIONAL + FUNCIONARIO passa | Criar `OP001`: `perfil_rbac=FUNCIONARIO`, `nivel_hierarquico=OPERACIONAL`. `_exigirAcesso('OP001',{perfis:['FUNCIONARIO','TERCEIRIZADO'],nivelMinimo:'OPERACIONAL',contexto:'TESTE'})` | Retorna usuário | | |
| 2.6 | SST + DIRETORIA é REBAIXADO (inválido) | Criar `SST001`: `perfil_rbac=SST`, `nivel_hierarquico=DIRETORIA`. `_exigirAcesso('SST001',{perfis:['SST'],nivelMinimo:'DIRETORIA',contexto:'TESTE'})` | **Throw** nível abaixo + log CRÍTICO | | |
| 2.7 | Usuário `status_efetivo=INATIVO` é negado mesmo com perfil alto | Criar `ADM003`: `perfil_rbac=ADMIN`, `nivel_hierarquico=MASTER_ADMIN`, `status=INATIVO` (status_efetivo fórmula reflete). `_exigirAcesso('ADM003',{perfis:['ADMIN'],nivelMinimo:'MASTER_ADMIN',contexto:'TESTE'})` | **Throw** "Usuário com status INATIVO" | | |
| 2.8 | `_nivelPadraoPara` mapeia corretamente | `_nivelPadraoPara('ADMIN')`, `_nivelPadraoPara('GESTOR')`, `_nivelPadraoPara('SST')`, `_nivelPadraoPara('FUNCIONARIO')` | `MASTER_ADMIN`, `GESTOR`, `GESTOR`, `OPERACIONAL` | | |

---

## 3. AUDITORIA & LOG (hash chain)

| # | Item | Comando / Teste | Resultado Esperado | ✅/❌ | Observação |
|---|------|-----------------|--------------------|------|------------|
| 3.1 | `_gravarLogSemTrava` retorna `idLog` formato `LOG-YYYYMMDD-NNNNNN` | `_gravarLogSemTrava({matricula_usuario:'TESTE',perfil_rbac_no_momento:'FUNCIONARIO',nivel_hierarquico_no_momento:'OPERACIONAL',acao_realizada:'TESTE_HOMOLOG',tabela_afetada:'TESTE',id_registro_afetado:'X',valor_novo:'OK',origem_acao:'TESTE',resultado:'SUCESSO',criticidade:'INFO'})` | String iniciando com `LOG-` + data de hoje + 6 dígitos | | |
| 3.2 | Hash chain íntegra após 1 log | `verificarIntegridadeLog()` | `{integro:true,total_registros:N,problemas:[]}` | | |
| 3.3 | `registrarLog` pega lock e grava igual | `registrarLog({...mesmo evento...})` | Mesmo formato de `idLog`; `verificarIntegridadeLog()` continua `integro:true` | | |
| 3.4 | Log captura `nivel_hierarquico_no_momento` (coluna S = 19) | Ler última linha de `Log_Auditoria` após 3.1 | Coluna 19 = `OPERACIONAL` (ou o nível do teste) | | |
| 3.5 | Tentativa de rebaixamento gera log CRÍTICO | Ver em `Log_Auditoria` após teste 2.3 ou 2.6 | Linha com `criticidade=CRITICO`, `acao_realizada=ALTERACAO_PERMISSAO`, `justificativa` contém "rebaixado" | | |

---

## 4. ETL — IMPORTAÇÃO DE FUNCIONÁRIOS (ETL_Ingestao.gs)

| # | Item | Comando / Teste | Resultado Esperado | ✅/❌ | Observação |
|---|------|-----------------|--------------------|------|------------|
| 4.1 | `importarFuncionariosEmLote` existe e aceita `matriculaSolicitante` opcional | `importarFuncionariosEmLote({registros:[],origem:'teste',matriculaSolicitante:'ADM001'})` | `{sucesso:false,motivo:'LOTE_VAZIO',...}` (não throw por assinatura) | | |
| 4.2 | Rejeita lote > 500 | `importarFuncionariosEmLote({registros:new Array(501).fill({matricula:'X',nome_completo:'Y'}),origem:'teste',matriculaSolicitante:'ADM001'})` | `{sucesso:false,motivo:'LOTE_EXCEDIDO',...}` | | |
| 4.3 | **Escalonamento rebaixado** — perfil sugerido MASTER_ADMIN → gravado FUNCIONARIO/OPERACIONAL | `teste_8_importacaoBlindada()` (função inteira) | Logger: `APROVADO (1/3): escalonamento rebaixado → (FUNCIONARIO, OPERACIONAL).` | | |
| 4.4 | **Vocabulário legado traduzido** — `id_funcionario`→`matricula`, `id_cracha`→`cartao_rfid`, `vinculo`→`tipo_vinculo` | Mesmo `teste_8_importacaoBlindada()` | Logger: `APROVADO (2/3): vocabulário legado traduzido...` + `APROVADO (2b/3): id_cracha...cartao_rfid` + `APROVADO (2c/3): nível fixo OPERACIONAL` | | |
| 4.5 | **Log AVISO** para rebaixamento | Mesmo `teste_8_importacaoBlindada()` | Logger: `APROVADO (3/3): log de auditoria contém entrada AVISO para rebaixamento de F901.` | | |
| 4.6 | Duplicidade por matrícula é ignorada (não sobrescreve) | Rodar `teste_8_importacaoBlindada()` **duas vezes seguidas** | Segunda execução: `importados:0`, `ignorados:2` (F901 e F902), log não duplica AVISO | | |
| 4.7 | Duplicidade por e-mail (só se ambos preenchidos) | Inserir registro com `email_corporativo` já existente na aba | Ignorado com motivo `e-mail já cadastrado` | | |
| 4.8 | Terceirizado → `perfil_rbac=TERCEIRIZADO`, `nivel_hierarquico=OPERACIONAL` | Incluir no lote: `{id_funcionario:'TERC01',nome_completo:'Terci',vinculo:'TERCEIRIZADO',setor:'Limpeza'}` | Gravado com `tipo_vinculo=TERCEIRIZADO`, `perfil_rbac=TERCEIRIZADO`, `nivel_hierarquico=OPERACIONAL` | | |
| 4.9 | `setor` vazio NÃO vira 'GERAL' (sem chute silencioso) | Incluir registro sem `setor` | Célula `setor` (col 6) fica `''` vazia | | |
| 4.10 | `status` gravado na coluna 16 (editável), `status_efetivo` (col 21) continua fórmula | Ver aba `Funcionarios` após importação | Coluna 16 = `ATIVO`/`INATIVO`; coluna 21 = fórmula (não valor fixo) | | |
| 4.11 | `cartao_rfid` (col 12) recebe `id_cracha` do worker | Ver registro F902 ou TERC01 | Coluna 12 = valor informado | | |
| 4.12 | `email_corporativo` (col 25) preenchido | Ver qualquer registro importado com e-mail | Coluna 25 = e-mail lowercased | | |
| 4.13 | `atualizado_por` (col 20) = matrícula do admin solicitante | Ver `atualizado_por` da linha importada | `ADM001` (ou matrícula usada no teste) | | |
| 4.14 | Helper `_norm` remove acentos e uppercases | `_norm('  João São Paulo  ')` | `'JOAO SAO PAULO'` | | |

---

## 5. FRONTEND — PAINEL CORPORATIVO (02_painel_corporativo_htmlservice_v1.html)

| # | Item | Comando / Teste | Resultado Esperado | ✅/❌ | Observação |
|---|------|-----------------|--------------------|------|------------|
| 5.1 | `aoReceberContexto` lê `contexto.autenticado` (raiz) | No console do navegador: `google.script.run.withSuccessHandler(c=>console.log(c.autenticado)).obterContextoUsuario()` | `true` ou `false` (nunca `undefined`) | | |
| 5.2 | Não autenticado → `tela-negado` visível, `negado-email` = `contexto.erro` | Acessar app com conta fora do domínio / sessão inválida | Tela vermelha "ACESSO NEGADO" + erro do backend no rodapé | | |
| 5.3 | Autenticado sem permissão → `tela-negado` com `perfil_rbac` e `matricula` | Login com usuário `perfil_rbac=FUNCIONARIO` | Tela vermelha: "Seu perfil (FUNCIONARIO) não tem acesso..." + matrícula no rodapé | | |
| 5.4 | `montarCabecalho` usa `ctx.nome_completo`, `ctx.perfil_rbac`, `ctx.nivel_hierarquico`, `ctx.matricula` | Login com ADMIN/MASTER_ADMIN | Header mostra iniciais, nome, "ADMIN · MASTER_ADMIN", matrícula no escopo | | |
| 5.5 | `carregarDashboardGestor` chama `api_DashboardGestor()` | Botão ATUALIZAR no painel gestor | Renderiza cards com `id_funcionario`, `nome`, `funcao`, `nivel` (fadiga) | | |
| 5.6 | Botão "REGISTRAR AÇÃO PREVENTIVA" envia `matriculaSolicitante` do `CONTEXTO` | Clicar botão em um card de fadiga | `google.script.run.api_RegistrarAcaoPreventiva(id, {matriculaSolicitante:CONTEXTO.matricula, alerta, recomendacao})` — sucesso → botão fica verde "AÇÃO REGISTRADA ✓" | | |
| 5.7 | Falha no backend → botão volta "TENTAR NOVAMENTE" | Simular erro no backend (ex.: matrícula alvo inexistente) | Botão habilitado, texto "TENTAR NOVAMENTE", erro no console | | |
| 5.8 | `carregarPainelDiretoria` chama `api_PainelDiretoria()` | Login com DIRETORIA/MASTER_ADMIN | Grid de setores com `% fadiga crítica`, **sem nomes** | | |
| 5.9 | `banner-avisos` exibe `contexto.avisos` se houver | Forçar `nivel_rebaixado_por_inconsistencia=true` no usuário de teste | Banner amarelo aparece com texto do aviso | | |
| 5.10 | **Zero referências a `contexto.usuario.*`** | `grep -n "contexto\\.usuario" 02_painel_corporativo_htmlservice_v1.html` | **0 ocorrências** | | |
| 5.11 | **Zero referências a `contexto.email`** (não está no whitelist) | `grep -n "contexto\\.email" 02_painel_corporativo_htmlservice_v1.html` | **0 ocorrências** (usar `contexto.matricula` no lugar) | | |

---

## 6. FRONTEND — INDEX OTIMIZADO (03_Index_otimizado_v2_ATUAL.html)

| # | Item | Comando / Teste | Resultado Esperado | ✅/❌ | Observação |
|---|------|-----------------|--------------------|------|------------|
| 6.1 | Mesmo contrato de `obterContextoUsuario` que painel corporativo | Mesmo teste 5.1 | Mesmo comportamento | | |
| 6.2 | `aoReceberContexto` / `montarCabecalho` usam `contexto.*` na raiz | Mesmo testes 5.2–5.4 | Mesmos resultados | | |
| 6.3 | Chamadas `google.script.run` batem com APIs do Code.gs | `grep "google\\.script\\.run" 03_Index_otimizado_v2_ATUAL.html` | Só `obterContextoUsuario`, `api_DashboardGestor`, `api_PainelDiretoria`, `api_RegistrarAcaoPreventiva` | | |
| 6.4 | **Zero referências a `contexto.usuario.*`** | `grep -n "contexto\\.usuario" 03_Index_otimizado_v2_ATUAL.html` | **0 ocorrências** | | |
| 6.5 | **Zero referências a `contexto.email`** | `grep -n "contexto\\.email" 03_Index_otimizado_v2_ATUAL.html` | **0 ocorrências** | | |
| 6.6 | CSS `.usuario`, `.usuario-avatar`, `.usuario-nome`, `.usuario-papel` **não alterados** (são visuais) | Inspecionar DOM no navegador | Classes presentes; JS escreve nos `#usuario-iniciais`, `#usuario-nome`, `#usuario-papel` — sem conflito | | |

---

## 7. INTEGRAÇÃO E2E (FLUXO COMPLETO)

| # | Item | Comando / Teste | Resultado Esperado | ✅/❌ | Observação |
|---|------|-----------------|--------------------|------|------------|
| 7.1 | Admin importa CSV via `Hooks_ETL.html` (se disponível) → dados caem em `Funcionarios` com schema v2.0 | (Se `Hooks_ETL.html` estiver no disco) importar 5 linhas mistas (nativo + terceirizado, com/sem e-mail) | Todos com `perfil_rbac`/`nivel_hierarquico` corretos; `cartao_rfid` preenchido; log `ETL_IMPORTAR_FUNCIONARIO` + `ETL_LOTE_RESUMO` | | |
| 7.2 | Usuário importado (FUNCIONARIO/OPERACIONAL) abre painel corporativo → **negado** com motivo correto | Abrir app com matrícula recém-importada | "Seu perfil (FUNCIONARIO) não tem acesso..." | | |
| 7.3 | Gestor importado (GESTOR/GESTOR) abre painel → **dashboard do setor** carrega | Login com gestor de setor existente | `secao-dashboard-gestor` visível, cards de fadiga do setor | | |
| 7.4 | Diretoria importada (ADMIN/DIRETORIA) abre painel → **visão executiva** (agregado, sem nomes) | Login com diretoria | `secao-painel-diretoria` visível, grid de setores sem nomes | | |
| 7.5 | Ação preventiva registrada por gestor → log em `Acoes_Preventivas` + `Log_Auditoria` | Clicar "REGISTRAR AÇÃO PREVENTIVA" em card de fadiga | Nova linha em `Acoes_Preventivas` + log `REGISTRAR_ACAO_PREVENTIVA` com `matricula_solicitante` do gestor | | |
| 7.6 | `verificarIntegridadeLog()` passa após fluxo completo | `verificarIntegridadeLog()` | `{integro:true,total_registros:N,problemas:[]}` | | |

---

## 8. REGRESSÃO — NENHUM DIALETO LEGADO SOBREVIVE

| # | Item | Comando / Teste | Resultado Esperado | ✅/❌ | Observação |
|---|------|-----------------|--------------------|------|------------|
| 8.1 | `Code.gs` sem `exigirPermissao_`, `lerAba_`, `acharColuna_`, `normalizar_`, `_gravarLogsSemTrava_` | `grep -n "exigirPermissao_\\|lerAba_\\|acharColuna_\\|normalizar_\\|_gravarLogsSemTrava_" Code.gs` | **0 ocorrências** | | |
| 8.2 | `ETL_Ingestao.gs` sem constantes legadas | `grep -n "CONFIG\\|COLUNAS\\|STATUS_ATIVO\\|exigirPermissao_\\|lerAba_\\|acharColuna_\\|normalizar_\\|_gravarLogsSemTrava_" 3-ETL/ETL_Ingestao.gs` | **0 ocorrências** (só no comentário do cabeçalho) | | |
| 8.3 | `etl_worker.js` inalterado (mantém vocabulário próprio) | `grep -n "CAMPOS_DESTINO\\|normalizarPerfil\\|perfil_acesso\\|id_funcionario" 3-ETL/etl_worker.js` | **Presentes** (ok — worker não muda) | | |

---

## 9. DEPLOY & PUBLICAÇÃO (opcional — só se for publicar hoje)

| # | Item | Comando / Teste | Resultado Esperado | ✅/❌ | Observação |
|---|------|-----------------|--------------------|------|------------|
| 9.1 | `doGet` serve `Index.html` (painel corporativo) ou `03_Index...` | Implantar > Testar implantação > URL | Página carrega "VALIDANDO SESSÃO..." → tela correta | | |
| 9.2 | "Executar como: **Eu**" | Config da implantação | Sua conta (não "usuário que acessa") | | |
| 9.3 | "Quem pode acessar: **Qualquer pessoa do domínio**" | Config da implantação | Restrito ao Workspace da empresa | | |
| 9.4 | Nenhum erro no console do navegador (F12) | Abrir URL publicada | Console limpo (exceto logs intencionais) | | |

---

## Assinatura

| Papel | Nome | Data | ✅ Final |
|-------|------|------|----------|
| Arquiteto / Validador | | 2026-08-19 | |
| Responsável Técnico | | | |

---

### Notas rápidas para o validador

- **Rodar `teste_8_importacaoBlindada()`** no editor Apps Script valida 4.3–4.5 de uma vez (é idempotente: limpa F901/F902 antes).
- **RBAC**: os testes 2.2–2.8 precisam de usuários de teste na aba `Funcionarios`. Crie linhas temporárias e apague depois.
- **Frontend**: abra as URLs de teste (`Implantar > Testar implantação`) em janela anônima para simular "não autenticado".
- **Log**: `verificarIntegridadeLog()` é seu canário — se quebrar, a corrente de hash está corrompida (linha apagada ou editada manualmente).