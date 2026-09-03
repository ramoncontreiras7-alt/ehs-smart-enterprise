# EHS SYSTEM - Regras Arquiteturais

## Visão Geral
O EHS System implementa monitoramento contínuo de fadiga ocupacional com integração automática de normas regulamentadoras (NRs) e jurisprudência trabalhista atualizada.

## Regras de Negócio

### 1. Motor Preditivo de Fadiga
- **Pontuação**: sistema de pontuação ponderada por fatores de risco
- **Fatores**: horas extras, turnos consecutivos, interjornada, atividades críticas, ocorrências recentes, exposição crítica e NR-06
- **Limiares**: CRÍTICO (≥8), ALTO (≥5), MODERADO (≥2)

### 2. Integração NR-06 (máxima prioridade)
- **Base legal**: Súmula 289 do TST + NR-06.6.1
- **Regra**: fornecimento de EPI não elimina insalubridade
- **Validação obrigatória**: CA válido para atividades de risco crítico
- **Penalidade**: +5 pontos na pontuação de fadiga para CA vencido ou inválido

### 3. Fluxo de Alertas
- **CRÍTICO**: alerta ao gestor + ação recomendada com bloqueio de acesso ao totem
- **ALTO**: redistribuição de carga + verificação NR-06 em 24h
- **MODERADO**: monitoramento com prioridade NR-06 no próximo ciclo

### 4. Auditoria e RBAC
- RBAC bidimensional: `perfil_rbac` AND `nivel_hierarquico`
- Registro automático de todas as ações sensíveis

## Requisitos Técnicos
- Atualização automática via gatilhos do Google Apps Script
- Dashboards hierárquicos agregados por escopo resolvido
- Auditoria imutável
- Total conformidade offline-first e custo zero

## Jurisprudência Aplicada
- **TST Sum 289**: mero fornecimento de EPI não afasta insalubridade
  - Fonte: https://www.tst.jus.br/
  - Data de atualização: 03/09/2026

---
*Documento gerado automaticamente por TOT - EHS SYSTEM 1*
*Versão: 2.1 - Integrada NR-06 e jurisprudência atualizada*
