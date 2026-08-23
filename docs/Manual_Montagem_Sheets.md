# EHS Smart Enterprise — Manual de Montagem do Sheets

Locale BR: `;` como separador de argumentos, vírgula decimal. Toda fórmula
vai na **linha 2** e é arrastada para baixo (ou convertida para
`ARRAYFORMULA` depois de validada — ver nota final).

---

## PARTE 1 — Fórmulas das colunas calculadas

### `Equipamentos_EPI_EPC`

**H2 — status_ca**
```
=SE($A2="";"";SE($F2="";"N/A";SE($G2="";"SEM_CA";SE($G2<HOJE();"VENCIDO";SE($G2<=HOJE()+30;"A_VENCER";"VÁLIDO")))))
```

**M2 — estoque_atual**
```
=SE($A2="";"";
 SOMASES(Movimentacoes_Trocas!$F$2:$F;Movimentacoes_Trocas!$D$2:$D;$A2;Movimentacoes_Trocas!$E$2:$E;"ENTRADA_ESTOQUE";Movimentacoes_Trocas!$M$2:$M;"<>RECUSADO")
+SOMASES(Movimentacoes_Trocas!$F$2:$F;Movimentacoes_Trocas!$D$2:$D;$A2;Movimentacoes_Trocas!$E$2:$E;"DEVOLUCAO";Movimentacoes_Trocas!$M$2:$M;"<>RECUSADO")
+SOMASES(Movimentacoes_Trocas!$F$2:$F;Movimentacoes_Trocas!$D$2:$D;$A2;Movimentacoes_Trocas!$E$2:$E;"AJUSTE_INVENTARIO";Movimentacoes_Trocas!$M$2:$M;"<>RECUSADO")
+SOMASES(Movimentacoes_Trocas!$F$2:$F;Movimentacoes_Trocas!$D$2:$D;$A2;Movimentacoes_Trocas!$E$2:$E;"ESTORNO";Movimentacoes_Trocas!$M$2:$M;"<>RECUSADO")
-SOMASES(Movimentacoes_Trocas!$F$2:$F;Movimentacoes_Trocas!$D$2:$D;$A2;Movimentacoes_Trocas!$E$2:$E;"ENTREGA";Movimentacoes_Trocas!$M$2:$M;"<>RECUSADO")
-SOMASES(Movimentacoes_Trocas!$F$2:$F;Movimentacoes_Trocas!$D$2:$D;$A2;Movimentacoes_Trocas!$E$2:$E;"TROCA";Movimentacoes_Trocas!$M$2:$M;"<>RECUSADO")
-SOMASES(Movimentacoes_Trocas!$F$2:$F;Movimentacoes_Trocas!$D$2:$D;$A2;Movimentacoes_Trocas!$E$2:$E;"DESCARTE";Movimentacoes_Trocas!$M$2:$M;"<>RECUSADO"))
```
> Para reduzir estoque em inventário, lance `DESCARTE` — nunca
> `AJUSTE_INVENTARIO` negativo. A regra "quantidade sempre positiva" depende
> disso.

**P2 — status_estoque**
```
=SE($A2="";"";SE($M2<=0;"ZERADO";SE($M2<=$O2;"CRÍTICO";SE($M2<=$N2;"REPOR";"OK"))))
```

---

### `Movimentacoes_Trocas`

**J2 — data_validade_calculada**
```
=SE(OU($A2="";$D2="");"";SEERRO(INT($B2)+PROCV($D2;Equipamentos_EPI_EPC!$A:$I;9;FALSO);""))
```

**K2 — dias_uso_efetivo**
```
=SE(OU($A2="";$E2<>"TROCA";$C2="");"";
 SE(MÁXIMOSES(Movimentacoes_Trocas!$B$2:$B;Movimentacoes_Trocas!$C$2:$C;$C2;Movimentacoes_Trocas!$D$2:$D;$D2;Movimentacoes_Trocas!$B$2:$B;"<"&$B2;Movimentacoes_Trocas!$M$2:$M;"CONFIRMADO")=0;"";
 INT($B2)-INT(MÁXIMOSES(Movimentacoes_Trocas!$B$2:$B;Movimentacoes_Trocas!$C$2:$C;$C2;Movimentacoes_Trocas!$D$2:$D;$D2;Movimentacoes_Trocas!$B$2:$B;"<"&$B2;Movimentacoes_Trocas!$M$2:$M;"CONFIRMADO"))))
```

**L2 — perc_vida_util_aproveitada**
```
=SE(OU($K2="";$K2=0);"";SEERRO($K2/PROCV($D2;Equipamentos_EPI_EPC!$A:$I;9;FALSO);""))
```
> Formatar como porcentagem.

**T2 — impacto_gamificacao**
```
=SE(OU($A2="";$C2="");"";
 SE(SEERRO(PROCV($C2;Funcionarios!$A:$D;4;FALSO);"")<>"NATIVO";"N/A";
 SE(OU($G2="PERDA_EXTRAVIO";$G2="AVARIA");"NEGATIVO";
 SE(E(OU($G2="DESGASTE_NATURAL";$G2="FIM_VIDA_UTIL");N($L2)>=0,8);"POSITIVO";
 "NEUTRO"))))
```

**U2 — hash_registro**
```
⚠ SEM FÓRMULA NATIVA. Deixe vazia e protegida — preenchida pelo Apps Script
(Utilities.computeDigest) no momento da gravação.
```

---

### `Empresas_Terceiras`

**I2 — contrato_vigente**
```
=SE(OU($G2="";$H2="");"";SE(E(HOJE()>=$G2;HOJE()<=$H2);"SIM";"NÃO"))
```

**J2 — status_contrato**
```
=SE($H2="";"";
 SE($U2="ENCERRADO";"ENCERRADO";
 SE($U2="BLOQUEADO";"SUSPENSO";
 SE(HOJE()>$H2;"VENCIDO";
 SE(HOJE()>=$H2-30;"A_VENCER";"VIGENTE")))))
```

**T2 — qtd_colaboradores_ativos**
```
=SE($A2="";"";CONT.SES(Funcionarios!$E$2:$E;$A2;Funcionarios!$P$2:$P;"ATIVO"))
```

---

### `Funcionarios` — colunas derivadas

**U2 — status_efetivo**
```
=SE($A2="";"";
 SE($P2<>"ATIVO";$P2;
 SE(E($D2="TERCEIRIZADO";SEERRO(PROCV($E2;Empresas_Terceiras!$A:$J;10;FALSO);"")<>"VIGENTE");"BLOQUEADO";
 SE(E($D2="TERCEIRIZADO";SEERRO(PROCV($E2;Empresas_Terceiras!$A:$K;11;FALSO);"")<>"REGULAR");"BLOQUEADO";
 SE(E($O2<>"";$O2<HOJE());"BLOQUEADO";
 "ATIVO")))))
```

**V2 — motivo_bloqueio_automatico**
```
=SE($U2<>"BLOQUEADO";"";
 SE(E($D2="TERCEIRIZADO";SEERRO(PROCV($E2;Empresas_Terceiras!$A:$J;10;FALSO);"")<>"VIGENTE");"Contrato da contratada: "&SEERRO(PROCV($E2;Empresas_Terceiras!$A:$J;10;FALSO);"não localizado");
 SE(E($D2="TERCEIRIZADO";SEERRO(PROCV($E2;Empresas_Terceiras!$A:$K;11;FALSO);"")<>"REGULAR");"Documentação da contratada irregular";
 SE(E($O2<>"";$O2<HOJE());"Contrato individual encerrado em "&TEXTO($O2;"dd/mm/aaaa");
 $Q2))))
```
> `status` (P) é o que o RH declara. `status_efetivo` (U) é o que o sistema
> obedece. O totem e o motor de regras seguem sempre a U.

---

### `Gamificacao_Mentoria`

**H2 — pontos_acumulados_mentorado**
```
=SE($A2="";"";
 SEERRO(50*CONT.SES(Movimentacoes_Trocas!$C$2:$C;$C2;
   Movimentacoes_Trocas!$T$2:$T;"POSITIVO";
   Movimentacoes_Trocas!$M$2:$M;"CONFIRMADO";
   Movimentacoes_Trocas!$B$2:$B;">="&$E2)+$I2;$I2))
```
> Cada troca positiva vale 50 pontos. Infrações não entram nesta fórmula —
> é aqui que a assimetria começa.

**J2 — evolucao_liquida_mentorado**
```
=SE($A2="";"";MÁXIMO(0;$H2-$I2))
```
> `MÁXIMO(0; ...)` é o piso travado.

**L2 — saldo_bonus_mentor**
```
=SE($A2="";"";ARREDONDAR(MÁXIMO(0;$J2)*$K2;2))
```

**M2 — saldo_bonus_acumulado_historico**
```
=SE($A2="";"";SOMASES($L$2:$L;$B$2:$B;$B2;$G$2:$G;"CONCLUIDO"))
```

**N2 — infracoes_mentorado**
```
=SE($A2="";"";CONT.SES(Movimentacoes_Trocas!$C$2:$C;$C2;Movimentacoes_Trocas!$T$2:$T;"NEGATIVO";Movimentacoes_Trocas!$B$2:$B;">="&$E2))
```

**O2 — impacto_infracoes_no_mentor**
```
=0
```
> Constante literal, por desenho — declarada para qualquer auditor ver.

**P2 — perc_vida_util_media_mentorado**
```
=SE($A2="";"";SEERRO(MÉDIASES(Movimentacoes_Trocas!$L$2:$L;Movimentacoes_Trocas!$C$2:$C;$C2;Movimentacoes_Trocas!$L$2:$L;">0");0))
```

**Q2 — qtd_trocas_positivas**
```
=SE($A2="";"";CONT.SES(Movimentacoes_Trocas!$C$2:$C;$C2;Movimentacoes_Trocas!$T$2:$T;"POSITIVO";Movimentacoes_Trocas!$M$2:$M;"CONFIRMADO"))
```

**R2 — nivel_evolucao**
```
=SE($A2="";"";
 SE(E($P2>=0,85;$N2=0;$Q2>=6);"APTO_A_MENTORAR";
 SE($P2>=0,7;"CONSOLIDADO";
 SE($P2>=0,5;"EM_DESENVOLVIMENTO";
 "INICIANTE"))))
```

---

### Aba `Painel_Integridade` (verificador de corrente — criar do zero)

**B1**
```
=SE(MÁXIMO(Log_Auditoria!$R$2:$R)=CONT.VALORES(Log_Auditoria!$A$2:$A);"✔ SEQUÊNCIA ÍNTEGRA";"⚠ LACUNA NA SEQUÊNCIA — LINHA APAGADA")
```

**B2**
```
=SE(CONT.VALORES(Log_Auditoria!$A$2:$A)=CONTAR.ÚNICO(Log_Auditoria!$A$2:$A);"✔ SEM ID DUPLICADO";"⚠ ID DE LOG DUPLICADO")
```

**B3**
```
=SOMARPRODUTO((Equipamentos_EPI_EPC!$M$2:$M<0)*(Equipamentos_EPI_EPC!$A$2:$A<>""))
```
> Diferente de zero = EPI com estoque negativo, sinal de lançamento errado.

---

## PARTE 2 — Validação de dados (menus suspensos)

Crie uma aba `Listas` primeiro. Cada coluna abaixo vira uma coluna lá
(cabeçalho na linha 1, valores a partir da linha 2):

| Col | Cabeçalho | Valores |
|---|---|---|
| A | tipo_vinculo | NATIVO · TERCEIRIZADO |
| B | perfil_rbac | FUNCIONARIO · TERCEIRIZADO · GESTOR · SST · ADMIN |
| C | status_funcionario | ATIVO · AFASTADO · BLOQUEADO · DESLIGADO |
| D | categoria_epi | EPI · EPC |
| E | grupo_protecao | CABEÇA · OLHOS_FACE · AUDITIVA · RESPIRATÓRIA · TRONCO · MMSS · MMII · QUEDAS · COLETIVO |
| F | unidade_medida | UN · PAR · CX |
| G | status_item | ATIVO · DESCONTINUADO |
| H | tipo_movimentacao | ENTRADA_ESTOQUE · ENTREGA · TROCA · DEVOLUCAO · HIGIENIZACAO · DESCARTE · AJUSTE_INVENTARIO · ESTORNO |
| I | motivo_troca | N/A · DESGASTE_NATURAL · AVARIA · PERDA_EXTRAVIO · VENCIMENTO_CA · FIM_VIDA_UTIL |
| J | status_confirmacao | PENDENTE · CONFIRMADO · RECUSADO · EXPIRADO |
| K | metodo_confirmacao | CRACHA_RFID · FACIAL · PIN · ASSINATURA_DIGITAL |
| L | nivel_criticidade | BAIXO · MEDIO · ALTO · CRITICO |
| M | sim_nao | SIM · NÃO |
| N | status_contrato_manual | ATIVO · BLOQUEADO · ENCERRADO |
| O | status_documentacao | REGULAR · PENDENTE · IRREGULAR |
| P | status_vinculo_mentoria | ATIVO · CONCLUIDO · ENCERRADO · SUSPENSO |
| Q | acao_realizada | LOGIN · LOGOUT · LOGIN_FALHOU · CRIACAO · ALTERACAO · EXCLUSAO_LOGICA · CONSULTA_SENSIVEL · ENTREGA_EPI · TROCA_EPI · BLOQUEIO_ATIVIDADE · LIBERACAO_EXCEPCIONAL · ALERTA_FADIGA_GERADO · ABERTURA_RCA · ENCERRAMENTO_RCA · VERSIONAMENTO_POP · ALTERACAO_PERMISSAO · AJUSTE_PARAMETRO · ESTORNO |
| R | origem_acao | TOTEM · WEB_DESKTOP · TABLET · RELOGIO_PONTO · MOTOR_REGRAS · ROTINA_AUTOMATICA |
| S | resultado | SUCESSO · NEGADO_RBAC · NEGADO_REGRA · ERRO |
| T | criticidade | INFO · AVISO · CRITICO |
| U | nivel_hierarquico | OPERACIONAL · GESTOR · DIRETORIA · MASTER_ADMIN |
| V | tipo_evento_incidente | ACIDENTE · QUASE_ACIDENTE · DESVIO |
| W | gravidade | LEVE · MODERADA · GRAVE · FATAL |
| X | categoria_causa | DESVIO_POP · AUSENCIA_EPI · USO_INCORRETO_EPI · EPI_INADEQUADO · DESGASTE_PREMATURO · FALHA_TREINAMENTO · FALHA_COMUNICACAO · FALHA_SUPERVISAO · CONDICAO_INSEGURA · FADIGA_QUEDA_ATENCAO · INCOMPATIBILIDADE_HABILITACAO · PROCEDIMENTO_INEXISTENTE_OU_DESATUALIZADO |
| Y | status_vigencia_pop | VIGENTE · EM_REVISAO · OBSOLETO |
| Z | status_reciclagem | PENDENTE · CONCLUIDA · BLOQUEIA_ATIVIDADE |

### Aplicação (Dados → Validação de dados → Menu suspenso de um intervalo)

| Aba | Intervalo | Critério | Inválido |
|---|---|---|---|
| Funcionarios | D2:D | `=Listas!$A$2:$A` | Rejeitar |
| Funcionarios | E2:E | `=Empresas_Terceiras!$A$2:$A` | Avisar |
| Funcionarios | F2:F | `=Setores!$A$2:$A` | Rejeitar |
| Funcionarios | G2:G | `=Funcoes!$A$2:$A` | Rejeitar |
| Funcionarios | H2:H | `=Listas!$B$2:$B` | Rejeitar |
| Funcionarios | K2:K | `=Funcionarios!$A$2:$A` | Avisar |
| Funcionarios | P2:P | `=Listas!$C$2:$C` | Rejeitar |
| Funcionarios | W2:W | `=Listas!$U$2:$U` | Rejeitar |
| Equipamentos_EPI_EPC | C2:C | `=Listas!$D$2:$D` | Rejeitar |
| Equipamentos_EPI_EPC | D2:D | `=Listas!$E$2:$E` | Rejeitar |
| Equipamentos_EPI_EPC | J2:J | `=Listas!$M$2:$M` | Rejeitar |
| Equipamentos_EPI_EPC | L2:L | `=Listas!$F$2:$F` | Rejeitar |
| Equipamentos_EPI_EPC | T2:T | `=Listas!$G$2:$G` | Rejeitar |
| Movimentacoes_Trocas | C2:C | `=Funcionarios!$A$2:$A` | Rejeitar |
| Movimentacoes_Trocas | D2:D | `=Equipamentos_EPI_EPC!$A$2:$A` | Rejeitar |
| Movimentacoes_Trocas | E2:E | `=Listas!$H$2:$H` | Rejeitar |
| Movimentacoes_Trocas | G2:G | `=Listas!$I$2:$I` | Rejeitar |
| Movimentacoes_Trocas | M2:M | `=Listas!$J$2:$J` | Rejeitar |
| Movimentacoes_Trocas | N2:N | `=Listas!$K$2:$K` | Avisar |
| Movimentacoes_Trocas | Q2:Q | `=Funcionarios!$A$2:$A` | Rejeitar |
| Setores | E2:E, F2:F | `=Funcionarios!$A$2:$A` | Avisar |
| Setores | G2:G | `=Listas!$L$2:$L` | Rejeitar |
| Setores | I2:I, J2:J | `=Listas!$M$2:$M` | Rejeitar |
| Funcoes | C2:C | `=Setores!$A$2:$A` | Rejeitar |
| Funcoes | J2:J, M2:M | `=Listas!$M$2:$M` | Rejeitar |
| Funcoes | K2:K | `=Listas!$L$2:$L` | Rejeitar |
| Empresas_Terceiras | K2:K | `=Listas!$O$2:$O` | Rejeitar |
| Empresas_Terceiras | L2:L, M2:M, S2:S | `=Listas!$M$2:$M` | Rejeitar |
| Empresas_Terceiras | U2:U | `=Listas!$N$2:$N` | Rejeitar |
| Gamificacao_Mentoria | B2:B, C2:C | `=Funcionarios!$A$2:$A` | Rejeitar |
| Gamificacao_Mentoria | D2:D | `=Setores!$A$2:$A` | Rejeitar |
| Gamificacao_Mentoria | G2:G | `=Listas!$P$2:$P` | Rejeitar |
| Gamificacao_Mentoria | S2:S | `=Listas!$M$2:$M` | Rejeitar |
| Log_Auditoria | E2:E | `=Listas!$Q$2:$Q` | Rejeitar |
| Log_Auditoria | K2:K | `=Listas!$R$2:$R` | Rejeitar |
| Log_Auditoria | N2:N | `=Listas!$S$2:$S` | Rejeitar |
| Log_Auditoria | O2:O | `=Listas!$T$2:$T` | Rejeitar |
| Incidentes | E2:E | `=Listas!$V$2:$V` | Rejeitar |
| Incidentes | F2:F | `=Listas!$W$2:$W` | Rejeitar |
| RCA_Investigacoes | M2:M | `=Listas!$X$2:$X` | Rejeitar |
| POPs | D2:D | `=Listas!$Y$2:$Y` | Rejeitar |
| Matriz_Reciclagem | F2:F | `=Listas!$Z$2:$Z` | Rejeitar |

### Validações personalizadas (Fórmula personalizada é)

| Aba | Intervalo | Fórmula | Impede |
|---|---|---|---|
| Funcionarios | A2:A | `=CONT.SE($A$2:$A;$A2)=1` | Matrícula duplicada |
| Funcionarios | C2:C | `=CONT.SE($C$2:$C;$C2)=1` | CPF duplicado |
| Equipamentos_EPI_EPC | A2:A | `=CONT.SE($A$2:$A;$A2)=1` | Código duplicado |
| Equipamentos_EPI_EPC | I2:I | `=E(ÉNÚM($I2);$I2>0)` | Vida útil inválida |
| Equipamentos_EPI_EPC | O2:O | `=$O2<=$N2` | Segurança > ponto de pedido |
| Movimentacoes_Trocas | A2:A | `=CONT.SE($A$2:$A;$A2)=1` | ID repetido |
| Movimentacoes_Trocas | F2:F | `=E(ÉNÚM($F2);$F2>0)` | Quantidade inválida |
| Empresas_Terceiras | H2:H | `=$H2>$G2` | Fim antes do início |
| Gamificacao_Mentoria | C2:C | `=$C2<>$B2` | Mentor de si mesmo |
| Gamificacao_Mentoria | K2:K | `=E($K2>=0,05;$K2<=0,25)` | Repasse fora de 5–25% |

---

## PARTE 3 — Proteger intervalos

Caminho: **Dados → Proteger páginas e intervalos**.

### 🔴 Nível 1 — Bloqueio total (só Admin)
| Aba | Intervalo |
|---|---|
| Log_Auditoria | Página inteira |
| Listas | Página inteira |
| Painel_Integridade | Página inteira |
| POPs_Historico | Página inteira |
| RCA_Investigacoes | Página inteira (exceto escrita via script) |
| Funcionarios | I:J (senha_hash, salt) |
| Funcionarios | M:M (id_biometrico) |
| Movimentacoes_Trocas | U:U (hash_registro) |

### 🟡 Nível 2 — Colunas de fórmula (ninguém edita, todos leem)
| Aba | Intervalo |
|---|---|
| Equipamentos_EPI_EPC | H:H, M:M, P:P |
| Movimentacoes_Trocas | J:L, T:T |
| Empresas_Terceiras | I:J, T:T |
| Funcionarios | U:V |
| Gamificacao_Mentoria | H:H, J:J, L:N, P:R (o mais crítico de todos) |

### 🟢 Nível 3 — Cadastros mestres (SST + Admin editam; gestores só leem)
| Aba | Intervalo |
|---|---|
| Setores | Página inteira |
| Funcoes | Página inteira |
| Empresas_Terceiras | A:H, K:S, U:U |
| Equipamentos_EPI_EPC | A:G, I:L, N:T |
| Funcionarios | A:H, K:L, N:Q, W:Y |
| Gamificacao_Mentoria | A:G, I, K, O, S:U |
| Movimentacoes_Trocas | A:I, M:S |
| Incidentes | Página inteira (leitura ampla, escrita SST/Admin/Gestor) |

---

## Avisos finais

1. **Proteção de intervalo não é segurança.** Quem edita pode copiar a
   planilha sem proteção. Aceitável no MVP; em produção, só o app acessa.
2. **`ARRAYFORMULA`** propaga fórmula para linhas novas inseridas por
   script. Converta só depois de validar a versão simples — debugar
   `ARRAYFORMULA` errada é mais difícil.
3. **Teto de performance**: acima de ~15 mil linhas em
   `Movimentacoes_Trocas`, `SOMASES`/`CONT.SES` cruzando abas começa a
   pesar. É o sinal de migrar para PostgreSQL — não antes.
