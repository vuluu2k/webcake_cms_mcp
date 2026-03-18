# ═══════════════════════════════════════════════════════════
#  WebCake CMS MCP Server - Updater (Windows PowerShell)
# ═══════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"

$DEFAULT_DIR = "$env:USERPROFILE\.webcake-cms-mcp"

Write-Host ""
Write-Host "  ══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "    WebCake CMS MCP Server - Updater" -ForegroundColor White
Write-Host "  ══════════════════════════════════════════════════" -ForegroundColor Cyan
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

# ── Save current version info ──

Push-Location $InstallDir

$currentCommit = ""
if (Test-Path ".git") {
    $currentCommit = (git rev-parse --short HEAD 2>$null) | Out-String
    $currentCommit = $currentCommit.Trim()
    if (-not $currentCommit) { $currentCommit = "unknown" }
    Write-Host "  [INFO] Current version: $currentCommit" -ForegroundColor Blue
}

# ── Pull latest changes ──

if (Test-Path ".git") {
    Write-Host "  [INFO] Pulling latest changes..." -ForegroundColor Blue

    # Check for local modifications
    # git diff --quiet exits non-zero when dirty — must not throw
    $saveEAP = $ErrorActionPreference; $ErrorActionPreference = "SilentlyContinue"
    git diff --quiet 2>$null
    $isDirty = $LASTEXITCODE -ne 0
    $ErrorActionPreference = $saveEAP

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

    # Fetch first to ensure we have latest remote refs
    Write-Host "  [INFO] Fetching from remote..." -ForegroundColor Blue
    $fetchOutput = git fetch origin 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERROR] git fetch failed:" -ForegroundColor Red
        Write-Host $fetchOutput
        Pop-Location
        exit 1
    }

    # Pull with visible output so errors are not swallowed
    $pullOutput = git pull origin main 2>&1 | Out-String
    $pullExitCode = $LASTEXITCODE
    if ($pullExitCode -ne 0) {
        Write-Host "  [WARN] 'git pull origin main' failed, trying 'git pull'..." -ForegroundColor Yellow
        Write-Host $pullOutput
        $pullOutput = git pull 2>&1 | Out-String
        $pullExitCode = $LASTEXITCODE
    }
    if ($pullExitCode -ne 0) {
        Write-Host "  [ERROR] git pull failed:" -ForegroundColor Red
        Write-Host $pullOutput
        Pop-Location
        exit 1
    }

    $newCommit = (git rev-parse --short HEAD 2>$null) | Out-String
    $newCommit = $newCommit.Trim()
    if (-not $newCommit) { $newCommit = "unknown" }

    if ($currentCommit -eq $newCommit) {
        Write-Host "  [OK] Already up to date ($newCommit)" -ForegroundColor Green
    } else {
        Write-Host "  [OK] Updated: $currentCommit -> $newCommit" -ForegroundColor Green

        if ($currentCommit -ne "unknown" -and $newCommit -ne "unknown") {
            Write-Host ""
            Write-Host "  [INFO] Changes:" -ForegroundColor Blue
            git log --oneline "$currentCommit..$newCommit" 2>$null | Select-Object -First 20 | ForEach-Object {
                Write-Host "    $_"
            }
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
$saveEAP = $ErrorActionPreference; $ErrorActionPreference = "SilentlyContinue"
npm install --production 2>$null | Select-Object -Last 1
$ErrorActionPreference = $saveEAP
Write-Host "  [OK] Dependencies updated" -ForegroundColor Green

# ── Verify ──

Write-Host "  [INFO] Verifying..." -ForegroundColor Blue
$saveEAP = $ErrorActionPreference; $ErrorActionPreference = "SilentlyContinue"
node --check "$InstallDir\index.js" 2>$null
$checkOk = $LASTEXITCODE -eq 0
$ErrorActionPreference = $saveEAP

if ($checkOk) {
    Write-Host "  [OK] Syntax OK" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Syntax check failed" -ForegroundColor Yellow
}

Pop-Location

# ── Done ──

Write-Host ""
Write-Host "  ══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "    Update Complete!" -ForegroundColor Green
Write-Host "  ══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Restart your IDE to use the new version." -ForegroundColor White
Write-Host ""
