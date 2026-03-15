# ═══════════════════════════════════════════════════════════
#  WebCake CMS MCP Server - Installer (Windows PowerShell)
#  Supports: Claude Desktop, Claude Code, Cursor, Windsurf, Augment
# ═══════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"

$REPO_URL = "https://github.com/vuluu2k/webcake_cms_mcp.git"
$DEFAULT_DIR = "$env:USERPROFILE\.webcake-cms-mcp"

Write-Host ""
Write-Host "  WebCake CMS MCP Server - Installer" -ForegroundColor Cyan
Write-Host "  Claude Desktop, Claude Code, Cursor, Windsurf, Augment" -ForegroundColor Cyan
Write-Host ""

# ── Check Node.js ──

function Check-Node {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host "  [ERROR] Node.js is not installed." -ForegroundColor Red
        Write-Host "  Download from: https://nodejs.org/"
        exit 1
    }

    $nodeVersion = (node -v) -replace 'v','' -split '\.' | Select-Object -First 1
    if ([int]$nodeVersion -lt 18) {
        Write-Host "  [ERROR] Node.js >= 18 required. Current: $(node -v)" -ForegroundColor Red
        Write-Host "  Download from: https://nodejs.org/"
        exit 1
    }

    $script:NodeBin = (Get-Command node).Source
    Write-Host "  [OK] Node.js $(node -v) at $script:NodeBin" -ForegroundColor Green
}

# ── Install MCP server ──

function Install-Mcp {
    Write-Host ""
    $dir = Read-Host "  Install path [$DEFAULT_DIR]"
    if (-not $dir) { $dir = $DEFAULT_DIR }
    $script:InstallDir = $dir

    if ((Test-Path "$dir\index.js")) {
        Write-Host "  [OK] MCP server already exists at $dir" -ForegroundColor Green
        $update = Read-Host "  Update to latest version? (y/N)"
        if ($update -match '^[Yy]$') {
            Write-Host "  [INFO] Updating..." -ForegroundColor Blue
            Push-Location $dir
            git pull origin main 2>$null
            if ($LASTEXITCODE -ne 0) { git pull 2>$null }
            npm install --production
            Pop-Location
            Write-Host "  [OK] Updated successfully" -ForegroundColor Green
        }
    } else {
        if (Get-Command git -ErrorAction SilentlyContinue) {
            Write-Host "  [INFO] Cloning repository..." -ForegroundColor Blue
            git clone $REPO_URL $dir
        } else {
            Write-Host "  [ERROR] git is required. Install from: https://git-scm.com/" -ForegroundColor Red
            exit 1
        }
        Write-Host "  [INFO] Installing dependencies..." -ForegroundColor Blue
        Push-Location $dir
        npm install --production
        Pop-Location
        Write-Host "  [OK] MCP server installed at $dir" -ForegroundColor Green
    }

    $script:McpIndex = "$dir\index.js"
}

# ── Collect env vars ──

function Collect-Env {
    Write-Host ""
    Write-Host "  -- Environment Configuration --" -ForegroundColor White
    Write-Host ""

    $script:ApiUrl = Read-Host "  WEBCAKE_API_URL [https://api.storecake.io]"
    if (-not $script:ApiUrl) { $script:ApiUrl = "https://api.storecake.io" }

    do {
        $script:Token = Read-Host "  WEBCAKE_TOKEN (JWT token)"
        if (-not $script:Token) { Write-Host "  [WARN] Token is required." -ForegroundColor Yellow }
    } while (-not $script:Token)

    do {
        $script:SiteId = Read-Host "  WEBCAKE_SITE_ID"
        if (-not $script:SiteId) { Write-Host "  [WARN] Site ID is required." -ForegroundColor Yellow }
    } while (-not $script:SiteId)

    Write-Host ""
    Write-Host "  [OK] Configuration:" -ForegroundColor Green
    Write-Host "  API URL : $script:ApiUrl"
    Write-Host "  Token   : $($script:Token.Substring(0, [Math]::Min(20, $script:Token.Length)))..."
    Write-Host "  Site ID : $script:SiteId"
}

# ── Helper: write MCP config JSON ──

function Get-McpConfig {
    return @"
{
  "mcpServers": {
    "webcake-cms": {
      "command": "$($script:NodeBin -replace '\\', '\\')",
      "args": ["$($script:McpIndex -replace '\\', '\\')"],
      "env": {
        "WEBCAKE_API_URL": "$script:ApiUrl",
        "WEBCAKE_TOKEN": "$script:Token",
        "WEBCAKE_SITE_ID": "$script:SiteId"
      }
    }
  }
}
"@
}

function Merge-McpConfig($configPath) {
    $mcpEntry = @{
        command = $script:NodeBin
        args = @($script:McpIndex)
        env = @{
            WEBCAKE_API_URL = $script:ApiUrl
            WEBCAKE_TOKEN = $script:Token
            WEBCAKE_SITE_ID = $script:SiteId
        }
    }

    if ((Test-Path $configPath) -and (Get-Item $configPath).Length -gt 0) {
        $config = Get-Content $configPath -Raw | ConvertFrom-Json
        if (-not $config.mcpServers) {
            $config | Add-Member -NotePropertyName mcpServers -NotePropertyValue @{}
        }
        $config.mcpServers | Add-Member -NotePropertyName "webcake-cms" -NotePropertyValue $mcpEntry -Force
        $config | ConvertTo-Json -Depth 10 | Set-Content $configPath -Encoding UTF8
    } else {
        $parentDir = Split-Path $configPath -Parent
        if (-not (Test-Path $parentDir)) { New-Item -ItemType Directory -Path $parentDir -Force | Out-Null }
        Get-McpConfig | Set-Content $configPath -Encoding UTF8
    }
}

# ── IDE configurations ──

function Configure-ClaudeDesktop {
    Write-Host "  [INFO] Configuring Claude Desktop..." -ForegroundColor Blue
    $configPath = "$env:APPDATA\Claude\claude_desktop_config.json"
    Merge-McpConfig $configPath
    Write-Host "  [OK] Claude Desktop configured ($configPath)" -ForegroundColor Green
    Write-Host "  [WARN] Restart Claude Desktop to activate" -ForegroundColor Yellow
}

function Configure-ClaudeCode {
    Write-Host "  [INFO] Configuring Claude Code..." -ForegroundColor Blue
    if (Get-Command claude -ErrorAction SilentlyContinue) {
        claude mcp add webcake-cms `
            -e WEBCAKE_API_URL="$script:ApiUrl" `
            -e WEBCAKE_TOKEN="$script:Token" `
            -e WEBCAKE_SITE_ID="$script:SiteId" `
            -- "$script:NodeBin" "$script:McpIndex"
        Write-Host "  [OK] Claude Code configured (via CLI)" -ForegroundColor Green
    } else {
        $configPath = "$env:USERPROFILE\.claude.json"
        Merge-McpConfig $configPath
        Write-Host "  [OK] Claude Code configured ($configPath)" -ForegroundColor Green
    }
}

function Configure-Cursor {
    Write-Host "  [INFO] Configuring Cursor..." -ForegroundColor Blue
    $configPath = "$env:USERPROFILE\.cursor\mcp.json"
    Merge-McpConfig $configPath
    Write-Host "  [OK] Cursor configured ($configPath)" -ForegroundColor Green
}

function Configure-Windsurf {
    Write-Host "  [INFO] Configuring Windsurf..." -ForegroundColor Blue
    $configPath = "$env:USERPROFILE\.codeium\windsurf\mcp_config.json"
    Merge-McpConfig $configPath
    Write-Host "  [OK] Windsurf configured ($configPath)" -ForegroundColor Green
}

function Configure-Augment {
    Write-Host "  [INFO] Configuring Augment (VS Code)..." -ForegroundColor Blue
    $vscodePath = "$env:APPDATA\Code\User"
    if (-not (Test-Path $vscodePath)) { $vscodePath = "$env:USERPROFILE\.vscode" }
    $configPath = "$vscodePath\augment_mcp.json"
    Merge-McpConfig $configPath
    Write-Host "  [OK] Augment configured ($configPath)" -ForegroundColor Green
    Write-Host "  [WARN] Open VS Code > Ctrl+Shift+P > 'Augment: Edit MCP Settings'" -ForegroundColor Yellow
}

# ── IDE Selection ──

function Select-Ides {
    Write-Host ""
    Write-Host "  -- Select IDE/Tool to configure --" -ForegroundColor White
    Write-Host ""
    Write-Host "  1) Claude Desktop"
    Write-Host "  2) Claude Code (CLI)"
    Write-Host "  3) Cursor"
    Write-Host "  4) Windsurf"
    Write-Host "  5) Augment (VS Code)"
    Write-Host "  6) All of the above"
    Write-Host "  0) Skip"
    Write-Host ""
    $choices = Read-Host "  Choose (comma-separated, e.g. 1,2)"

    foreach ($choice in ($choices -split ',')) {
        switch ($choice.Trim()) {
            "1" { Configure-ClaudeDesktop }
            "2" { Configure-ClaudeCode }
            "3" { Configure-Cursor }
            "4" { Configure-Windsurf }
            "5" { Configure-Augment }
            "6" {
                Configure-ClaudeDesktop
                Configure-ClaudeCode
                Configure-Cursor
                Configure-Windsurf
                Configure-Augment
            }
            "0" { Write-Host "  [INFO] Skipping IDE configuration." -ForegroundColor Blue }
            default { Write-Host "  [WARN] Unknown option: $choice" -ForegroundColor Yellow }
        }
    }
}

# ── Uninstall ──

function Uninstall {
    Write-Host ""
    Write-Host "  -- Uninstall WebCake CMS MCP --" -ForegroundColor White
    Write-Host ""

    if (Test-Path $DEFAULT_DIR) {
        $confirm = Read-Host "  Remove $DEFAULT_DIR? (y/N)"
        if ($confirm -match '^[Yy]$') {
            Remove-Item -Recurse -Force $DEFAULT_DIR
            Write-Host "  [OK] Removed $DEFAULT_DIR" -ForegroundColor Green
        }
    }

    if (Get-Command claude -ErrorAction SilentlyContinue) {
        claude mcp remove webcake-cms 2>$null
        Write-Host "  [OK] Removed from Claude Code" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "  [OK] Uninstall complete. Restart your IDEs." -ForegroundColor Green
}

# ── Main ──

if ($args -contains "--uninstall" -or $args -contains "uninstall") {
    Uninstall
    exit 0
}

Check-Node
Install-Mcp
Collect-Env
Select-Ides

Write-Host ""
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  Next steps:"
Write-Host "  1. Restart your IDE"
Write-Host "  2. Start a conversation and use CMS tools"
Write-Host ""
