/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EHS SMART ENTERPRISE · config.js — v2.0
 * Constantes de configuração do sistema.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const FADIGA = {
  PESOS: {
    HORAS_EXTRAS_ESTOURO: 3,
    HORAS_EXTRAS_PROXIMO: 1,
    TURNOS_SEQUENCIA_ALTA: 3,
    TURNOS_SEQUENCIA_MEDIA: 1,
    INTERJORNADA_CURTA: 2,
    CRITICAS_MUITAS: 2,
    CRITICAS_ALGUMAS: 1,
    OCORRENCIA_RECENTE: 2,
    EXPOSICAO_CRITICA: 1
  },
  CORTES: { CRITICO: 8, ALTO: 5, MODERADO: 2 },
  INTERJORNADA_MINIMA_HORAS: 11
};

const GAMIFICACAO = {
  PONTOS_POR_TROCA_POSITIVA: 50,
  REPASSE_MINIMO: 0.05,
  REPASSE_MAXIMO: 0.25
};

const CFG = {
  VERSAO: '2.1',
  VERSAO_DATA: '2026-08-26',

  ABAS: {
    FUNCIONARIOS: 'Funcionarios',
    EQUIPAMENTOS: 'Equipamentos_EPI_EPC',
    MOVIMENTACOES: 'Movimentacoes_Trocas',
    LOG: 'Log_Auditoria',
    GAMIFICACAO: 'Gamificacao_Mentoria',
    SETORES: 'Setores',
    FUNCOES: 'Funcoes',
    EMPRESAS: 'Empresas_Terceiras',
    TREINAMENTOS: 'Treinamentos',
    JORNADA: 'Jornada_Consolidada',
    ACOES_PREVENTIVAS: 'Acoes_Preventivas'
  },

  COL_FUNCIONARIOS: {
    matricula: 1, nome_completo: 2, cpf: 3, tipo_vinculo: 4, empresa: 5,
    setor: 6, funcao: 7, perfil_rbac: 8, senha_hash: 9, salt: 10,
    id_gestor: 11, cartao_rfid: 12, id_biometrico: 13, data_admissao: 14,
    data_fim_contrato: 15, status: 16, motivo_bloqueio: 17, criado_em: 18,
    atualizado_em: 19, atualizado_por: 20,
    status_efetivo: 21, motivo_bloqueio_automatico: 22,
    nivel_hierarquico: 23,
    unidades_visiveis: 24,
    email_corporativo: 25
  },

  COL_EQUIPAMENTOS: {
    codigo_epi: 1, nome: 2, categoria: 3, grupo_protecao: 4, fabricante: 5,
    numero_ca: 6, validade_ca: 7, status_ca: 8, vida_util_dias: 9,
    exige_higienizacao: 10, periodicidade_higien_dias: 11, unidade_medida: 12,
    estoque_atual: 13, ponto_pedido: 14, estoque_seguranca: 15,
    status_estoque: 16, custo_unitario: 17, localizacao_almox: 18,
    nrs_associadas: 19, status_item: 20
  },

  COL_MOVIMENTACOES: {
    id_movimentacao: 1, data_hora: 2, matricula: 3, codigo_epi: 4,
    tipo_movimentacao: 5, quantidade: 6, motivo_troca: 7, ca_no_momento: 8,
    lote: 9, data_validade_calculada: 10, dias_uso_efetivo: 11,
    perc_vida_util_aproveitada: 12, status_confirmacao_totem: 13,
    metodo_confirmacao: 14, timestamp_confirmacao: 15, id_totem: 16,
    responsavel_almox: 17, observacao: 18, id_movimentacao_estornada: 19,
    impacto_gamificacao: 20, hash_registro: 21
  },

  COL_LOG: {
    id_log: 1, timestamp: 2, matricula_usuario: 3, perfil_rbac_no_momento: 4,
    acao_realizada: 5, tabela_afetada: 6, id_registro_afetado: 7,
    valor_anterior: 8, valor_novo: 9, justificativa: 10, origem_acao: 11,
    id_dispositivo: 12, endereco_ip: 13, resultado: 14, criticidade: 15,
    hash_registro: 16, hash_anterior: 17, sequencia: 18,
    nivel_hierarquico_no_momento: 19
  },

  COL_SETORES: {
    id_setor: 1, nome_setor: 2, centro_custo: 3, id_unidade: 4,
    id_gestor_responsavel: 5, id_gestor_substituto: 6, nivel_criticidade: 7,
    nrs_aplicaveis: 8, exige_liberacao_previa: 9, permite_terceirizado: 10,
    descricao_riscos: 11, status: 12
  },

  COL_FUNCOES: {
    id_funcao: 1, nome_funcao: 2, id_setor_vinculado: 3, cbo: 4,
    epis_obrigatorios: 5, epis_condicionais: 6, nrs_obrigatorias: 7,
    treinamentos_obrigatorios: 8, atividades_criticas_permitidas: 9,
    exige_aso_especifico: 10, grau_exposicao_risco: 11,
    limite_horas_extras_mes: 12, elegivel_gamificacao: 13, status: 14
  },

  COL_EMPRESAS: {
    id_empresa: 1, cnpj: 2, razao_social: 3, nome_fantasia: 4,
    numero_contrato: 5, objeto_contrato: 6, data_inicio_contrato: 7,
    data_fim_contrato: 8, contrato_vigente: 9, status_contrato: 10,
    status_documentacao: 11, pgr_entregue: 12, pcmso_entregue: 13,
    validade_documentacao: 14, responsavel_tecnico: 15, contato_email: 16,
    contato_telefone: 17, setores_autorizados: 18, fornece_proprio_epi: 19,
    qtd_colaboradores_ativos: 20, status: 21
  },

  COL_TREINAMENTOS: {
    id_treinamento: 1, matricula: 2, norma: 3, carga_horaria: 4,
    data_realizacao: 5, data_vencimento: 6, instrutor: 7,
    numero_certificado: 8, status: 9
  },

  COL_JORNADA: {
    matricula: 1, data_referencia: 2, horas_extras_mes: 3,
    turnos_consecutivos: 4, intervalo_min_horas: 5,
    atividades_criticas_7d: 6, ocorrencias_recentes: 7
  },

  COL_GAMIFICACAO: {
    id_vinculo: 1, matricula_mentor: 2, matricula_mentorado: 3, id_setor: 4,
    data_inicio_vinculo: 5, data_fim_vinculo: 6, status_vinculo: 7,
    pontos_acumulados_mentorado: 8, pontos_base_inicial: 9,
    evolucao_liquida_mentorado: 10, percentual_repasse_mentor: 11,
    saldo_bonus_mentor: 12, saldo_bonus_acumulado_historico: 13,
    infracoes_mentorado: 14, impacto_infracoes_no_mentor: 15,
    perc_vida_util_media_mentorado: 16, qtd_trocas_positivas: 17,
    nivel_evolucao: 18, validado_por_sst: 19, data_validacao_sst: 20,
    observacoes_sst: 21
  },

  COL_ACOES_PREVENTIVAS: {
    id_acao: 1, timestamp: 2, matricula_alvo: 3, nome_alvo_snapshot: 4,
    matricula_solicitante: 5, perfil_rbac_solicitante: 6,
    nivel_hierarquico_solicitante: 7, origem_identificacao: 8,
    alerta_disparo: 9, recomendacao_registrada: 10, status_acao: 11,
    data_conclusao: 12, observacoes: 13, id_log: 14
  },

  PERFIS: ['FUNCIONARIO', 'TERCEIRIZADO', 'GESTOR', 'SST', 'ADMIN'],
  PERFIS_SENSIVEIS: ['GESTOR', 'SST', 'ADMIN'],
  PERFIS_INVESTIGACAO: ['SST', 'ADMIN'],
  PERFIS_ALMOXARIFADO: ['FUNCIONARIO', 'SST', 'ADMIN'],

  HIERARQUIA: {
    OPERACIONAL:  { peso: 1, escopo: 'PROPRIO',  ve_dado_nominal_sensivel: false },
    GESTOR:       { peso: 2, escopo: 'SETORIAL', ve_dado_nominal_sensivel: true  },
    DIRETORIA:    { peso: 3, escopo: 'GLOBAL',   ve_dado_nominal_sensivel: false },
    MASTER_ADMIN: { peso: 4, escopo: 'GLOBAL',   ve_dado_nominal_sensivel: true  }
  },

  COMBINACOES_VALIDAS: {
    MASTER_ADMIN: ['ADMIN'],
    DIRETORIA:    ['ADMIN', 'GESTOR', 'SST'],
    GESTOR:       ['GESTOR', 'SST', 'ADMIN'],
    OPERACIONAL:  ['FUNCIONARIO', 'TERCEIRIZADO', 'GESTOR', 'SST', 'ADMIN']
  },

  HORAS_EXPIRACAO_CONFIRMACAO: 24,
  TIMEOUT_LOCK: 20000,

  FEATURE_FLAGS: {
    alertas_fadiga_email: false,
    alertas_treinamento_email: false,
    modo_totem_offline: false,
    webhook_rca_chat: false
  },

  TOTEM_CRIPTOGRAFIA_SEGredo: 'EHS_TOTEM_SECRET_V2'
};

const CFG_TOTEM = {
  CHAVE_PROPS: 'TOTEM_TOKENS',
  LIMITE_POR_MIN: 30,
  JANELA_SEG: 60
};

function _invalidarCacheGeral() {
  // No-op: mantido por compatibilidade.
}
