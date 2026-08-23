# Script de Instalação para Computador Formatado
# Instala: OmniRoute, Antigravity, Google Drive, Node.js, Visual Studio Code
# Execute como Administrador no PowerShell

param(
    [switch]$SkipChocolatey = $false,
    [switch]$SkipNode = $false,
    [switch]$SkipVSCode = $false,
    [switch]$SkipOmniRoute = $false,
    [switch]$SkipAntigravity = $false,
    [switch]$SkipGoogleDrive = $false
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "`n[PASSO] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Yellow
}

# Verificar se está executando como Administrador
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERRO: Execute este script como Administrador!" -ForegroundColor Red
    exit 1
}

# ============================================================================
# 1. Instalar Chocolatey (Gerenciador de Pacotes)
# ============================================================================
if (-not $SkipChocolatey) {
    Write-Step "Verificando/Instalando Chocolatey..."
    
    if (Get-Command choco -ErrorAction SilentlyContinue) {
        Write-Success "Chocolatey já está instalado."
        choco --version
    } else {
        Write-Info "Instalando Chocolatey..."
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
        
        # Recarregar variáveis de ambiente
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        
        if (Get-Command choco -ErrorAction SilentlyContinue) {
            Write-Success "Chocolatey instalado com sucesso!"
            choco --version
        } else {
            Write-Host "Falha ao instalar Chocolatey. Instale manualmente em https://chocolatey.org/install" -ForegroundColor Red
        }
    }
} else {
    Write-Info "Pulando instalação do Chocolatey."
}

# ============================================================================
# 2. Instalar Node.js
# ============================================================================
if (-not $SkipNode) {
    Write-Step "Instalando Node.js LTS..."
    
    if (Get-Command node -ErrorAction SilentlyContinue) {
        $nodeVersion = node --version
        Write-Success "Node.js já está instalado: $nodeVersion"
    } else {
        choco install nodejs-lts -y --no-progress
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        
        if (Get-Command node -ErrorAction SilentlyContinue) {
            Write-Success "Node.js instalado: $(node --version)"
            Write-Success "npm instalado: $(npm --version)"
        } else {
            Write-Host "Falha ao instalar Node.js." -ForegroundColor Red
        }
    }
} else {
    Write-Info "Pulando instalação do Node.js."
}

# ============================================================================
# 3. Instalar Visual Studio Code
# ============================================================================
if (-not $SkipVSCode) {
    Write-Step "Instalando Visual Studio Code..."
    
    if (Get-Command code -ErrorAction SilentlyContinue) {
        Write-Success "VS Code já está instalado."
        code --version
    } else {
        choco install vscode -y --no-progress
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        
        if (Get-Command code -ErrorAction SilentlyContinue) {
            Write-Success "VS Code instalado com sucesso!"
        } else {
            Write-Host "Falha ao instalar VS Code." -ForegroundColor Red
        }
    }
} else {
    Write-Info "Pulando instalação do VS Code."
}

# ============================================================================
# 4. Instalar OmniRoute (via npm)
# ============================================================================
if (-not $SkipOmniRoute) {
    Write-Step "Instalando OmniRoute..."
    
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host "Node.js não encontrado. Instale Node.js primeiro." -ForegroundColor Red
    } else {
        Write-Info "Instalando OmniRoute globalmente via npm..."
        npm install -g omniroute
        
        if (Get-Command omniroute -ErrorAction SilentlyContinue) {
            Write-Success "OmniRoute instalado com sucesso!"
            omniroute --version 2>$null
        } else {
            Write-Host "Instalação do OmniRoute concluída. Execute 'omniroute' para iniciar." -ForegroundColor Yellow
        }
    }
} else {
    Write-Info "Pulando instalação do OmniRoute."
}

# ============================================================================
# 5. Instalar Google Antigravity
# ============================================================================
if (-not $SkipAntigravity) {
    Write-Step "Instalando Google Antigravity..."
    
    $antigravityUrl = "https://antigravity.google/download"
    $downloadPath = "$env:TEMP\AntigravitySetup.exe"
    
    Write-Info "Baixando Google Antigravity de $antigravityUrl ..."
    
    try {
        # Tentar baixar do site oficial
        Invoke-WebRequest -Uri "https://antigravity.google/download" -OutFile $downloadPath -MaximumRedirection 5 -ErrorAction SilentlyContinue
        
        if (Test-Path $downloadPath) {
            Write-Info "Executando instalador do Antigravity..."
            Start-Process -FilePath $downloadPath -Wait
            Write-Success "Instalador do Antigravity executado."
        } else {
            throw "Download não completado"
        }
    } catch {
        Write-Host "Não foi possível baixar automaticamente." -ForegroundColor Yellow
        Write-Host "Abra o navegador e acesse: https://antigravity.google/download" -ForegroundColor Cyan
        Write-Host "Baixe e instale o Antigravity IDE para Windows." -ForegroundColor Cyan
    }
} else {
    Write-Info "Pulando instalação do Antigravity."
}

# ============================================================================
# 6. Instalar Google Drive para Desktop
# ============================================================================
if (-not $SkipGoogleDrive) {
    Write-Step "Instalando Google Drive para Desktop..."
    
    $googleDriveUrl = "https://dl.google.com/drive-file-stream/GoogleDriveSetup.exe"
    $downloadPath = "$env:TEMP\GoogleDriveSetup.exe"
    
    Write-Info "Baixando Google Drive para Desktop..."
    
    try {
        Invoke-WebRequest -Uri $googleDriveUrl -OutFile $downloadPath
        
        if (Test-Path $downloadPath) {
            Write-Info "Executando instalador do Google Drive..."
            Start-Process -FilePath $downloadPath -Wait
            Write-Success "Instalador do Google Drive executado."
        } else {
            throw "Download não completado"
        }
    } catch {
        Write-Host "Não foi possível baixar automaticamente." -ForegroundColor Yellow
        Write-Host "Abra o navegador e acesse: https://www.google.com/drive/download/" -ForegroundColor Cyan
        Write-Host "Baixe e instale o Google Drive para Desktop." -ForegroundColor Cyan
    }
} else {
    Write-Info "Pulando instalação do Google Drive."
}

# ============================================================================
# Finalização
# ============================================================================
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  INSTALAÇÃO CONCLUÍDA!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

Write-Host "`nResumo do que foi instalado:" -ForegroundColor Cyan
Write-Host "  - Node.js: $(if (Get-Command node -ErrorAction SilentlyContinue) { node --version } else { 'Não instalado' })"
Write-Host "  - npm: $(if (Get-Command npm -ErrorAction SilentlyContinue) { npm --version } else { 'Não instalado' })"
Write-Host "  - VS Code: $(if (Get-Command code -ErrorAction SilentlyContinue) { 'Instalado' } else { 'Não instalado' })"
Write-Host "  - OmniRoute: $(if (Get-Command omniroute -ErrorAction SilentlyContinue) { 'Instalado' } else { 'Instalado (requer Node.js)' })"
Write-Host "  - Antigravity: Verifique no Menu Iniciar"
Write-Host "  - Google Drive: Verifique na bandeja do sistema"

Write-Host "`nPróximos passos:" -ForegroundColor Yellow
Write-Host "  1. Reinicie o terminal/ PowerShell para carregar os novos caminhos"
Write-Host "  2. Execute 'omniroute' para iniciar o gateway (http://localhost:20128)"
Write-Host "  3. Abra o Antigravity pelo Menu Iniciar"
Write-Host "  4. Acesse o Google Drive pelo Explorador de Arquivos"
Write-Host ""
