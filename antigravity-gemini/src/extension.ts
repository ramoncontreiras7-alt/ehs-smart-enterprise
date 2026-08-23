import * as vscode from 'vscode';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

let statusBarItem: vscode.StatusBarItem;
let chatPanel: vscode.WebviewPanel | undefined;
let genAI: GoogleGenerativeAI | undefined;
let model: GenerativeModel | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('Google Gemini para Antigravity está ativo!');

  const config = vscode.workspace.getConfiguration('gemini');
  const apiKey = config.get<string>('apiKey', '');

  if (apiKey) {
    initializeGemini(apiKey);
  }

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = '$(robot) Gemini';
  statusBarItem.tooltip = 'Google Gemini Assistant';
  statusBarItem.command = 'gemini.chat';
  statusBarItem.show();

  context.subscriptions.push(
    vscode.commands.registerCommand('gemini.chat', openChatPanel)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gemini.explainCode', explainSelectedCode)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gemini.generateCode', generateCode)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gemini.refactorCode', refactorSelectedCode)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gemini.generateTests', generateTests)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gemini.configureApiKey', configureApiKey)
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('gemini.apiKey')) {
        const newApiKey = config.get<string>('apiKey', '');
        if (newApiKey) {
          initializeGemini(newApiKey);
          vscode.window.showInformationMessage('API Key do Gemini configurada com sucesso!');
        }
      }
    })
  );

  context.subscriptions.push(statusBarItem);
}

function initializeGemini(apiKey: string): void {
  try {
    genAI = new GoogleGenerativeAI(apiKey);
    const modelName = vscode.workspace.getConfiguration('gemini').get<string>('model', 'gemini-1.5-pro');
    model = genAI.getGenerativeModel({ model: modelName });
  } catch (error) {
    vscode.window.showErrorMessage(`Erro ao inicializar Gemini: ${error}`);
  }
}

function ensureModelInitialized(): boolean {
  if (!model) {
    const apiKey = vscode.workspace.getConfiguration('gemini').get<string>('apiKey', '');
    if (!apiKey) {
      vscode.window.showWarningMessage('Por favor, configure a API Key do Gemini primeiro.', 'Configurar', 'Cancelar')
        .then(selection => {
          if (selection === 'Configurar') {
            vscode.commands.executeCommand('gemini.configureApiKey');
          }
        });
      return false;
    }
    initializeGemini(apiKey);
  }
  return true;
}

async function openChatPanel(): Promise<void> {
  if (!ensureModelInitialized()) return;

  if (chatPanel) {
    chatPanel.reveal();
    return;
  }

  chatPanel = vscode.window.createWebviewPanel(
    'geminiChat',
    'Gemini Chat',
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );

  chatPanel.webview.html = getWebviewContent();

  chatPanel.webview.onDidReceiveMessage(
    async message => {
      switch (message.command) {
        case 'sendMessage':
          await handleChatMessage(message.text, message.image, message.mimeType, chatPanel!.webview);
          break;
        case 'clearChat':
          chatPanel!.webview.postMessage({ command: 'clear' });
          break;
      }
    }
  );

  chatPanel.onDidDispose(
    () => {
      chatPanel = undefined;
    }
  );
}

async function handleChatMessage(userMessage: string, image?: string, mimeType?: string, webview?: vscode.Webview): Promise<void> {
  if (!model) {
    webview?.postMessage({ command: 'error', text: 'Modelo Gemini não inicializado.' });
    return;
  }

  webview?.postMessage({ command: 'loading', text: true });

  try {
    const systemPrompt = vscode.workspace.getConfiguration('gemini').get<string>('systemPrompt', '');
    const temperature = vscode.workspace.getConfiguration('gemini').get<number>('temperature', 0.7);
    const maxTokens = vscode.workspace.getConfiguration('gemini').get<number>('maxTokens', 2048);

    const parts: any[] = [];
    if (systemPrompt) {
      parts.push({ text: systemPrompt });
    }
    parts.push({ text: userMessage });
    if (image && mimeType) {
      parts.push({ inlineData: { mimeType, data: image } });
    }

    const chat = model.startChat();
    const result = await chat.sendMessage(parts);
    const response = await result.response;
    const text = response.text();

    webview?.postMessage({ command: 'response', text });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (image && mimeType && errorMessage.includes('does not support image input')) {
      webview?.postMessage({ command: 'error', text: 'Este modelo não suporta entrada de imagem. Altere para gemini-1.5-pro ou gemini-1.5-flash em Configurações.' });
    } else {
      webview?.postMessage({ command: 'error', text: `Erro: ${errorMessage}` });
    }
  }
}

async function explainSelectedCode(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('Nenhum editor ativo encontrado.');
    return;
  }

  const selection = editor.selection;
  const selectedCode = editor.document.getText(selection);

  if (!selectedCode) {
    vscode.window.showWarningMessage('Selecione um trecho de código para explicar.');
    return;
  }

  if (!ensureModelInitialized()) return;

  const prompt = `Explique o seguinte código de forma clara e didática:\n\n${selectedCode}`;

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Gemini está analisando o código...' },
    async () => {
      try {
        const result = await model!.generateContent(prompt);
        const response = await result.response;
        const explanation = response.text();

        const doc = await vscode.workspace.openTextDocument({
          content: `# Explicação do Código\n\n${explanation}`,
          language: 'markdown'
        });
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
      } catch (error) {
        vscode.window.showErrorMessage(`Erro ao explicar código: ${error}`);
      }
    }
  );
}

async function generateCode(): Promise<void> {
  const input = await vscode.window.showInputBox({
    prompt: 'Descreva o código que você deseja gerar:',
    placeHolder: 'Ex: Uma função em Python que calcula Fibonacci'
  });

  if (!input) return;

  if (!ensureModelInitialized()) return;

  const language = vscode.window.activeTextEditor?.document.languageId || 'python';
  const prompt = `Gere código em ${language} para a seguinte solicitação: ${input}. Apenas o código, sem explicações adicionais.`;

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Gemini está gerando código...' },
    async () => {
      try {
        const result = await model!.generateContent(prompt);
        const response = await result.response;
        const generatedCode = response.text();

        const editor = vscode.window.activeTextEditor;
        if (editor) {
          const position = editor.selection.active;
          await editor.edit(editBuilder => {
            editBuilder.insert(position, generatedCode);
          });
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Erro ao gerar código: ${error}`);
      }
    }
  );
}

async function refactorSelectedCode(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('Nenhum editor ativo encontrado.');
    return;
  }

  const selection = editor.selection;
  const selectedCode = editor.document.getText(selection);

  if (!selectedCode) {
    vscode.window.showWarningMessage('Selecione um trecho de código para refatorar.');
    return;
  }

  if (!ensureModelInitialized()) return;

  const language = editor.document.languageId;
  const prompt = `Refatore o seguinte código em ${language} para melhorar legibilidade, performance e boas práticas. Retorne apenas o código refatorado:\n\n${selectedCode}`;

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Gemini está refatorando...' },
    async () => {
      try {
        const result = await model!.generateContent(prompt);
        const response = await result.response;
        const refactoredCode = response.text();

        await editor.edit(editBuilder => {
          editBuilder.replace(selection, refactoredCode);
        });
      } catch (error) {
        vscode.window.showErrorMessage(`Erro ao refatorar código: ${error}`);
      }
    }
  );
}

async function generateTests(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('Nenhum editor ativo encontrado.');
    return;
  }

  const selection = editor.selection;
  const selectedCode = editor.document.getText(selection);

  if (!selectedCode) {
    vscode.window.showWarningMessage('Selecione um trecho de código para gerar testes.');
    return;
  }

  if (!ensureModelInitialized()) return;

  const language = editor.document.languageId;
  const prompt = `Gere testes unitários para o seguinte código em ${language}. Use as melhores práticas de testing:\n\n${selectedCode}`;

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Gemini está gerando testes...' },
    async () => {
      try {
        const result = await model!.generateContent(prompt);
        const response = await result.response;
        const tests = response.text();

        const doc = await vscode.workspace.openTextDocument({
          content: tests,
          language: language
        });
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
      } catch (error) {
        vscode.window.showErrorMessage(`Erro ao gerar testes: ${error}`);
      }
    }
  );
}

async function configureApiKey(): Promise<void> {
  const apiKey = await vscode.window.showInputBox({
    prompt: 'Insira sua chave API do Google Gemini',
    password: true,
    placeHolder: 'AIzaSy...'
  });

  if (apiKey) {
    await vscode.workspace.getConfiguration('gemini').update('apiKey', apiKey, vscode.ConfigurationTarget.Global);
  }
}

function getWebviewContent(): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gemini Chat</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      padding: 20px;
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
    }
    #chat-container {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 100px);
    }
    #chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 10px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      margin-bottom: 10px;
      background-color: var(--vscode-editor-background);
    }
    .message {
      margin-bottom: 15px;
      padding: 10px;
      border-radius: 4px;
    }
    .user-message {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      text-align: right;
    }
    .assistant-message {
      background-color: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
    }
    #chat-input-container {
      display: flex;
      gap: 10px;
    }
    #chat-input {
      flex: 1;
      padding: 8px;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      font-family: var(--vscode-font-family);
    }
    #send-button, #upload-button {
      padding: 8px 16px;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    #send-button:hover, #upload-button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    #image-preview {
      margin-top: 8px;
      max-width: 120px;
      max-height: 120px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
    }
    .error {
      color: var(--vscode-errorForeground);
    }
  </style>
</head>
<body>
  <div id="chat-container">
    <div id="chat-messages"></div>
    <div id="chat-input-container">
      <input type="file" id="image-input" accept="image/*" style="display:none" />
      <button id="upload-button">Imagem</button>
      <input type="text" id="chat-input" placeholder="Digite sua mensagem..." />
      <button id="send-button">Enviar</button>
    </div>
    <img id="image-preview" style="display:none" />
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    const messagesDiv = document.getElementById('chat-messages');
    const input = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const imageInput = document.getElementById('image-input');
    const uploadButton = document.getElementById('upload-button');
    const imagePreview = document.getElementById('image-preview');

    let selectedImageBase64 = '';
    let selectedImageMimeType = '';

    function addMessage(text, isUser, imageSrc) {
      const messageDiv = document.createElement('div');
      messageDiv.className = 'message ' + (isUser ? 'user-message' : 'assistant-message');
      if (imageSrc) {
        const img = document.createElement('img');
        img.src = imageSrc;
        img.style.maxWidth = '200px';
        img.style.maxHeight = '200px';
        img.style.borderRadius = '4px';
        messageDiv.appendChild(img);
      }
      if (text) {
        messageDiv.textContent = text;
      }
      messagesDiv.appendChild(messageDiv);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    function sendMessage() {
      const text = input.value.trim();
      if (!text && !selectedImageBase64) return;

      vscode.postMessage({ command: 'sendMessage', text: text || '', image: selectedImageBase64, mimeType: selectedImageMimeType });

      addMessage(text || '', true, selectedImageBase64 ? 'data:' + selectedImageMimeType + ';base64,' + selectedImageBase64 : undefined);
      input.value = '';
      selectedImageBase64 = '';
      selectedImageMimeType = '';
      imagePreview.style.display = 'none';
    }

    uploadButton.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      selectedImageMimeType = file.type;
      const reader = new FileReader();
      reader.onload = () => {
        selectedImageBase64 = reader.result.split(',')[1];
        imagePreview.src = 'data:' + selectedImageMimeType + ';base64,' + selectedImageBase64;
        imagePreview.style.display = 'block';
      };
      reader.readAsDataURL(file);
    });

    sendButton.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });

    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.command) {
        case 'response':
          addMessage(message.text, false);
          break;
        case 'error':
          const errorDiv = document.createElement('div');
          errorDiv.className = 'message error';
          errorDiv.textContent = message.text;
          messagesDiv.appendChild(errorDiv);
          break;
        case 'clear':
          messagesDiv.innerHTML = '';
          break;
      }
    });
  </script>
</body>
</html>`;
}

export function deactivate() {
  if (statusBarItem) {
    statusBarItem.dispose();
  }
  if (chatPanel) {
    chatPanel.dispose();
  }
}
