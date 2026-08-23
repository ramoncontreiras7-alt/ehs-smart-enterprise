# EHS Smart Enterprise - Guia de Contexto

## Visão Geral

Projeto de plataforma MVP de gestão de Segurança, Saúde e Meio Ambiente (EHS)
para ambiente industrial. Arquitetura MVP em **Google Sheets + Google Apps
Script**, com migração estruturada planejada para PostgreSQL em produção.

Fonte normativa: **Dossiê Técnico e Base de Conhecimento Mestre** — documento
que estabelece as regras de negócio invioláveis (NR-01, NR-06, NR-10, NR-12,
NR-33, NR-35, RBAC, auditoria imutável, gamificação assimétrica). Todo código
e decisão de schema deriva desse documento; não são sugestões, são restrições.

## Regras de Comportamento para o Agente

- Sempre priorize a integração entre o ETL, o Backend e o Frontend — nenhuma
  camada deve reinventar trava (RBAC, lock, auditoria) que já existe em outra.
- Mantenha o padrão de código definido neste documento
  (`/SALA DE CONTROLE GERAL/ARQUITETURA.md`).
- Antes de implementar qualquer feature nova, verifique se ela não fere os
  requisitos de segurança do trabalho definidos na documentação (NRs, RBAC,
  assimetria da gamificação, isolamento de dado sensível no totem).
- Nunca proponha remover ou colapsar os 5 perfis operacionais
  (`FUNCIONARIO`, `TERCEIRIZADO`, `GESTOR`, `SST`, `ADMIN`) — são exigência
  normativa do Dossiê, não decisão de UX.
- Toda alteração de schema (coluna nova, aba nova) deve ser sinalizada
  explicitamente antes do código que depende dela ser entregue.

## Estrutura do Projeto

- `/ETL`: Processamento de dados e ingestão (em definição — ver pendências).
- `/FRONTEND`: Dashboard e Painel Admin.
- `/MARKETING`: Materiais de suporte e vendas.
- `/SALA DE CONTROLE GERAL`: Regras de negócio e documentação técnica.

## Stack Técnica

| Camada | Tecnologia |
|---|---|
| Banco de dados (MVP) | Google Sheets, locale BR (`;` como separador, funções PT-BR) |
| Banco de dados (produção, planejado) | PostgreSQL |
| Backend / motor de regras | Google Apps Script (`.gs`), namespace único compartilhado |
| Front-end | HTML + Tailwind CSS + Vanilla JS (arquivos standalone) |
| Auditoria | SHA-256 encadeado (`Utilities.computeDigest`), append-only |
| Autenticação | Modelo híbrido — ver seção dedicada abaixo |

---

## Arquitetura de Dados — 13 abas

### Núcleo (3 tabelas primárias)
- **`Funcionarios`** — matrícula (PK), tipo_vinculo, `perfil_rbac`,
  `status` (editável por RH) vs. `status_efetivo` (fórmula, o que o sistema
  realmente obedece), `nivel_hierarquico`, `unidades_visiveis`,
  `email_corporativo` (só preenchido para quem tem Workspace).
- **`Equipamentos_EPI_EPC`** — CA, `status_ca` (fórmula), `estoque_atual`
  (fórmula, derivado de `Movimentacoes_Trocas`), `status_estoque` (fórmula).
- **`Movimentacoes_Trocas`** — append-only. `status_confirmacao_totem`
  (PENDENTE/CONFIRMADO/RECUSADO/EXPIRADO), `impacto_gamificacao` (fórmula),
  `perc_vida_util_aproveitada` (fórmula, métrica-mãe da gamificação).

### Apoio (5 tabelas)
`Setores`, `Funcoes`, `Empresas_Terceiras`, `Log_Auditoria` (append-only,
corrente de hash), `Gamificacao_Mentoria` (assimetria positiva — ver seção).

### RCA e POPs dinâmicos (5 tabelas, adicionadas na v2.0)
`Incidentes`, `RCA_Investigacoes` (acesso restrito SST/ADMIN),
`POPs` (ponteiro para versão vigente), `POPs_Historico` (append-only, uma
linha por versão), `Matriz_Reciclagem`.

### Regra estrutural que atravessa tudo
**Toda coluna que pode ser calculada é fórmula, nunca digitação.**
`estoque_atual`, `status_ca`, `status_efetivo`, `saldo_bonus_mentor` — todas
derivadas. Elimina divergência manual e impede que alguém "ajuste" saldo ou
estoque por cima da regra de negócio.

### Pendência de ETL em aberto
`Treinamentos` e `Jornada_Consolidada` são as duas abas candidatas a
importação em lote via `Hooks_ETL.html`. Ainda não confirmado qual delas (ou
ambas) o ETL vai alimentar — ver seção "Pendências" no fim deste documento.

---

## RBAC Bidimensional (v2.0)

Duas dimensões independentes, sempre combinadas em **AND**, nunca OR:

### Dimensão 1 — `perfil_rbac` (O QUE pode fazer)
`FUNCIONARIO` · `TERCEIRIZADO` · `GESTOR` · `SST` · `ADMIN`
— fixado pelo Dossiê seção 6.4, nunca deve ser reduzido ou substituído.

### Dimensão 2 — `nivel_hierarquico` (SOBRE QUEM pode agir)
| Nível | Escopo | Vê dado nominal sensível (fadiga/saúde)? |
|---|---|---|
| `OPERACIONAL` | Só os próprios dados | Não |
| `GESTOR` | Setores onde é titular/substituto | **Sim** |
| `DIRETORIA` | Todas as unidades (ou lista em `unidades_visiveis`) | **Não — decisão homologada** |
| `MASTER_ADMIN` | Todas as unidades | Sim |

**Combinações válidas** (`CFG.COMBINACOES_VALIDAS`): impedem, por exemplo,
um `FUNCIONARIO` ser promovido a `DIRETORIA` por erro de digitação — o
sistema rebaixa automaticamente e grava log `CRITICO`.

**Decisão de privacidade homologada:** a Diretoria recebe apenas painel
**agregado por índice** (`api_PainelDiretoria`), nunca lista nominal de
fadiga. Fundamento: fadiga é dado de saúde ocupacional (LGPD, categoria
especial) e o Dossiê 3.3.1/3.3.2 restringe o alerta ao gestor do setor.

---

## Backend — `Code_v2.gs` (núcleo de infraestrutura)

- **Auditoria imutável**: `registrarLog` (pega lock) vs. `_gravarLogSemTrava`
  (usada de dentro de operações que já seguram o lock — evita deadlock).
  Corrente de hash: cada linha carrega o hash da anterior
  (`verificarIntegridadeLog` detecta rompimento/edição/exclusão).
- **Porteiro único de acesso**: `_exigirAcesso(matricula, {perfis,
  nivelMinimo, contexto})` — toda função sensível passa por aqui antes de
  ler dado. Tentativa negada já gera log de auditoria.
- **`_resolverEscopo(usuario)`**: traduz nível hierárquico em lista concreta
  de setores visíveis.
- **Motor de conformidade**: `validarColaborador(matricula)` — cascata de
  status_efetivo → setor → contrato da contratada → NRs obrigatórias da
  função. É a função que todo o resto do sistema consulta antes de liberar
  qualquer coisa.
- **API do Totem**: `api_ValidarTotem` devolve payload deliberadamente pobre
  — NUNCA inclui fadiga, score, nível ou jornada (testado automaticamente em
  `TESTE_ImplantacaoCompleta`, que falha se algum desses campos vazar).
- **Entrega de EPI append-only**: `api_RegistrarEntregaEPI` (nasce
  PENDENTE) → `api_ConfirmarRecebimento` (só o próprio dono confirma,
  nem MASTER_ADMIN confirma por outro) → `api_EstornarMovimentacao`
  (correção nunca apaga, sempre gera linha nova de ESTORNO).
- **Governança**: `api_AlterarNivelHierarquico` (trava anti-lockout: não
  deixa zerar o último MASTER_ADMIN ativo), `api_AuditarMatrizPermissoes`.
- **Contexto para o front — modelo híbrido de identificação** (ver seção
  dedicada abaixo): `obterContextoUsuario(matricula)` e
  `obterContextoUsuarioSessao()`, convergindo em `_montarContexto()` para
  manter a lista branca de campos em um único lugar.
- **Marco de versão**: `registrarMigracaoVersao()` — substitui commit/Git
  (inexistente neste ambiente) gravando o evento de migração na auditoria
  imutável.

## Backend — `Motor_Regras_v2.gs`

- **Fadiga preditiva**: `calcularFadiga` — soma ponderada de 5 indicadores
  (horas extras, turnos consecutivos, interjornada, atividades críticas,
  ocorrências recentes). Cortes: BAIXO/MODERADO/ALTO/CRÍTICO.
  `rotina_VarrerFadiga` dispara alerta **exclusivamente ao gestor do setor**
  (`_resolverGestorDoSetor`, com fallback para substituto) — nunca ao
  colaborador, nunca ao totem.
- **Dashboard do Gestor** (`api_DashboardGestor`) vs. **Painel da Diretoria**
  (`api_PainelDiretoria`, agregado, sem nomes) — bifurcação decidida pela
  flag `ve_dado_nominal_sensivel` do nível hierárquico.
- **Gamificação assimétrica** (`calcularBonusMentor`): **três proteções
  redundantes de piso zero**. Não existe campo de débito para o mentor —
  infrações do mentorado ficam em contador informativo
  (`infracoes_mentorado`), nunca referenciado pelas fórmulas de bônus.
  Testado explicitamente em `TESTE_ImplantacaoCompleta` com cenário de
  mentorado regredindo.
- **Rotinas automáticas**: expiração de confirmação em 24h, auditoria diária
  de integridade do log, auditoria diária da matriz de permissões.

## Backend — `RCA_POP.gs` (ciclo Auto-Healing, Dossiê seção 4)

Fluxo de 10 passos do Dossiê, implementado com trava dura de perfil
(`CFG.PERFIS_INVESTIGACAO = ['SST', 'ADMIN']`) em toda etapa de investigação
— Gestor **consulta**, nunca abre ou encerra RCA:

`api_RegistrarIncidente` → `api_AbrirRCA` (SST/ADMIN só) →
`api_AtualizarRCA` (coleta/diagnóstico) → `api_GerarPropostaPOP`
(automático, mas só para 6 categorias de causa raiz que fazem sentido virar
procedimento — falta de EPI não reescreve POP) → `api_AprovarVersaoPOP`
(proposta nasce `EM_REVISAO`, nunca vigora sozinha) → `api_GerarReciclagem`
→ `api_EncerrarRCA`.

`POPs_Historico` é append-only — cada versão é uma linha nova, nunca
sobrescrita.

**Pendência de decisão em aberto**: `_verificarReciclagensPendentes` existe
mas está **desconectada** de `validarColaborador` de propósito — ligar isso
bloquearia toda a função afetada, não só quem causou o incidente. Decisão
adiada até o Front-End entregar a tela de RCA e o fluxo ser testado ponta a
ponta (ver Pendências).

---

## Modelo Híbrido de Autenticação (homologado)

Duas funções coexistindo — nunca uma substituindo a outra:

| Função | Entrada | Uso |
|---|---|---|
| `obterContextoUsuario(matricula)` | Matrícula explícita (RFID/PIN/facial) | **Totem, Relógio de Ponto** — dispositivo compartilhado, sem login Google individual |
| `obterContextoUsuarioSessao()` | Nenhuma — lê `Session.getActiveUser().getEmail()` | **Dashboard Gestor, Painel Diretoria** — acesso individual via desktop corporativo |

**Por que não dá para unificar em `getActiveUser()`:**
1. Retorna string vazia por desenho de privacidade do Google quando a
   implantação é "Qualquer pessoa" ou fora do domínio Workspace.
2. Totem/Ponto são dispositivos compartilhados — não existe "usuário do
   Google logado" nessa tela.
3. Terceirizados e boa parte do chão de fábrica não têm conta Workspace.

Ambas convergem em `_montarContexto(usuario, origemIdentificacao)` — a lista
branca de campos expostos ao front (nunca `senha_hash`, `salt`,
`id_biometrico`) existe em um único lugar, não duplicada.

---

## Convenções de Código

- Fórmulas Sheets sempre em PT-BR, `;` como separador, vírgula decimal.
- Toda gravação concorrente usa `LockService.getScriptLock()`.
- Toda função sensível chama `_exigirAcesso` antes de ler ou escrever dado —
  RBAC no front é cosmético, a trava real é sempre no servidor.
- Nenhuma tabela transacional (`Movimentacoes_Trocas`, `Log_Auditoria`,
  `POPs_Historico`) é editada ou apagada — correção é sempre linha nova
  (ESTORNO, nova versão).
- Toda função nova que decide algo sensível deve ser coberta em
  `TESTE_ImplantacaoCompleta` antes de ir para produção.

---

## Pendências Abertas (para retomar a qualquer momento)

1. **`Hooks_ETL.html`** — ponte de importação em lote front→servidor. Em
   definição: qual aba recebe (`Treinamentos`, `Jornada_Consolidada`, ou
   ambas), modelo de log agregado (1 entrada por lote, não por linha), e
   política de falha (tudo-ou-nada vs. parcial com relatório de erro).
2. **Trava de reciclagem obrigatória** — `_verificarReciclagensPendentes`
   pronta, não conectada a `validarColaborador`. Aguardando o Front-End
   construir a tela de Incidentes/RCA para teste ponta a ponta antes da
   decisão.
3. **Front-End de RCA/Incidentes** — ainda não construído. Deve abrir já
   autenticado via `obterContextoUsuarioSessao()` (não pedir matrícula de
   novo), já que é tela de SST/Admin em desktop corporativo.
4. **Coluna `email_corporativo`** — precisa de validação de dados no Sheets
   (formato e-mail) e definição clara de que fica vazia para quem não tem
   Workspace — não é campo obrigatório geral.
