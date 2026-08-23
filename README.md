# EHS Smart Enterprise

Sistema de gestão de Segurança, Saúde e Meio Ambiente (EHS) para ambiente industrial.

## Estrutura do Projeto

```
EHS SYSTEM/
├── backend/           # Código do Google Apps Script (servidor)
│   ├── config.js      # Constantes e configurações (CFG, FADIGA, GAMIFICACAO)
│   ├── utils.js       # Funções utilitárias (leitura/escrita planilha)
│   ├── audit.js       # Auditoria imutável com SHA-256
│   ├── rbac.js        # Controle de acesso bidimensional
│   ├── auth.js        # Autenticação híbrida (sessão + matrícula)
│   ├── epi.js         # API do Totem e entregas de EPI
│   ├── dashboard.js   # APIs do Dashboard Executivo
│   ├── governance.js  # Governança Master_ADMIN
│   ├── web.js         # Publicação Web (doGet) e APIs
│   ├── compat.js      # Compatibilidade com v2.9
│   ├── ETL_Ingestao.js      # Importação em lote
│   ├── Motor_Regras.js      # Motor de fadiga e gamificação
│   ├── RCA_POP.js           # Investigação e POPs
│   └── Setup_*.js           # Scripts de configuração
├── frontend/          # Interfaces HTML (Totem, Dashboard, Admin)
├── docs/              # Documentação técnica
├── etl/               # Workers de ETL
├── marketing/         # Materiais de marketing
└── archive/           # Arquivos legados (não mais utilizados)
```

## Stack Técnica

| Camada | Tecnologia |
|---|---|
| Banco de dados (MVP) | Google Sheets |
| Backend / motor de regras | Google Apps Script |
| Front-end | HTML + CSS + Vanilla JS |
| Auditoria | SHA-256 encadeado (append-only) |

## RBAC Bidimensional

O sistema usa controle de acesso em duas dimensões (AND, nunca OR):

### Dimensão 1 — `perfil_rbac` (O QUE pode fazer)
- `FUNCIONARIO` · `TERCEIRIZADO` · `GESTOR` · `SST` · `ADMIN`

### Dimensão 2 — `nivel_hierarquico` (SOBRE QUEM pode agir)
- `OPERACIONAL` · `GESTOR` · `DIRETORIA` · `MASTER_ADMIN`

## Instalação

1. Crie uma nova planilha Google Sheets
2. Extensões → Apps Script
3. Copie os arquivos da pasta `backend/` para o editor do Apps Script
4. Execute `util_SetupCabecalhosPrevencao()` para criar os cabeçalhos
5. Implante como Web App

## Versão

v2.0 — RBAC bidimensional, autenticação híbrida, auditoria imutável
