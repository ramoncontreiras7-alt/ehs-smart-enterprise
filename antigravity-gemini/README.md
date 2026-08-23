# Gemini para Antigravity IDE

Extensão que integra o **Google Gemini AI** diretamente no **Antigravity IDE**, proporcionando assistência inteligente de código, chat interativo e ferramentas de produtividade para desenvolvedores.

## Características

- **Chat Interativo**: Painel de chat com o Gemini diretamente no IDE
- **Explicar Código**: Selecione um trecho e obtenha explicações detalhadas
- **Gerar Código**: Descreva o que precisa e o Gemini gera o código
- **Refatorar**: Melhore automaticamente o código selecionado
- **Gerar Testes**: Crie testes unitários automaticamente
- **Integração Nativa**: Funciona diretamente no Antigravity IDE

## Requisitos

- [Antigravity IDE](https://antigravity.google/) v1.0.0 ou superior
- Chave API do [Google AI Studio](https://aistudio.google.com/app/apikey)

## Instalação

### Método 1: Via VSIX (Recomendado)

1. Baixe o arquivo `.vsix` da última release
2. No Antigravity IDE, pressione `Ctrl+Shift+P`
3. Digite `Extensions: Install from VSIX...`
4. Selecione o arquivo baixado
5. Reinicie o Antigravity se solicitado

### Método 2: Desenvolvimento Local

```bash
# Clone o repositório
git clone https://github.com/gemini-antigravity/antigravity-gemini.git
cd antigravity-gemini

# Instale as dependências
npm install

# Compile
npm run compile

# No Antigravity, pressione Ctrl+Shift+P
# Selecione "Extensions: Install from VSIX..."
# Escolha o arquivo .vsix gerado em /out
```

## Configuração

1. Após instalar, pressione `Ctrl+Shift+P`
2. Digite `Gemini: Configurar API Key`
3. Insira sua chave API do Google AI Studio
4. A extensão estará pronta para uso!

## Uso

### Comandos Disponíveis

| Comando | Descrição | Atalho |
|---------|-----------|--------|
| `Gemini: Abrir Chat` | Abre o painel de chat interativo | - |
| `Gemini: Explicar Código Selecionado` | Explica o código selecionado | - |
| `Gemini: Gerar Código` | Gera código baseado em descrição | - |
| `Gemini: Refatorar Código` | Refatora o código selecionado | - |
| `Gemini: Gerar Testes` | Gera testes unitários | - |
| `Gemini: Configurar API Key` | Configura a chave API | - |

### Uso via Context Menu

Selecione qualquer trecho de código e clique com o botão direito para acessar:
- Explicar Código
- Refatorar Código

### Chat Interativo

Clique no ícone do Gemini na barra de status ou use o comando `Gemini: Abrir Chat` para abrir o painel de chat. Digite sua pergunta e receba respostas em tempo real.

## Configurações

Acesse `File > Preferences > Settings` e busque por `gemini` para configurar:

| Configuração | Descrição | Padrão |
|--------------|-----------|--------|
| `gemini.apiKey` | Chave API do Google Gemini | - |
| `gemini.model` | Modelo Gemini a ser usado | `gemini-2.0-flash-exp` |
| `gemini.temperature` | Temperatura para geração (0-2) | `0.7` |
| `gemini.maxTokens` | Máximo de tokens na resposta | `2048` |
| `gemini.systemPrompt` | Prompt de sistema personalizado | *Ver código* |

## Modelos Suportados

- `gemini-2.0-flash-exp` (padrão)
- `gemini-1.5-pro`
- `gemini-1.5-flash`

## Estrutura do Projeto

```
antigravity-gemini/
├── src/
│   └── extension.ts      # Código principal da extensão
├── out/
│   └── extension.js      # Código compilado
├── package.json          # Manifesto da extensão
├── tsconfig.json         # Configuração TypeScript
├── README.md
├── CHANGELOG.md
└── LICENSE
```

## Desenvolvimento

```bash
# Compilar
npm run compile

# Modo watch
npm run watch
```

## Solução de Problemas

**Erro: "API Key não configurada"**
- Execute o comando `Gemini: Configurar API Key`
- Verifique se a chave está correta em Configurações

**Extensão não carrega**
- Verifique se o Antigravity IDE está atualizado
- Reinicie o Antigravity após instalação
- Verifique o log de saída do Antigravity para erros

## Contribuindo

Contribuições são bem-vindas! Por favor:

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Add nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## Licença

MIT - Veja o arquivo [LICENSE](LICENSE) para detalhes.

## Autor

Desenvolvido para a comunidade Antigravity IDE.
