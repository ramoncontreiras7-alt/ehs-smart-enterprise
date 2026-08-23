# Patch: Hooks_ETL.html — suporte a .xlsx/.xls e seletor de abas

**IMPORTANTE:** Isto é um PATCH (blocos de find/replace), não o arquivo completo.
O `Hooks_ETL.html` original vive na sala "3 - [ETL] Função de Ponte ETL + Backend"
e não está acessível neste ambiente. Estes blocos foram ancorados em trechos reais
recuperados do histórico daquela sala — confira se o texto "old_str" bate
exatamente com o seu arquivo atual antes de aplicar. Se não bater, cole o
arquivo completo numa conversa para eu gerar o patch com precisão cirúrgica.

Contrato de mensagem que o worker espera (confirmado na sala do ETL):
```
{ tipo: 'iniciar', nomeArquivo, extensao, conteudoTexto?, bufferPlanilha?, existentes }
```
`conteudoTexto` para csv/tsv, `bufferPlanilha` (ArrayBuffer) para xlsx/xls — nunca os dois.

---

## Patch 1 — reaproveitar a mesma instância do worker

Sem isso, o cache do `workbook` (que vive na memória do worker) se perde a cada
novo arquivo — a troca de aba deixa de funcionar.

```javascript
let instanciaWorkerEtl = null;
let ultimoArquivoEnviado = null;

function obterWorkerEtl() {
  if (!instanciaWorkerEtl) instanciaWorkerEtl = criarWorkerEtl();
  return instanciaWorkerEtl;
}
```

## Patch 2 — detecção de extensão e leitura como ArrayBuffer

```javascript
function detectarExtensao(nomeArquivo) {
  const partes = (nomeArquivo || '').toLowerCase().split('.');
  return partes.length > 1 ? partes.pop() : '';
}

function lerArquivoComoBuffer(arquivo) {
  return new Promise((resolver, rejeitar) => {
    const leitor = new FileReader();
    leitor.onerror = () => rejeitar(new Error('arquivo ilegível'));
    leitor.onload = () => resolver(leitor.result);
    leitor.readAsArrayBuffer(arquivo);
  });
}
```

## Patch 3 — ramificação no envio ao worker

old_str (fragmento original visto na sala do ETL):
```javascript
    Agentes.registrar(agenteEtl, 'enviando à thread de processamento');
    criarWorkerEtl().postMessage({ tipo: 'iniciar', conteudo, nomeArquivo: arquivo.name, existentes });
```

new_str:
```javascript
    const extensao = detectarExtensao(arquivo.name);
    ultimoArquivoEnviado = { nomeArquivo: arquivo.name, extensao };

    Agentes.registrar(agenteEtl, 'enviando à thread de processamento (' + extensao.toUpperCase() + ')');

    if (extensao === 'xlsx' || extensao === 'xls') {
      const bufferPlanilha = await lerArquivoComoBuffer(arquivo);
      obterWorkerEtl().postMessage(
        { tipo: 'iniciar', nomeArquivo: arquivo.name, extensao, bufferPlanilha, existentes },
        [bufferPlanilha]
      );
    } else {
      const conteudoTexto = await lerArquivoComoTexto(arquivo);
      obterWorkerEtl().postMessage({ tipo: 'iniciar', nomeArquivo: arquivo.name, extensao, conteudoTexto, existentes });
    }
```

ATENÇÃO: isso exige `await`, então a função que envolve este trecho precisa ser `async`.
Se não for, vai quebrar a compilação (erro visível no console, não silencioso).

⚠️ Discrepância não resolvida: o fragmento original usava o campo `conteudo`,
mas o worker espera `conteudoTexto`. Se o CSV já funcionava em produção antes
deste patch, vale testar com atenção — pode ser que exista um passo intermediário
que eu não vi, ou um bug adormecido que este patch está corrigindo de fato.

## Patch 4 — seletor dinâmico de abas

old_str:
```javascript
    case 'previa':
      previaAtual = msg;
      Agentes.registrar(agenteEtl,
        'pronto em ' + (msg.duracaoMs / 1000).toFixed(1) + 's · ' + msg.novos.length + ' novos aguardando conferência', 'ok');
      abrirPrevia(msg);
      liberarBotaoImportar();
      break;
```

new_str:
```javascript
    case 'previa':
      previaAtual = msg;
      Agentes.registrar(agenteEtl,
        'pronto em ' + (msg.duracaoMs / 1000).toFixed(1) + 's · ' + msg.novos.length + ' novos aguardando conferência', 'ok');
      abrirPrevia(msg);
      montarSeletorDeAbas(msg.metadadosPlanilha);
      liberarBotaoImportar();
      break;
```

Função nova:
```javascript
function montarSeletorDeAbas(metadadosPlanilha) {
  const caixa = $('seletorAbas');
  if (!metadadosPlanilha || metadadosPlanilha.totalPlanilhas <= 1) {
    caixa.classList.add('oculto');
    caixa.innerHTML = '';
    return;
  }

  caixa.classList.remove('oculto');
  caixa.innerHTML =
    '<label for="selectAba">Este arquivo tem ' + metadadosPlanilha.totalPlanilhas + ' planilhas — escolha qual importar:</label>' +
    '<select id="selectAba"></select>';

  const select = $('selectAba');
  metadadosPlanilha.planilhasDisponiveis.forEach(p => {
    const opcao = document.createElement('option');
    opcao.value = p.nome;
    opcao.textContent = p.nome + ' (' + p.linhas + ' linhas)';
    if (p.nome === metadadosPlanilha.planilhaEscolhida) opcao.selected = true;
    select.appendChild(opcao);
  });

  select.addEventListener('change', () => {
    Agentes.registrar(agenteEtl, 'reprocessando com a aba "' + select.value + '"');
    obterWorkerEtl().postMessage({ tipo: 'trocarPlanilha', sheetForcado: select.value, linhaForcada: null });
  });
}
```

Precisa existir `<div id="seletorAbas" class="oculto"></div>` perto da área de prévia.

---

## PENDENTE — não incluído neste patch

O trecho que monta e dispara `google.script.run.importarFuncionariosEmLote(...)`
ainda não foi escrito em nenhuma sala. Depende da assinatura exata dessa função
no `ETL_Ingestao.gs` (que ainda não me foi enviada). Ver `00_MANIFESTO.md`.
