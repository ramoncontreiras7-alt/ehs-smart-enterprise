# EHS Smart Enterprise

Plataforma de gestão de Segurança, Saúde e Meio Ambiente (EHS) para a indústria brasileira, em conformidade com as NRs (01, 06, 10, 12, 33, 35).
Roda em **Google Apps Script + Google Sheets**, com identidade Google OAuth nominal.

## Estrutura

```
backend/        ← TUDO que vai para o Apps Script (servidor + telas HTML)
  config.js       Constantes: CFG, FADIGA (com NR-06), GAMIFICACAO — fonte única
  utils.js        Leitura/escrita da planilha, cache
  audit.js        Log imutável com hash SHA-256 encadeado
  rbac.js         Controle de acesso bidimensional (perfil_rbac × nivel_hierarquico)
  auth.js         Autenticação (sessão Google resolvida no servidor)
  epi.js          API do Totem e entregas de EPI
  dashboard.js    APIs dos painéis
  governance.js   Governança MASTER_ADMIN
  Aprovacoes.js   Fluxo de aprovações
  web.js          doGet / doPost e APIs públicas
  Motor_Regras.js Fadiga preditiva + gamificação assimétrica
  RCA_POP.js      Investigação de incidentes e POPs (Auto-Healing)
  ETL_Ingestao.js Importação em lote
  *.html          Telas servidas pelo HtmlService (Index, Totem, RCA...)
  .claspignore    Arquivos que NÃO sobem (testes, worker do navegador)
etl/etl_worker.js ← Web Worker do navegador (não vai para o servidor)
tests/          Testes automáticos (npm test)
tools/          verificar_carga.js — simula a carga do Apps Script
docs/           Arquitetura, schema, diagrama ER, checklists
comercial/      Materiais comerciais
archive/        Versões antigas (não publicar)
```

## Regra de ouro do Apps Script

Todos os arquivos `.js` compartilham **o mesmo espaço global**. Um `const` com o mesmo nome em dois arquivos derruba o sistema inteiro.
Antes de publicar, sempre rode:

```
npm run validar
```

## Publicar

**Pelo seu PC** (dentro da pasta `backend/`, com `clasp login` já feito):

```
clasp push --force
clasp deploy --description "descrição da versão"
```

**Primeira publicação da v2.1:** no editor do Apps Script, execute uma vez a função `DEFINIR_SEGREDO_HMAC()`.
Ela cria a chave secreta dos totens no cofre do projeto (ScriptProperties). Sem ela, o totem recusa operar.

**Pelo GitHub** (opcional): cadastre o segredo `CLASPRC_JSON` (conteúdo de `~/.clasprc.json` do seu PC) em
Settings › Secrets › Actions, e rode *Actions › EHS — Validação e Publicação › Run workflow* marcando "Publicar".

## Versão

v2.1.1 — ver [CHANGELOG.md](CHANGELOG.md)
