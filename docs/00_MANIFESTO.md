# EHS Smart Enterprise — Manifesto de Consolidação
Gerado a partir da sala "Front-End: Painel Admin e Dashboards" em 18/08/2026.

## ⚠️ Leia isto antes de tratar esta pasta como "tudo"

Cada sala do seu time roda em um ambiente de arquivos isolado — a mesma
separação que você desenhou entre Arquiteto de Dados, Front-End, Regras de
Negócio e ETL. Eu só tenho acesso direto ao disco desta sala (Front-End).
Para as demais, tenho apenas os *trechos de texto* que a busca de histórico
recupera — o suficiente para consultar decisões e contratos, não para
reconstruir um arquivo inteiro com segurança de que não falta nem sobra nada.

Por isso este pacote está dividido em duas categorias honestas:

---

## ✅ COMPLETO — arquivos inteiros, testáveis, gerados nesta sala

`frontend/01_prototipo_standalone_totem_dashboard.html`
Protótipo original, abre direto no navegador (sem depender do Apps Script).
Modo simulação embutido para demonstração sem back-end. Totem + Dashboard
do Gestor num único arquivo, com RBAC visual (cosmético, para teste).

`frontend/02_painel_corporativo_htmlservice_v1.html`
Primeira versão servida via `HtmlService`, com `obterContextoUsuario()`
sem parâmetro (identidade pela sessão Google, não por matrícula digitada).
Superada pela v2 abaixo — mantida aqui por rastreabilidade.

`frontend/03_Index_otimizado_v2_ATUAL.html` ← **versão vigente**
Mesma lógica da v1, sem Tailwind CDN, sem Google Fonts externas, com
relógio de segurança contra travamento no `google.script.run`. É o
arquivo que deve estar colado como `Index.html` no seu projeto Apps Script.

`frontend/04_PATCH_Hooks_ETL_suporte_xlsx.md`
Não é um arquivo de produção — é um patch documentado (blocos find/replace)
para o `Hooks_ETL.html`, que vive na sala do ETL e não está neste disco.
Marcado explicitamente onde há uma discrepância de nome de campo não resolvida.

---

## 🟡 EXISTE EM OUTRA SALA — não reconstruído aqui por segurança

Estes arquivos são reais e foram homologados por você, mas estão em outras
salas. Reconstruí-los aqui a partir de fragmentos de busca arriscaria
reintroduzir bugs já corrigidos ou inventar linhas que nunca existiram —
inaceitável num motor que bloqueia atividade crítica por norma regulamentadora.

| Arquivo | Sala | Status conhecido |
|---|---|---|
| `Code.gs` (v1.0) | 1 - Sala de Controle | Hash SHA-256 encadeado, RBAC de 5 perfis |
| `Code_v2.gs` | 1 - Sala de Controle | RBAC bidimensional (perfil + nível hierárquico), `obterContextoUsuario()` |
| `Motor_Regras.gs` | 1 - Sala de Controle | Motor de fadiga, gamificação assimétrica |
| `ETL_Ingestao.gs` | 3 - ETL | Motor de importação; `importarFuncionariosEmLote` — assinatura exata pendente de confirmação |
| `etl_worker.js` v2 | 3 - ETL | Leitura csv/tsv + xlsx/xls, cache de workbook, troca de aba |
| `Hooks_ETL.html` (original) | 3 - ETL | Base para o patch em `04_PATCH_Hooks_ETL_suporte_xlsx.md` |
| `Painel_Admin.html` | 3 - ETL | Não revisado nesta sala |
| Manifesto v3.0 / peças de endomarketing | 4 - Marketing | Kit chão de fábrica, manual do totem — pendente de definição de prioridade |

---

## Como fechar a consolidação de verdade

A forma confiável é você colar o conteúdo desses arquivos aqui, um de cada
vez ou todos juntos — daí eu confiro contra o que já está documentado nesta
sala (por exemplo, cruzar `Code_v2.gs` contra o que o `Index_v2_otimizado.html`
espera de `obterContextoUsuario()`) e devolvo o pacote de verdade completo,
sem lacuna.

## Pendência ativa nesta sala

O trecho que monta e dispara `google.script.run.importarFuncionariosEmLote(...)`
no `Hooks_ETL.html` ainda não foi escrito — depende da assinatura exata dessa
função, que ainda não foi compartilhada aqui.
