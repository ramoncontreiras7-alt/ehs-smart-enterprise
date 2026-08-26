# Pós-Auditoria: Alterações Aplicadas

**Commit:** `38bfa92`  
**Data:** 26/08/2026  
**Tipo:** Correções de segurança, lógica e performance

---

## Arquivos Modificados

| Arquivo | Linhas alteradas | Tipo |
|---------|------------------|------|
| `backend/web.js` | +45/-12 | Segurança + lógica |
| `backend/config.js` | +4/-2 | Configuração |
| `backend/utils.js` | +28/-8 | Cache + robustez |
| `backend/Motor_Regras.js` | +2/-24 | Manutenibilidade |
| `backend/RCA_POP.js` | +2/-4 | Race condition |
| `backend/Monitoramento.js` | +6/-6 | Performance |
| `backend/Backup_Automatizado.js` | +2/-1 | Precisão |
| `frontend/Totem.html` | +10/-4 | UX/Timeout |

---

## Correções por Severidade

### CRÍTICO (4 itens)

| # | Arquivo | Issue | Correção |
|---|---------|-------|----------|
| 1 | `web.js` | Stack trace exposto em produção | Removido `erro.message` do JSON de resposta; flag `DEBUG = false` |
| 2 | `web.js` | Token de totem em texto plano no storage | Adicionado `_criptografarToken()` com HMAC-SHA256 antes de salvar no PropertiesService |
| 3 | `RCA_POP.js` | Race condition em IDs sequenciais | Substituído `getLastRow()` por `Utilities.getUuid().slice(0, 4)` para `idIncidente` e `idRca` |
| 4 | `web.js` | ALLOWALL em X-Frame-Options | Alterado para `SAMEORIGIN` em todas as rotas (`doGet`) |

### ALTO (3 itens)

| # | Arquivo | Issue | Correção |
|---|---------|-------|----------|
| 5 | `web.js` | Falta de rate limiting no webhook totem | Adicionado `_totemDentroDoLimite()` com CacheService (30 req/min) |
| 6 | `config.js` + `utils.js` | Duplicação de `_lerTudo`/`_aba` | Removidas duplicações de `config.js`; centralizado em `utils.js` |
| 7 | `Motor_Regras.js` | Redefinição de `FADIGA`/`GAMIFICACAO` | Removidas duplicações; mantida fonte única em `config.js` |

### MÉDIO (3 itens)

| # | Arquivo | Issue | Correção |
|---|---------|-------|----------|
| 8 | `utils.js` | Cache em memória não persiste entre execuções | Adicionado fallback para `CacheService` com TTL de 5min |
| 9 | `Monitoramento.js` | Leitura completa de `Log_Auditoria` | Alterado para ler apenas última linha (`getLastRow()` + `getRange`) |
| 10 | `Totem.html` | Falta de timeout no `google.script.run` | Adicionado `setTimeout` de 15s com `clearTimeout` nos handlers |

### BAIXO (1 item)

| # | Arquivo | Issue | Correção |
|---|---------|-------|----------|
| 11 | `Backup_Automatizado.js` | Magic number no cálculo de MB | Extraídas constantes `FATOR_MB` e `PRECISAO_MB` |

---

## Breaking Changes

### Tokens de Totem
Os tokens antigos armazenados em texto plano **não funcionarão mais** após o deploy. É necessário regenerar todos os tokens:

```javascript
// Executar uma vez no Apps Script
api_ListarTokensTotem().forEach(t => {
  // Anotar os IDs e regenerar
});
api_GerarTokenTotem('TOTEM_01', 90);
api_GerarTokenTotem('TOTEM_02', 90);
```

### Versão do Projeto
`config.js` atualizado de `2.0` → `2.1`. Qualquer script que valide `CFG.VERSAO === '2.0'` precisará ser ajustado.

---

## Validação Rápida

```javascript
// 1. Verificar versão
Logger.log(CFG.VERSAO); // Esperado: 2.1

// 2. Verificar token criptografado
const token = api_GerarTokenTotem('TEST', 1);
Logger.log(token.token); // Esperado: hash hex de 64 caracteres

// 3. Verificar rate limiting
api_ValidarTotem('FIC-0001', 'TOTEM-01'); // Deve funcionar
// Repetir 31 vezes rapidamente → 31ª deve retornar 429

// 4. Verificar X-Frame
// Acessar URL do totem em iframe externo → deve ser bloqueado

// 5. Verificar timeout no totem
// Desconectar internet → após 15s deve mostrar "Timeout"
```

---

## Próximos Passos Recomendados

1. **Regenerar tokens de totem** (obrigatório para produção)
2. **Atualizar `GUIA_SINCRONIZACAO_GITHUB.md`** com commit `38bfa92`
3. **Executar checklist de homologação** atualizado
4. **Testar em staging** antes de produção

---

## Arquivos de Referência

- Commit: https://github.com/ramoncontreiras7-alt/ehs-smart-enterprise/commit/38bfa92
- Checklist: `CHECKLIST_HOMOLOGACAO_v2.1.md`
- Guia de sync: `GUIA_SINCRONIZACAO_GITHUB.md`
