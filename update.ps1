# ═══════════════════════════════════════════════════════════
#  WebCake CMS MCP Server - Updater (Windows PowerShell)
# ═══════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"

$DEFAULT_DIR = "$env:USERPROFILE\.webcake-cms-mcp"

Write-Host ""
Write-Host "  WebCake CMS MCP Server - Updater" -ForegroundColor Cyan
Write-Host ""

# ── Determine install directory ──

$InstallDir = if ($args.Count -gt 0) { $args[0] } else { "" }

if (-not $InstallDir) {
    if ((Test-Path "$DEFAULT_DIR\index.js")) {
        $InstallDir = $DEFAULT_DIR
    } elseif ((Test-Path ".\index.js") -and (Test-Path ".\api.js")) {
        $InstallDir = (Get-Location).Path
    } else {
        Write-Host "  [ERROR] Could not find MCP server installation." -ForegroundColor Red
        Write-Host ""
        Write-Host "  Usage: .\update.ps1 [install-path]"
        Write-Host "  Example: .\update.ps1 $DEFAULT_DIR"
        Write-Host ""
        exit 1
    }
}

if (-not (Test-Path "$InstallDir\index.js")) {
    Write-Host "  [ERROR] No MCP server found at $InstallDir" -ForegroundColor Red
    exit 1
}

Write-Host "  [INFO] MCP server found at $InstallDir" -ForegroundColor Blue

# ── Pull latest changes ──

Push-Location $InstallDir

if (Test-Path ".git") {
    $currentCommit = git rev-parse --short HEAD 2>$null
    Write-Host "  [INFO] Current version: $currentCommit" -ForegroundColor Blue

    # Check for local modifications
    $dirty = git diff --quiet 2>$null; $isDirty = $LASTEXITCODE -ne 0

    if ($isDirty) {
        Write-Host "  [WARN] Local modifications detected" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  1) Stash changes and update"
        Write-Host "  2) Force update (discard local changes)"
        Write-Host "  3) Cancel"
        Write-Host ""
        $choice = Read-Host "  Choose [1]"
        if (-not $choice) { $choice = "1" }

        switch ($choice) {
            "1" {
                git stash
                Write-Host "  [OK] Changes stashed (restore with: git stash pop)" -ForegroundColor Green
            }
            "2" {
                git checkout .
                Write-Host "  [OK] Local changes discarded" -ForegroundColor Green
            }
            "3" {
                Write-Host "  [INFO] Update cancelled." -ForegroundColor Blue
                Pop-Location
                exit 0
            }
            default {
                Write-Host "  [ERROR] Invalid choice" -ForegroundColor Red
                Pop-Location
                exit 1
            }
        }
    }

    Write-Host "  [INFO] Pulling latest changes..." -ForegroundColor Blue
    git pull origin main 2>$null
    if ($LASTEXITCODE -ne 0) { git pull 2>$null }

    $newCommit = git rev-parse --short HEAD 2>$null

    if ($currentCommit -eq $newCommit) {
        Write-Host "  [OK] Already up to date ($newCommit)" -ForegroundColor Green
    } else {
        Write-Host "  [OK] Updated: $currentCommit -> $newCommit" -ForegroundColor Green
        Write-Host ""
        Write-Host "  [INFO] Changes:" -ForegroundColor Blue
        git log --oneline "$currentCommit..$newCommit" 2>$null | Select-Object -First 20 | ForEach-Object {
            Write-Host "    $_"
        }
    }
} else {
    Write-Host "  [WARN] Not a git repo - cannot pull updates." -ForegroundColor Yellow
    Write-Host "  To enable updates, re-install from git:"
    Write-Host "  git clone https://github.com/vuluu2k/webcake_cms_mcp.git $InstallDir"
    Pop-Location
    exit 1
}

# ── Reinstall dependencies ──

Write-Host "  [INFO] Installing dependencies..." -ForegroundColor Blue
npm install --production 2>$null
Write-Host "  [OK] Dependencies updated" -ForegroundColor Green

# ── Verify ──

Write-Host "  [INFO] Verifying..." -ForegroundColor Blue
node --check "$InstallDir\index.js" 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK] Syntax OK" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Syntax check failed" -ForegroundColor Yellow
}

Pop-Location

# ── Done ──

Write-Host ""
Write-Host "  Update Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  Restart your IDE to use the new version." -ForegroundColor White
Write-Host ""
