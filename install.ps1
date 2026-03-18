# ═══════════════════════════════════════════════════════════
#  WebCake CMS MCP Server - Installer (Windows PowerShell)
#  Supports: Claude Desktop, Claude Code, Cursor, Windsurf, Augment, Codex
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

    Write-Host "  How to get token & session_id:" -ForegroundColor Yellow
    Write-Host "    1. Login to WebCake/StoreCake dashboard"
    Write-Host "    2. Open DevTools (F12) > Network tab"
    Write-Host "    3. Click any page, find an API request"
    Write-Host "    4. Copy 'Authorization: Bearer ...' header value -> token"
    Write-Host "    5. Copy 'x-session-id' header value -> session_id"
    Write-Host ""

    $script:ApiUrl = Read-Host "  WEBCAKE_API_URL [https://api.storecake.io]"
    if (-not $script:ApiUrl) { $script:ApiUrl = "https://api.storecake.io" }

    $script:Token = Read-Host "  WEBCAKE_TOKEN (JWT token, Enter to skip)"
    $script:SessionId = Read-Host "  WEBCAKE_SESSION_ID (x-session-id, Enter to skip)"
    $script:SiteId = Read-Host "  WEBCAKE_SITE_ID (Enter to skip - choose later via AI)"

    Write-Host ""
    Write-Host "  [OK] Configuration:" -ForegroundColor Green
    Write-Host "  API URL    : $script:ApiUrl"
    
    if ($script:Token) {
        Write-Host "  Token      : $($script:Token.Substring(0, [Math]::Min(20, $script:Token.Length)))..."
    } else {
        Write-Host "  Token      : (not set - use update_auth tool later)" -ForegroundColor Yellow
    }
    
    if ($script:SessionId) {
        Write-Host "  Session ID : $($script:SessionId.Substring(0, [Math]::Min(12, $script:SessionId.Length)))..."
    } else {
        Write-Host "  Session ID : (not set - use update_auth tool later)" -ForegroundColor Yellow
    }
    
    if ($script:SiteId) {
        Write-Host "  Site ID    : $script:SiteId"
    } else {
        Write-Host "  Site ID    : (not set - use switch_site tool later)" -ForegroundColor Yellow
    }
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
        "WEBCAKE_SESSION_ID": "$script:SessionId",
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
            WEBCAKE_SESSION_ID = $script:SessionId
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
            -e WEBCAKE_SESSION_ID="$script:SessionId" `
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

function Configure-Codex {
    Write-Host "  [INFO] Configuring Codex (OpenAI)..." -ForegroundColor Blue
    $codexDir = "$env:USERPROFILE\.codex"
    $configPath = "$codexDir\config.toml"
    if (-not (Test-Path $codexDir)) { New-Item -ItemType Directory -Path $codexDir -Force | Out-Null }

    $tomlBlock = @"

[mcp_servers.webcake-cms]
command = "$($script:NodeBin -replace '\\', '/')"
args = ["$($script:McpIndex -replace '\\', '/')"]
env = { "WEBCAKE_API_URL" = "$script:ApiUrl", "WEBCAKE_TOKEN" = "$script:Token", "WEBCAKE_SESSION_ID" = "$script:SessionId", "WEBCAKE_SITE_ID" = "$script:SiteId" }
"@

    if ((Test-Path $configPath) -and (Get-Item $configPath).Length -gt 0) {
        $content = Get-Content $configPath -Raw
        if ($content -match '\[mcp_servers\.webcake-cms\]') {
            # Remove existing block
            $content = $content -replace '(?s)\n?\[mcp_servers\.webcake-cms\].*?(?=\n\[|$)', ''
            $content = $content.TrimEnd() + "`n"
        }
        $content += $tomlBlock
        Set-Content $configPath -Value $content -Encoding UTF8
    } else {
        "# WebCake CMS MCP Server`n$tomlBlock" | Set-Content $configPath -Encoding UTF8
    }

    Write-Host "  [OK] Codex configured ($configPath)" -ForegroundColor Green
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
    Write-Host "  6) Codex (OpenAI)"
    Write-Host "  7) All of the above"
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
            "6" { Configure-Codex }
            "7" {
                Configure-ClaudeDesktop
                Configure-ClaudeCode
                Configure-Cursor
                Configure-Windsurf
                Configure-Augment
                Configure-Codex
            }
            "0" { Write-Host "  [INFO] Skipping IDE configuration." -ForegroundColor Blue }
            default { Write-Host "  [WARN] Unknown option: $choice" -ForegroundColor Yellow }
        }
    }
}

# ── Verify installation ──

function Verify-Installation {
    Write-Host ""
    Write-Host "  [INFO] Verifying installation..." -ForegroundColor Blue
    try {
        node --check "$script:McpIndex" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  [OK] MCP server syntax OK" -ForegroundColor Green
        } else {
            Write-Host "  [WARN] Could not verify module" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  [WARN] Could not verify module" -ForegroundColor Yellow
    }
}

# ── Print summary ──

function Print-Summary {
    Write-Host ""
    Write-Host "  ═══════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "    Installation Complete!" -ForegroundColor Green
    Write-Host "  ═══════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Node.js    : $script:NodeBin"
    Write-Host "  MCP Server : $script:McpIndex"
    Write-Host "  API URL    : $script:ApiUrl"
    if ($script:SiteId) {
        Write-Host "  Site ID    : $script:SiteId"
    }
    Write-Host ""
    Write-Host "  Next steps:"
    Write-Host "  1. Restart your IDE"
    Write-Host "  2. Start a conversation and use CMS tools"

    if (-not $script:Token -or -not $script:SessionId) {
        Write-Host ""
        Write-Host "  Credentials not fully set. In your first chat, ask the AI:" -ForegroundColor Yellow
        Write-Host "    `"Update auth with token=... session_id=...`""
        Write-Host "    (get from browser DevTools > Network > any API request headers)"
    }

    if (-not $script:SiteId) {
        Write-Host ""
        Write-Host "  Site not set. In your first chat, ask the AI:" -ForegroundColor Yellow
        Write-Host "    `"List my sites`" then `"Switch to site <name>`""
    }

    Write-Host ""
    Write-Host "  Test (Claude Code):"
    Write-Host "    claude mcp list"
    Write-Host ""
    Write-Host "  Manual run:"
    Write-Host "    `$env:WEBCAKE_API_URL=`"$script:ApiUrl`""
    Write-Host "    `$env:WEBCAKE_TOKEN=`"<token>`""
    Write-Host "    `$env:WEBCAKE_SESSION_ID=`"<session_id>`""
    Write-Host "    & `"$script:NodeBin`" `"$script:McpIndex`""
    Write-Host ""
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
Verify-Installation
Print-Summary
