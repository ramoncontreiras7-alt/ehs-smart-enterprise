# EHS Smart Enterprise — Schema de Dados Completo

Documento de referência das 13 abas do MVP em Google Sheets. Linha 1 =
cabeçalho; dados a partir da linha 2. Toda coluna marcada **[fórmula]** nunca
é digitada manualmente — ver `Manual_Montagem_Sheets.md` para as fórmulas
exatas.

---

## 1. `Funcionarios`

| Col | Coluna | Tipo | Obrig. | Regra |
|---|---|---|---|---|
| A | matricula | Texto | Sim | **PK.** `NAT-00001` / `TER-00001` |
| B | nome_completo | Texto | Sim | |
| C | cpf | Texto | Sim | Único, protegido (LGPD) |
| D | tipo_vinculo | Lista | Sim | NATIVO \| TERCEIRIZADO |
| E | empresa | Texto | Sim | FK Empresas_Terceiras se terceirizado |
| F | setor | Lista | Sim | FK Setores |
| G | funcao | Lista | Sim | FK Funcoes |
| H | perfil_rbac | Lista | Sim | FUNCIONARIO\|TERCEIRIZADO\|GESTOR\|SST\|ADMIN |
| I | senha_hash | Texto | Sim | SHA-256 + salt, protegido |
| J | salt | Texto | Sim | Protegido |
| K | id_gestor | Texto | Sim | FK matricula (auto-relação) |
| L | cartao_rfid | Texto | Não | Único quando preenchido |
| M | id_biometrico | Texto | Não | Protegido |
| N | data_admissao | Data | Sim | ≤ hoje |
| O | data_fim_contrato | Data | Condic. | Obrig. se terceirizado |
| P | status | Lista | Sim | ATIVO\|AFASTADO\|BLOQUEADO\|DESLIGADO (editável por RH) |
| Q | motivo_bloqueio | Texto | Condic. | |
| R | criado_em | Timestamp | Sim | Auto |
| S | atualizado_em | Timestamp | Sim | Auto |
| T | atualizado_por | Texto | Sim | FK matricula |
| U | status_efetivo | **[fórmula]** | Auto | O que o sistema realmente obedece |
| V | motivo_bloqueio_automatico | **[fórmula]** | Auto | |
| W | nivel_hierarquico | Lista | Sim (v2.0) | OPERACIONAL\|GESTOR\|DIRETORIA\|MASTER_ADMIN |
| X | unidades_visiveis | Texto | Não (v2.0) | `UNI-01;UNI-02`. Vazio = todas |
| Y | email_corporativo | Texto | Não (híbrido) | Só quem tem Workspace |

---

## 2. `Equipamentos_EPI_EPC`

| Col | Coluna | Tipo | Obrig. | Regra |
|---|---|---|---|---|
| A | codigo_epi | Texto | Sim | **PK.** `EPI-0001` \| `EPC-0001` |
| B | nome | Texto | Sim | |
| C | categoria | Lista | Sim | EPI \| EPC |
| D | grupo_protecao | Lista | Sim | CABEÇA\|OLHOS_FACE\|AUDITIVA\|RESPIRATÓRIA\|TRONCO\|MMSS\|MMII\|QUEDAS\|COLETIVO |
| E | fabricante | Texto | Sim | |
| F | numero_ca | Texto | Condic. | Obrig. se EPI |
| G | validade_ca | Data | Condic. | |
| H | status_ca | **[fórmula]** | Auto | VÁLIDO\|A_VENCER\|VENCIDO |
| I | vida_util_dias | Número | Sim | Inteiro > 0 |
| J | exige_higienizacao | Booleano | Sim | SIM\|NÃO |
| K | periodicidade_higien_dias | Número | Condic. | |
| L | unidade_medida | Lista | Sim | UN\|PAR\|CX |
| M | estoque_atual | **[fórmula]** | Auto | Derivado de Movimentacoes_Trocas |
| N | ponto_pedido | Número | Sim | ≥ 0 |
| O | estoque_seguranca | Número | Sim | ≤ ponto_pedido |
| P | status_estoque | **[fórmula]** | Auto | OK\|REPOR\|CRÍTICO\|ZERADO |
| Q | custo_unitario | Moeda | Sim | |
| R | localizacao_almox | Texto | Não | |
| S | nrs_associadas | Texto | Não | `NR-06;NR-35` |
| T | status_item | Lista | Sim | ATIVO\|DESCONTINUADO |

---

## 3. `Movimentacoes_Trocas` (append-only)

| Col | Coluna | Tipo | Obrig. | Regra |
|---|---|---|---|---|
| A | id_movimentacao | Texto | Sim | **PK.** `MOV-AAAAMMDD-0001` |
| B | data_hora | Timestamp | Sim | |
| C | matricula | Texto | Condic. | Vazio só em ENTRADA_ESTOQUE |
| D | codigo_epi | Texto | Sim | FK |
| E | tipo_movimentacao | Lista | Sim | ENTRADA_ESTOQUE\|ENTREGA\|TROCA\|DEVOLUCAO\|HIGIENIZACAO\|DESCARTE\|AJUSTE_INVENTARIO\|ESTORNO |
| F | quantidade | Número | Sim | > 0 |
| G | motivo_troca | Lista | Condic. | DESGASTE_NATURAL\|AVARIA\|PERDA_EXTRAVIO\|VENCIMENTO_CA\|FIM_VIDA_UTIL\|N/A |
| H | ca_no_momento | Texto | Sim | Snapshot |
| I | lote | Texto | Não | |
| J | data_validade_calculada | **[fórmula]** | Auto | |
| K | dias_uso_efetivo | **[fórmula]** | Auto | |
| L | perc_vida_util_aproveitada | **[fórmula]** | Auto | Métrica-mãe da gamificação |
| M | status_confirmacao_totem | Lista | Sim | PENDENTE\|CONFIRMADO\|RECUSADO\|EXPIRADO |
| N | metodo_confirmacao | Lista | Condic. | CRACHA_RFID\|FACIAL\|PIN\|ASSINATURA_DIGITAL |
| O | timestamp_confirmacao | Timestamp | Condic. | |
| P | id_totem | Texto | Sim | |
| Q | responsavel_almox | Texto | Sim | FK matricula |
| R | observacao | Texto | Não | |
| S | id_movimentacao_estornada | Texto | Condic. | FK auto-relação |
| T | impacto_gamificacao | **[fórmula]** | Auto | POSITIVO\|NEUTRO\|NEGATIVO |
| U | hash_registro | Texto | Sim | SHA-256, só via Apps Script |

---

## 4. `Setores`

| Col | Coluna | Tipo | Obrig. | Regra |
|---|---|---|---|---|
| A | id_setor | Texto | Sim | **PK.** `SET-001` |
| B | nome_setor | Texto | Sim | Único |
| C | centro_custo | Texto | Sim | |
| D | id_unidade | Texto | Sim | |
| E | id_gestor_responsavel | Texto | Sim | FK matricula, perfil GESTOR |
| F | id_gestor_substituto | Texto | Não | FK matricula |
| G | nivel_criticidade | Lista | Sim | BAIXO\|MEDIO\|ALTO\|CRITICO |
| H | nrs_aplicaveis | Texto | Sim | `NR-10;NR-12` |
| I | exige_liberacao_previa | Booleano | Sim | |
| J | permite_terceirizado | Booleano | Sim | |
| K | descricao_riscos | Texto | Não | |
| L | status | Lista | Sim | ATIVO\|INATIVO |

---

## 5. `Funcoes`

| Col | Coluna | Tipo | Obrig. | Regra |
|---|---|---|---|---|
| A | id_funcao | Texto | Sim | **PK.** `FUN-001` |
| B | nome_funcao | Texto | Sim | Único por setor |
| C | id_setor_vinculado | Texto | Sim | FK |
| D | cbo | Texto | Não | |
| E | epis_obrigatorios | Texto | Sim | `EPI-0001;EPI-0007` (N:N em texto) |
| F | epis_condicionais | Texto | Não | |
| G | nrs_obrigatorias | Texto | Sim | |
| H | treinamentos_obrigatorios | Texto | Sim | |
| I | atividades_criticas_permitidas | Texto | Não | |
| J | exige_aso_especifico | Booleano | Sim | |
| K | grau_exposicao_risco | Lista | Sim | BAIXO\|MEDIO\|ALTO\|CRITICO |
| L | limite_horas_extras_mes | Número | Sim | Parâmetro do motor de fadiga |
| M | elegivel_gamificacao | Booleano | Sim | Terceirizado = NÃO sempre |
| N | status | Lista | Sim | ATIVO\|INATIVO |

---

## 6. `Empresas_Terceiras`

| Col | Coluna | Tipo | Obrig. | Regra |
|---|---|---|---|---|
| A | id_empresa | Texto | Sim | **PK.** `EMP-001` |
| B | cnpj | Texto | Sim | Único |
| C | razao_social | Texto | Sim | |
| D | nome_fantasia | Texto | Não | |
| E | numero_contrato | Texto | Sim | Único |
| F | objeto_contrato | Texto | Sim | |
| G | data_inicio_contrato | Data | Sim | |
| H | data_fim_contrato | Data | Sim | > início |
| I | contrato_vigente | **[fórmula]** | Auto | SIM\|NÃO |
| J | status_contrato | **[fórmula]** | Auto | VIGENTE\|A_VENCER\|VENCIDO\|SUSPENSO\|ENCERRADO |
| K | status_documentacao | Lista | Sim | REGULAR\|PENDENTE\|IRREGULAR |
| L | pgr_entregue | Booleano | Sim | |
| M | pcmso_entregue | Booleano | Sim | |
| N | validade_documentacao | Data | Sim | |
| O | responsavel_tecnico | Texto | Sim | |
| P | contato_email | Texto | Sim | |
| Q | contato_telefone | Texto | Não | |
| R | setores_autorizados | Texto | Sim | |
| S | fornece_proprio_epi | Booleano | Sim | |
| T | qtd_colaboradores_ativos | **[fórmula]** | Auto | |
| U | status | Lista | Sim | ATIVO\|BLOQUEADO\|ENCERRADO |

---

## 7. `Log_Auditoria` (append-only absoluto)

| Col | Coluna | Tipo | Obrig. | Regra |
|---|---|---|---|---|
| A | id_log | Texto | Sim | **PK.** `LOG-AAAAMMDD-000001` |
| B | timestamp | Timestamp | Sim | Servidor, nunca cliente |
| C | matricula_usuario | Texto | Sim | `SISTEMA` se automático |
| D | perfil_rbac_no_momento | Texto | Sim | Snapshot |
| E | acao_realizada | Lista | Sim | 18 tipos (LOGIN, ENTREGA_EPI, ESTORNO, etc.) |
| F | tabela_afetada | Lista | Sim | |
| G | id_registro_afetado | Texto | Sim | |
| H | valor_anterior | Texto | Condic. | JSON |
| I | valor_novo | Texto | Condic. | JSON |
| J | justificativa | Texto | Condic. | Obrig. em ESTORNO/LIBERACAO_EXCEPCIONAL |
| K | origem_acao | Lista | Sim | TOTEM\|WEB_DESKTOP\|TABLET\|RELOGIO_PONTO\|MOTOR_REGRAS\|ROTINA_AUTOMATICA |
| L | id_dispositivo | Texto | Sim | |
| M | endereco_ip | Texto | Não | |
| N | resultado | Lista | Sim | SUCESSO\|NEGADO_RBAC\|NEGADO_REGRA\|ERRO |
| O | criticidade | Lista | Sim | INFO\|AVISO\|CRITICO |
| P | hash_registro | Texto | Sim | SHA-256 |
| Q | hash_anterior | Texto | Sim | Corrente |
| R | sequencia | Número | Sim | Incremental sem lacunas |
| S | nivel_hierarquico_no_momento | Texto | Sim (v2.0) | Snapshot |

---

## 8. `Gamificacao_Mentoria`

| Col | Coluna | Tipo | Obrig. | Regra |
|---|---|---|---|---|
| A | id_vinculo | Texto | Sim | **PK.** `MNT-0001` |
| B | matricula_mentor | Texto | Sim | FK, NATIVO/ATIVO/elegível |
| C | matricula_mentorado | Texto | Sim | FK, ≠ mentor |
| D | id_setor | Texto | Sim | FK |
| E | data_inicio_vinculo | Data | Sim | |
| F | data_fim_vinculo | Data | Não | |
| G | status_vinculo | Lista | Sim | ATIVO\|CONCLUIDO\|ENCERRADO\|SUSPENSO |
| H | pontos_acumulados_mentorado | **[fórmula]** | Auto | Só soma positivos |
| I | pontos_base_inicial | Número | Sim | Fotografia do dia 1 |
| J | evolucao_liquida_mentorado | **[fórmula]** | Auto | **Piso travado em zero** |
| K | percentual_repasse_mentor | Número | Sim | 5% a 25% |
| L | saldo_bonus_mentor | **[fórmula]** | Auto | **Nunca decresce** |
| M | saldo_bonus_acumulado_historico | **[fórmula]** | Auto | |
| N | infracoes_mentorado | **[fórmula]** | Auto | Informativo, isolado |
| O | impacto_infracoes_no_mentor | Constante | Sim | `= 0` fixo |
| P | perc_vida_util_media_mentorado | **[fórmula]** | Auto | |
| Q | qtd_trocas_positivas | **[fórmula]** | Auto | |
| R | nivel_evolucao | **[fórmula]** | Auto | INICIANTE...APTO_A_MENTORAR |
| S | validado_por_sst | Booleano | Sim | |
| T | data_validacao_sst | Data | Condic. | |
| U | observacoes_sst | Texto | Não | |

---

## 9. `Treinamentos` *(exigida pelo Code.gs, criar antes de instalar)*

| Col | Coluna | Tipo | Obrig. |
|---|---|---|---|
| A | id_treinamento | Texto | Sim (PK) |
| B | matricula | Texto | Sim (FK) |
| C | norma | Texto | Sim (`NR-06`, `NR-10`...) |
| D | carga_horaria | Número | Sim |
| E | data_realizacao | Data | Sim |
| F | data_vencimento | Data | Sim — trava a atividade |
| G | instrutor | Texto | Não |
| H | numero_certificado | Texto | Não |
| I | status | Lista | Sim — VALIDO\|CANCELADO |

---

## 10. `Jornada_Consolidada` *(exigida pelo Motor_Regras.gs)*

| Col | Coluna | Tipo | Obrig. |
|---|---|---|---|
| A | matricula | Texto | Sim (FK) |
| B | data_referencia | Data | Sim — sempre lê a mais recente |
| C | horas_extras_mes | Número | Sim |
| D | turnos_consecutivos | Número | Sim |
| E | intervalo_min_horas | Número | Sim |
| F | atividades_criticas_7d | Número | Sim |
| G | ocorrencias_recentes | Número | Sim |

---

## 11. `Incidentes`

| Col | Coluna | Tipo | Obrig. |
|---|---|---|---|
| A | id_incidente | Texto | Sim (PK) `INC-0001` |
| B | data_hora | Timestamp | Sim |
| C | matricula_acidentado | Texto | Condic. (vazio se quase-acidente sem vítima) |
| D | id_setor | Texto | Sim (FK) |
| E | tipo_evento | Lista | Sim — ACIDENTE\|QUASE_ACIDENTE\|DESVIO |
| F | gravidade | Lista | Sim — LEVE\|MODERADA\|GRAVE\|FATAL |
| G | descricao_resumida | Texto | Sim |
| H | testemunhas | Texto | Não — matrículas `;` |
| I | epi_envolvido | Texto | Não (FK) |
| J | equipamento_envolvido | Texto | Não |
| K | status | Lista | Sim — ABERTO\|EM_INVESTIGACAO\|CONCLUIDO |
| L | id_rca | Texto | Auto — preenchido ao abrir investigação |
| M | registrado_por | Texto | Sim (FK) |
| N | criado_em | Timestamp | Sim |

---

## 12. `RCA_Investigacoes` *(acesso restrito SST/ADMIN)*

| Col | Coluna | Tipo | Obrig. |
|---|---|---|---|
| A | id_rca | Texto | Sim (PK) `RCA-0001` |
| B | id_incidente | Texto | Sim (FK) |
| C | aberto_por | Texto | Sim (FK, perfil SST/ADMIN) |
| D | data_abertura | Timestamp | Sim |
| E | depoimento_acidentado | Texto | Não |
| F | depoimentos_testemunhas | Texto | Não |
| G | relato_gestor | Texto | Não |
| H | fatores_ambientais | Texto | Não |
| I | fatores_contextuais | Texto | Não |
| J | fatores_emocionais | Texto | Não |
| K | condicao_equipamento | Texto | Não |
| L | condicao_epi | Texto | Não |
| M | categoria_causa | Lista | Condic. — 12 categorias fechadas (ver RCA_POP.gs) |
| N | pop_aplicavel | Texto | Não (FK POPs) |
| O | etapa_descumprida | Texto | Não |
| P | necessidade_reciclagem | Booleano | Não |
| Q | status | Lista | Sim — ABERTA\|EM_ANALISE\|CONCLUIDA |
| R | encerrado_por | Texto | Condic. |
| S | data_encerramento | Timestamp | Condic. |
| T | conclusao | Texto | Condic. — mín. 20 caracteres |

---

## 13. `POPs` / `POPs_Historico` / `Matriz_Reciclagem`

### `POPs` (ponteiro da versão vigente)
| Col | Coluna | Tipo |
|---|---|---|
| A | codigo_pop | Texto (PK) `POP-001` |
| B | titulo | Texto |
| C | versao_atual | Número — só incrementado por script |
| D | status_vigencia | Lista — VIGENTE\|EM_REVISAO\|OBSOLETO |
| E | publico_impactado | Texto |
| F | treinamentos_associados | Texto |
| G | id_rca_origem | Texto (FK) |
| H | atualizado_em | Timestamp |

### `POPs_Historico` (append-only — uma linha por versão)
| Col | Coluna | Tipo |
|---|---|---|
| A | id_versao | Texto (PK) `POP-001-v3` |
| B | codigo_pop | Texto (FK) |
| C | numero_versao | Número |
| D | motivo_alteracao | Texto — mín. 10 caracteres |
| E | id_rca_relacionado | Texto (FK) |
| F | responsavel_tecnico | Texto |
| G | data_aprovacao | Timestamp |
| H | hash_versao | Texto |

### `Matriz_Reciclagem`
| Col | Coluna | Tipo |
|---|---|---|
| A | id_reciclagem | Texto (PK) |
| B | codigo_pop | Texto (FK) |
| C | id_funcao | Texto (FK) |
| D | data_geracao | Timestamp |
| E | prazo_limite | Data |
| F | status | Lista — PENDENTE\|CONCLUIDA\|BLOQUEIA_ATIVIDADE |
| G | id_rca_origem | Texto (FK) |
