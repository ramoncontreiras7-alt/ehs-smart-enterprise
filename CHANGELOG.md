# EHS Smart Enterprise — Changelog

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
