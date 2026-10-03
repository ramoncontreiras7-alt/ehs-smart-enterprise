# EHS Smart Enterprise — Changelog

## v2.1.1 (2026-09-28) — Sincronização e correção de carga

### Corrigido (bloqueavam a inicialização do sistema)
- `FADIGA` e `GAMIFICACAO` declaradas em `config.js` e `Motor_Regras.js` → mantida só a versão completa (com NR-06) em `config.js`.
- `_norm` declarada em `ETL_Ingestao.js` e `utils.js` → mantida em `utils.js`.
- `config.test.js` (Node) estava dentro de `backend/` e seria publicado no Apps Script → movido para `tests/`.
- Telas HTML ficavam em `frontend/` e nunca eram publicadas → movidas para `backend/`.

### Segurança
- Segredo do totem removido do código (repositório público): agora vive em ScriptProperties (`DEFINIR_SEGREDO_HMAC()`).
- Erros do health-check não expõem mais a mensagem interna (código `EHS-HC-500`).

### Adicionado / sincronizado com a versão local
- `Aprovacoes.js`; invalidação de cache após movimentações de EPI; tela Index com skeleton e reconexão automática.
- `tools/verificar_carga.js`: reprova envio que quebraria a carga do Apps Script.
- Testes contra o `config.js` real (privacidade da DIRETORIA, NR-06, piso zero da gamificação).
- `.gitattributes` para eliminar diferenças falsas de quebra de linha Windows/Linux.

### Alterado
- CI unificado: valida em todo envio; publicação só manual. Os dois workflows antigos falhavam em 100% das execuções.

### Corrigido em produção (03/10, após a 1ª publicação)
- `web.js` usava `HtmlService.XFrameOptionsMode.SAMEORIGIN`, que **não existe** na API do Apps Script: o Web App abria com `Exception: O argumento não pode ser nulo: mode`. Trocado por `DEFAULT`, que é o modo que faz o Google enviar `X-Frame-Options: SAMEORIGIN` (mesma proteção, API válida).
- `tools/verificar_carga.js` agora valida membros de enum do Apps Script (reprova nomes inventados antes da publicação).
- `tests/TESTE_AUDITORIA.js` exigia a string `SAMEORIGIN` — o teste cobrava justamente o erro. Reescrito para checar `XFrameOptionsMode.DEFAULT` e barrar `SAMEORIGIN`/`ALLOWALL`.

### Pendente de homologação
- 4 funções duplicadas (`_obterUsuario`, `_obterUsuarioPorEmail`, `_totemDentroDoLimite`, `_invalidarCacheGeral`) — escolher a versão oficial.

## v2.0.0 (2026-08-22)

### Adicionado
- RBAC bidimensional (perfil_rbac + nivel_hierarquico)
- Auditoria imutável com corrente de hash SHA-256
- Autenticação híbrida (sessão Google + matrícula explícita)
- Motor de fadiga preditiva
- Gamificação assimétrica com proteção de piso zero
- APIs do Totem com rate limiting
- Controle de acesso em duas dimensões (AND, nunca OR)

### Alterado
- Reestruturação do projeto em módulos
- Migração de _LEGADO para archive/
- Consolidação de arquivos duplicados

### Removido
- MASTER_KEY_2026 (substituído por autenticação Google Workspace)
- Senhas em texto plano (migração para SHA-256)

## v1.0.0 (legado)
- Versão inicial monolítica
- Funcionalidades movidas para archive/
