/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EHS SMART ENTERPRISE · compliance.js — v2.0
 * Motor de conformidade: valida colaborador antes de atividades críticas.
 * Dependências: utils.js, rbac.js, audit.js
 * ═══════════════════════════════════════════════════════════════════════════
 */

function validarColaborador(matricula) {
  const u = _obterUsuario(matricula);
  if (!u) return { liberado: false, pessoa: null, motivos: ['Matrícula não cadastrada'], alertas: [] };

  const motivos = [];
  const alertas = [];

  if (String(u.status_efetivo).toUpperCase() !== 'ATIVO') {
    motivos.push(u.motivo_bloqueio_automatico || ('Colaborador com status ' + u.status_efetivo));
  }

  const setorRow = _buscarLinha(CFG.ABAS.SETORES, CFG.COL_SETORES.id_setor, u.setor);
  let setor = null;
  if (setorRow) {
    const cs = CFG.COL_SETORES;
    setor = {
      id_setor: setorRow.dados[cs.id_setor - 1],
      nome_setor: setorRow.dados[cs.nome_setor - 1],
      id_unidade: setorRow.dados[cs.id_unidade - 1],
      id_gestor_responsavel: setorRow.dados[cs.id_gestor_responsavel - 1],
      id_gestor_substituto: setorRow.dados[cs.id_gestor_substituto - 1],
      nivel_criticidade: setorRow.dados[cs.nivel_criticidade - 1],
      permite_terceirizado: String(setorRow.dados[cs.permite_terceirizado - 1]).toUpperCase()
    };
    if (u.tipo_vinculo === 'TERCEIRIZADO' && setor.permite_terceirizado === 'NÃO') {
      motivos.push('Setor ' + setor.nome_setor + ' não permite terceirizados');
    }
  } else {
    motivos.push('Setor não cadastrado: ' + u.setor);
  }

  if (u.tipo_vinculo === 'TERCEIRIZADO') {
    const empRow = _buscarLinha(CFG.ABAS.EMPRESAS, CFG.COL_EMPRESAS.id_empresa, u.empresa);
    if (!empRow) {
      motivos.push('Empresa contratada não cadastrada: ' + u.empresa);
    } else {
      const ce = CFG.COL_EMPRESAS;
      const statusContrato = String(empRow.dados[ce.status_contrato - 1]).toUpperCase();
      const statusDoc = String(empRow.dados[ce.status_documentacao - 1]).toUpperCase();
      if (statusContrato !== 'VIGENTE') {
        motivos.push('Contrato ' + empRow.dados[ce.numero_contrato - 1] + ' · ' + statusContrato);
      }
      if (statusDoc !== 'REGULAR') {
        motivos.push('Documentação da contratada · ' + statusDoc);
      }
      const setoresOk = _listar(empRow.dados[ce.setores_autorizados - 1]);
      if (setoresOk.length && setoresOk.indexOf(String(u.setor)) === -1) {
        motivos.push('Contratada não autorizada no setor ' + u.setor);
      }
    }
  }

  const funcRow = _buscarLinha(CFG.ABAS.FUNCOES, CFG.COL_FUNCOES.id_funcao, u.funcao);
  let funcao = null;
  if (funcRow) {
    const cf = CFG.COL_FUNCOES;
    funcao = {
      id_funcao: funcRow.dados[cf.id_funcao - 1],
      nome_funcao: funcRow.dados[cf.nome_funcao - 1],
      epis_obrigatorios: _listar(funcRow.dados[cf.epis_obrigatorios - 1]),
      epis_condicionais: _listar(funcRow.dados[cf.epis_condicionais - 1]),
      nrs_obrigatorias: _listar(funcRow.dados[cf.nrs_obrigatorias - 1]),
      grau_exposicao_risco: funcRow.dados[cf.grau_exposicao_risco - 1],
      limite_horas_extras_mes: Number(funcRow.dados[cf.limite_horas_extras_mes - 1]) || 40,
      elegivel_gamificacao: String(funcRow.dados[cf.elegivel_gamificacao - 1]).toUpperCase()
    };

    const treinos = _lerTudo(CFG.ABAS.TREINAMENTOS);
    const ct = CFG.COL_TREINAMENTOS;
    const alvo = String(matricula).trim().toUpperCase();

    funcao.nrs_obrigatorias.forEach(function (nr) {
      let vencimento = null;
      treinos.forEach(function (t) {
        if (String(t[ct.matricula - 1]).trim().toUpperCase() === alvo &&
            String(t[ct.norma - 1]).trim().toUpperCase() === nr.toUpperCase() &&
            String(t[ct.status - 1]).toUpperCase() !== 'CANCELADO') {
          const d = t[ct.data_vencimento - 1];
          if (d && (!vencimento || new Date(d) > new Date(vencimento))) vencimento = d;
        }
      });

      if (!vencimento) { motivos.push(nr + ' · treinamento não registrado'); return; }
      const dias = _diasAte(vencimento);
      if (dias < 0)        motivos.push(nr + ' · vencida há ' + Math.abs(dias) + ' dias');
      else if (dias <= 30) alertas.push(nr + ' · vence em ' + dias + ' dias');
    });
  } else {
    motivos.push('Função não cadastrada: ' + u.funcao);
  }

  return {
    liberado: motivos.length === 0,
    pessoa: u, setor: setor, funcao: funcao,
    motivos: motivos, alertas: alertas
  };
}
