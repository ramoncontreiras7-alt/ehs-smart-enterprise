# Checklist de Homologação Pós-Deploy — EHS Smart Enterprise v2.1

**Data:** 26/08/2026  
**Responsável:** _________________________  
**Commit:** `38bfa92`  
**Branch:** `master`  
**Ambiente:** Staging / Produção (marcar um)

---

## 1. GitHub — Repositório e Código

| Item | Status | Observação |
|------|--------|------------|
| Commit `c7f5fff` aparece no histórico do repositório | ☐ OK ☐ Falha | |
| Branch `master` está atualizada com o commit mais recente | ☐ OK ☐ Falha | |
| Todos os arquivos da v2.1 estão presentes no repositório | ☐ OK ☐ Falha | Verificar lista abaixo |
| Nenhum arquivo sensível foi commitado (`.clasp.json`, credenciais, senhas) | ☐ OK ☐ Falha | |

**Arquivos críticos para verificar:**
- [ ] `.github/workflows/auto-sync.yml`
- [ ] `.github/workflows/clasp-deploy.yml`
- [ ] `.github/actions/backup-drive/action.yml`
- [ ] `backend/Sincronizacao.js`
- [ ] `backend/Backup_Automatizado.js`
- [ ] `backend/Limpeza_Dados.js`
- [ ] `backend/Monitoramento.js`
- [ ] `backend/web.js`
- [ ] `backend/config.js`
- [ ] `backend/Motor_Regras.js`
- [ ] `backend/RCA_POP.js`
- [ ] `frontend/RCA_Incidentes.html`
- [ ] `frontend/Totem.html`
- [ ] `frontend/sw_totem.html`
- [ ] `docs/Schema_Dados.md`
- [ ] `package.json`

---

## 2. GitHub Actions — Workflows

| Item | Status | Observação |
|------|--------|------------|
| Workflow `Auto-Sync EHS Smart Enterprise` executou sem erro | ☐ OK ☐ Falha | |
| Workflow `Deploy EHS Smart Enterprise` executou sem erro | ☐ OK ☐ Falha | |
| Todos os jobs do workflow concluíram com sucesso | ☐ OK ☐ Falha | |
| Nenhum erro de lint/teste no workflow de validação | ☐ OK ☐ Falha | |

**URLs para verificar:**
- Actions: https://github.com/ramoncontreiras7-alt/ehs-smart-enterprise/actions
- Commit: https://github.com/ramoncontreiras7-alt/ehs-smart-enterprise/commit/c7f5fff

---

## 3. Google Apps Script — Deploy

| Item | Status | Observação |
|------|--------|------------|
| Projeto Apps Script está acessível | ☐ OK ☐ Falha | |
| Arquivos do backend foram atualizados para v2.1 | ☐ OK ☐ Falha | |
| Arquivos do frontend foram atualizados para v2.1 | ☐ OK ☐ Falha | |
| Deploy como Web App está ativo | ☐ OK ☐ Falha | |
| URL do Web App responde corretamente | ☐ OK ☐ Falha | Testar: `https://script.google.com/.../exec` |
| Totem responde corretamente com token | ☐ OK ☐ Falha | Testar URL com `?tela=totem&id=...&token=...` |

**Verificações específicas:**
- [ ] `web.js` contém `doPost` (webhook totem)
- [ ] `config.js` contém `FEATURE_FLAGS`
- [ ] `Motor_Regras.js` contém `_enviarAlertaFadiga`
- [ ] `RCA_POP.js` contém `api_ListarSetores` e `api_ListarIncidentes`
- [ ] `Sincronizacao.js` está presente
- [ ] `Backup_Automatizado.js` está presente
- [ ] `Limpeza_Dados.js` está presente
- [ ] `Monitoramento.js` está presente

---

## 4. Google Drive — Backup

| Item | Status | Observação |
|------|--------|------------|
| Pasta `EHS_BACKUPS_GITHUB` existe no Drive | ☐ OK ☐ Falha | |
| Arquivo de backup `EHS-Backup-c7f5fff*.zip` está presente | ☐ OK ☐ Falha | |
| Backup contém código fonte completo | ☐ OK ☐ Falha | Abrir ZIP e verificar |
| Permissões da pasta estão corretas | ☐ OK ☐ Falha | Service account com acesso de editor |

**URL para verificar:**
- Google Drive: https://drive.google.com/drive/folders/SEU_FOLDER_ID

---

## 5. Planilha Google — Dados e Schema

| Item | Status | Observação |
|------|--------|------------|
| Planilha `Dados.xlsx` está acessível | ☐ OK ☐ Falha | |
| Aba `Log_Auditoria` existe e está íntegra | ☐ OK ☐ Falha | |
| Abas críticas existem: `Funcionarios`, `Equipamentos_EPI_EPC`, `Movimentacoes_Trocas` | ☐ OK ☐ Falha | |
| Dados mockados foram sanitizados (`TOTEM-MOCK` marcados como `ANOMALO`) | ☐ OK ☐ Falha | |
| Nenhuma PK duplicada em `Movimentacoes_Trocas` | ☐ OK ☐ Falha | |
| Aba `Acoes_Preventivas` documentada e presente | ☐ OK ☐ Falha | |

**Scripts para executar no Apps Script:**
```javascript
// Verificação geral
relatorioSanidadePlanilha();

// Sanitizar mock data
sanitizarMovimentacoesMock();

// Detectar PKs duplicadas
detectarPksDuplicadas();
```

---

## 6. Funcionalidades Implementadas — Testes

### 6.1. Webhook Totem (`doPost`)

| Teste | Status | Observação |
|-------|--------|------------|
| `POST /exec` com `acao=validar` retorna JSON | ☐ OK ☐ Falha | |
| `POST /exec` com token inválido retorna 403 | ☐ OK ☐ Falha | |
| `POST /exec` com payload inválido retorna 401 | ☐ OK ☐ Falha | |

**Exemplo de teste:**
```bash
curl -X POST "https://script.google.com/.../exec" \
  -H "Content-Type: application/json" \
  -d '{"acao":"validar","matricula":"FIC-0001","idTotem":"TOTEM-01","token":"..."}'
```

### 6.2. Token de Totem com Expiração

| Teste | Status | Observação |
|-------|--------|------------|
| `api_GerarTokenTotem('TOTEM-01', 90)` gera token com data de expiração | ☐ OK ☐ Falha | |
| Token expirado é rejeitado pelo `_totemAutorizado` | ☐ OK ☐ Falha | |
| `api_ListarTokensTotem()` retorna lista com expiração | ☐ OK ☐ Falha | |

### 6.3. Alertas de Fadiga

| Teste | Status | Observação |
|-------|--------|------------|
| Feature flag `alertas_fadiga_email` existe em `config.js` | ☐ OK ☐ Falha | |
| `rotina_VarrerFadiga` registra log `ALERTA_FADIGA_GERADO` | ☐ OK ☐ Falha | |
| Quando flag ativada, e-mail é enviado ao gestor | ☐ OK ☐ Falha | |

### 6.4. Alertas de Treinamento Vencido

| Teste | Status | Observação |
|-------|--------|------------|
| Feature flag `alertas_treinamento_email` existe em `config.js` | ☐ OK ☐ Falha | |
| `rotina_AlertarTreinamentosVencidos` registra log | ☐ OK ☐ Falha | |
| Gatilho está instalado para executar diariamente às 07h | ☐ OK ☐ Falha | |

### 6.5. Backup Automatizado

| Teste | Status | Observação |
|-------|--------|------------|
| `executarBackupCompleto()` exporta XLSX para `EHS_BACKUPS` | ☐ OK ☐ Falha | |
| Backup contém timestamp no nome do arquivo | ☐ OK ☐ Falha | |
| `limparBackupsAntigos(30)` remove arquivos com mais de 30 dias | ☐ OK ☐ Falha | |
| Gatilhos de backup estão instalados | ☐ OK ☐ Falha | |

### 6.6. Frontend RCA/Incidentes

| Teste | Status | Observação |
|-------|--------|------------|
| `RCA_Incidentes.html` existe e pode ser servido | ☐ OK ☐ Falha | |
| `api_ListarSetores()` retorna setores ativos | ☐ OK ☐ Falha | |
| `api_ListarIncidentes()` retorna incidentes ordenados por data | ☐ OK ☐ Falha | |
| `api_RegistrarIncidente()` cria incidente com validação | ☐ OK ☐ Falha | |
| Acesso restrito a SST/ADMIN funciona | ☐ OK ☐ Falha | |

### 6.7. PWA Totem Offline

| Teste | Status | Observação |
|-------|--------|------------|
| `sw_totem.html` existe | ☐ OK ☐ Falha | |
| Service Worker registra sem erro no console | ☐ OK ☐ Falha | |
| Página totem funciona offline após primeiro carregamento | ☐ OK ☐ Falha | |
| Manifest PWA está embutido no `Totem.html` | ☐ OK ☐ Falha | |

---

## 7. Segurança e Auditoria

| Item | Status | Observação |
|------|--------|------------|
| `Log_Auditoria` está append-only (não há linhas deletadas) | ☐ OK ☐ Falha | |
| Corrente de hash SHA-256 está íntegra | ☐ OK ☐ Falha | Executar `verificarIntegridadeLog()` |
| Nenhuma credencial commitada no repositório | ☐ OK ☐ Falha | |
| Tokens de totem têm data de expiração | ☐ OK ☐ Falha | |
| RBAC bidimensional está funcionando | ☐ OK ☐ Falha | |
| Totem não expõe dados sensíveis (fadiga, score, jornada) | ☐ OK ☐ Falha | |

---

## 8. Teste de Integração Ponta a Ponta

| Fluxo | Status | Observação |
|-------|--------|------------|
| **Totem:** Login → Validação → Lista EPIs → Confirmação → Log | ☐ OK ☐ Falha | |
| **Dashboard Gestor:** Login → Escopo setorial → Dados corretos | ☐ OK ☐ Falha | |
| **Dashboard Diretoria:** Login → Painel agregado sem nomes | ☐ OK ☐ Falha | |
| **Fadiga:** Rotina executa → Alerta gravado no log | ☐ OK ☐ Falha | |
| **RCA:** Registro incidente → Abertura RCA → Fechamento | ☐ OK ☐ Falha | |
| **ETL:** Upload XLSX → Importação em lote → Dados no Sheets | ☐ OK ☐ Falha | |

---

## 9. Performance e Estabilidade

| Item | Status | Observação |
|------|--------|------------|
| Tempo de carregamento do Dashboard < 3s | ☐ OK ☐ Falha | Medir no browser |
| Tempo de resposta do Totem < 2s | ☐ OK ☐ Falha | Medir no totem |
| Nenhum erro no Stackdriver/Logs do Apps Script | ☐ OK ☐ Falha | |
| Gatilhos automáticos estão instalados e ativos | ☐ OK ☐ Falha | |

**Gatilhos para verificar:**
- [ ] `rotina_VarrerFadiga` — diário às 06h
- [ ] `rotina_ExpirarConfirmacoes` — a cada 6h
- [ ] `rotina_AuditarIntegridade` — diário às 23h
- [ ] `rotina_AuditarPermissoes` — diário às 05h
- [ ] `rotina_AlertarTreinamentosVencidos` — diário às 07h
- [ ] `monitor_HealthCheck` — a cada 1h
- [ ] `executarBackupCompleto` — a cada 6h
- [ ] `limparBackupsAntigos` — diário às 02h

---

## 10. Documentação

| Item | Status | Observação |
|------|--------|------------|
| `README.md` do repositório está atualizado | ☐ OK ☐ Falha | |
| `docs/ARQUITETURA.md` reflete a v2.1 | ☐ OK ☐ Falha | |
| `docs/Schema_Dados.md` inclui Apêndice A | ☐ OK ☐ Falha | |
| `GUIA_SINCRONIZACAO_GITHUB.md` está completo | ☐ OK ☐ Falha | |
| `CHECKLIST_HOMOLOGACAO_v2.md` foi atualizado | ☐ OK ☐ Falha | |

---

## 11. Aprovação Final

| Assinatura | Data | Status |
|------------|------|--------|
| Responsável técnico | ___/___/_____ | ☐ Aprovado ☐ Reprovado |
| SST / EHS | ___/___/_____ | ☐ Aprovado ☐ Reprovado |
| DevOps | ___/___/_____ | ☐ Aprovado ☐ Reprovado |

**Observações finais:**
_____________________________________________________________________________
_____________________________________________________________________________
_____________________________________________________________________________

---

## Instruções de Uso

1. **Preencher checklist:** Marque cada item como OK/Falha após teste
2. **Documentar evidências:** Anexar screenshots/logs dos testes
3. **Corrigir falhas:** Qualquer item marcado como Falha deve ser corrigido antes da homologação
4. **Aprovação:** Todos os responsáveis devem assinar antes do go-live
5. **Pós-homologação:** Manter esta checklist arquivada para auditoria

---

## Contatos de Suporte

| Função | Contato |
|--------|---------|
| DevOps/CI-CD | _________________________ |
| Backend Apps Script | _________________________ |
| Frontend/UX | _________________________ |
| SST/EHS | _________________________ |
| Arquiteto | _________________________ |
