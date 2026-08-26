# Guia de Sincronização — GitHub + Google Drive + Apps Script

## Contexto
O repositório `ramoncontreiras7-alt/ehs-smart-enterprise` está na **v2.0**.
O ambiente local (`C:\EHS\ARQUIVOS EHS SYSTEM`) está na **v2.1** com melhorias não sincronizadas.

## Fluxo de Sincronização Automatizado

```
GitHub (código) → GitHub Actions → Apps Script (deploy) → Google Drive (backup)
```

### Etapas do Fluxo

1. **Desenvolvimento**
   - Crie branch: `git checkout -b feat/nova-funcionalidade`
   - Commit: `git add . && git commit -m "feat: descrição"`
   - Push: `git push origin feat/nova-funcionalidade`

2. **Pull Request**
   - Abra PR no GitHub
   - GitHub Actions executa validação (lint + estrutura)

3. **Aprovação**
   - Você revisa e aprova o PR
   - Merge para `main`

4. **Deploy Automático**
   - GitHub Actions dispara `auto-sync.yml`
   - `clasp push --force` atualiza Apps Script
   - Backup automático no Google Drive

5. **Auditoria**
   - Registro em `Log_Auditoria` (Sheets)
   - Backup pré-deploy no Drive

---

## Configuração Inicial

### 1. Criar GitHub Personal Access Token (PAT)

```powershell
# Navegue até: https://github.com/settings/tokens
# Clique: Generate new token (classic)
# Selecione escopos:
#   - repo (controle total de repositórios)
#   - workflow (atualizar GitHub Actions)
#   - admin:repo_hook (webhooks)
# Validade: 90 dias (recomendado)
# Copie o token gerado (será usado como secret)
```

### 2. Configurar Secrets no GitHub

No repositório `ramoncontreiras7-alt/ehs-smart-enterprise`:

```
Settings → Secrets and variables → Actions → New repository secret

Adicionar:
  - GITHUB_TOKEN: (automático, não precisa criar)
  - CLASP_JSON: conteúdo do arquivo backend/.clasp.json
  - GOOGLE_DRIVE_FOLDER_ID: ID da pasta no Drive para backups
  - GOOGLE_APPS_SCRIPT_ID: ID do projeto Apps Script
  - GOOGLE_CREDENTIALS: JSON da service account do Google
```

### 3. Configurar clasp localmente

```powershell
# Instalar clasp globalmente
npm install -g @google/clasp

# Login
clasp login

# Configurar projeto
cd C:\EHS\ARQUIVOS EHS SYSTEM\backend
clasp create --title "EHS Smart Enterprise" --type standalone
# Anote o script ID gerado

# Vincular ao repositório
clasp clone <SCRIPT_ID> --force
```

### 4. Configurar Google Cloud

```powershell
# 1. Acesse Google Cloud Console
# 2. Crie um projeto (ou use o existente)
# 3. Habilite a API: Google Drive API
# 4. Crie uma Service Account
# 5. Faça download do JSON de credenciais
# 6. Compartilhe a pasta de backup com o email da service account (como Editor)
```

---

## Arquivos Criados/Modificados

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `.github/workflows/auto-sync.yml` | **Novo** | Workflow de sincronização automática |
| `.github/actions/backup-drive/action.yml` | **Novo** | Action composta para backup no Drive |
| `backend/Sincronizacao.js` | **Novo** | Script de sincronização e backup |
| `GUIA_SINCRONIZACAO_GITHUB.md` | **Atualizado** | Guia com passos de configuração |

---

## Validação pós-configuração

```powershell
# Verificar estrutura
Get-ChildItem -Path "C:\EHS\ARQUIVOS EHS SYSTEM\.github" -Recurse -File

# Testar clasp
cd C:\EHS\ARQUIVOS EHS SYSTEM\backend
clasp status

# Testar workflow local (simulação)
npm test
```

---

## Segurança

### Medidas Implementadas

1. **Nunca commitar credenciais**
   - `.clasp.json`, `.clasprc.json`, `credentials.json` no `.gitignore`
   - Usar GitHub Secrets para informações sensíveis

2. **Auditoria completa**
   - Todo deploy registrado em `Log_Auditoria` com SHA-256
   - Backup pré-deploy sempre executado antes de alterações
   - Rastreabilidade de quem aprovou

3. **Princípio do menor privilégio**
   - Service Account do Google tem acesso apenas à pasta de backups
   - GitHub PAT com escopos mínimos (`repo`, `workflow`)
   - clasp autenticado via OAuth2, não por credenciais fixas

---

## Troubleshooting

| Problema | Solução |
|----------|---------|
| **clasp push falha** | Verificar `CLASP_JSON` no GitHub Secrets |
| **Backup Drive falha** | Verificar `GOOGLE_CREDENTIALS` e permissões da pasta |
| **GitHub Actions não dispara** | Verificar se o arquivo YAML está em `.github/workflows/` |
| **Deploy não atualiza** | Verificar `GOOGLE_APPS_SCRIPT_ID` e permissões do Apps Script |

---

## Próximos Passos

1. Criar GitHub PAT e configurar Secrets
2. Configurar Service Account no Google Cloud
3. Testar workflow com PR de teste
4. Treinar equipe no fluxo de aprovação
