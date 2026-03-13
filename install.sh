#!/bin/bash

# ═══════════════════════════════════════════════════════════
#  BuilderX CMS MCP Server - Auto Installer
#  Supports: Claude Code, Cursor, Windsurf, Augment
#
#  Usage:
#    Interactive:  ./install.sh
#    Via curl:     curl -fsSL <url>/install.sh | bash -s -- --token YOUR_TOKEN --site-id YOUR_SITE_ID
#    With IDE:     ./install.sh --token XX --site-id YY --ide claude
#    Uninstall:    ./install.sh --uninstall
# ═══════════════════════════════════════════════════════════

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# ── Detect if stdin is a terminal (interactive) or pipe ──
IS_INTERACTIVE=false
if [ -t 0 ]; then
  IS_INTERACTIVE=true
fi

# ── Parse CLI arguments ──
ARG_API_URL=""
ARG_TOKEN=""
ARG_SITE_ID=""
ARG_IDE=""
ARG_INSTALL_DIR=""
ARG_UNINSTALL=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-url)     ARG_API_URL="$2"; shift 2 ;;
    --token)       ARG_TOKEN="$2"; shift 2 ;;
    --site-id)     ARG_SITE_ID="$2"; shift 2 ;;
    --ide)         ARG_IDE="$2"; shift 2 ;;
    --dir)         ARG_INSTALL_DIR="$2"; shift 2 ;;
    --uninstall)   ARG_UNINSTALL=true; shift ;;
    *)             shift ;;
  esac
done

print_banner() {
  echo ""
  echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║${NC}  ${BOLD}BuilderX CMS MCP Server - Installer${NC}             ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}  Supports: Claude Code, Cursor, Windsurf, Augment${CYAN}║${NC}"
  echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
  echo ""
}

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; }

# Prompt user only if interactive, otherwise use default/error
prompt_input() {
  local prompt_msg="$1"
  local default_val="$2"
  local var_name="$3"
  local required="$4"  # "required" or ""

  if [ "$IS_INTERACTIVE" = true ]; then
    if [ -n "$default_val" ]; then
      read -rp "  $prompt_msg [$default_val]: " INPUT
      INPUT="${INPUT:-$default_val}"
    else
      read -rp "  $prompt_msg: " INPUT
    fi
    eval "$var_name=\"\$INPUT\""
  else
    if [ -n "$default_val" ]; then
      eval "$var_name=\"$default_val\""
    elif [ "$required" = "required" ]; then
      error "$var_name is required. Use --$(echo "$var_name" | tr '[:upper:]' '[:lower:]' | tr '_' '-') <value>"
      echo ""
      echo "Usage:"
      echo "  curl -fsSL <url>/install.sh | bash -s -- --token YOUR_TOKEN --site-id YOUR_SITE_ID"
      echo ""
      echo "Options:"
      echo "  --api-url URL     API URL (default: https://api.storecake.io)"
      echo "  --token TOKEN     JWT Bearer token (required)"
      echo "  --site-id ID      Site ID (required)"
      echo "  --ide IDE         IDE to configure: claude, cursor, windsurf, augment, all"
      echo "  --dir PATH        Install directory (default: ~/.builderx-cms-mcp)"
      echo ""
      exit 1
    fi
  fi
}

# ── Check prerequisites ──

check_node() {
  if ! command -v node &> /dev/null; then
    error "Node.js is not installed."
    echo ""
    echo "Install Node.js:"
    echo "  macOS:   brew install node"
    echo "  Ubuntu:  sudo apt install nodejs npm"
    echo "  Or:      https://nodejs.org/"
    echo ""
    exit 1
  fi

  NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VERSION" -lt 18 ]; then
    error "Node.js >= 18 required. Current: $(node -v)"
    exit 1
  fi
  success "Node.js $(node -v) detected"
}

check_npm() {
  if ! command -v npm &> /dev/null; then
    error "npm is not installed."
    exit 1
  fi
  success "npm $(npm -v) detected"
}

# ── Install MCP server ──

REPO_URL="https://github.com/vuluu2k/webcake_cms_mcp.git"
DEFAULT_INSTALL_DIR="$HOME/.builderx-cms-mcp"

install_mcp() {
  echo ""

  # Use CLI arg or prompt
  if [ -n "$ARG_INSTALL_DIR" ]; then
    INSTALL_DIR="$ARG_INSTALL_DIR"
  elif [ "$IS_INTERACTIVE" = true ]; then
    info "Where to install the MCP server?"
    echo -e "  Default: ${BOLD}$DEFAULT_INSTALL_DIR${NC}"
    read -rp "  Install path (Enter for default): " INSTALL_DIR
    INSTALL_DIR="${INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
  else
    INSTALL_DIR="$DEFAULT_INSTALL_DIR"
    info "Installing to $INSTALL_DIR"
  fi

  # Expand ~ if user typed it
  INSTALL_DIR="${INSTALL_DIR/#\~/$HOME}"

  if [ -d "$INSTALL_DIR" ] && [ -f "$INSTALL_DIR/index.js" ]; then
    success "MCP server already exists at $INSTALL_DIR"

    if [ "$IS_INTERACTIVE" = true ]; then
      read -rp "  Update to latest version? (y/N): " UPDATE
    else
      UPDATE="y"
      info "Auto-updating to latest version..."
    fi

    if [[ "$UPDATE" =~ ^[Yy]$ ]]; then
      info "Updating..."
      cd "$INSTALL_DIR"
      git pull origin main 2>/dev/null || git pull 2>/dev/null || warn "Git pull failed, continuing with existing version"
      npm install --production
      success "Updated successfully"
      cd - > /dev/null
    fi
  else
    info "Cloning repository..."
    if command -v git &> /dev/null; then
      git clone "$REPO_URL" "$INSTALL_DIR"
    else
      warn "git not found. Downloading via npm instead..."
      mkdir -p "$INSTALL_DIR"
      # Fallback: copy from current directory if running from repo
      SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
      if [ -f "$SCRIPT_DIR/index.js" ]; then
        cp "$SCRIPT_DIR/index.js" "$INSTALL_DIR/"
        cp "$SCRIPT_DIR/api.js" "$INSTALL_DIR/"
        cp "$SCRIPT_DIR/package.json" "$INSTALL_DIR/"
      else
        error "Cannot install without git. Please install git first."
        exit 1
      fi
    fi

    info "Installing dependencies..."
    cd "$INSTALL_DIR"
    npm install --production
    cd - > /dev/null
    success "MCP server installed at $INSTALL_DIR"
  fi

  MCP_INDEX="$INSTALL_DIR/index.js"
}

# ── Collect environment variables ──

collect_env() {
  echo ""
  echo -e "${BOLD}── Environment Configuration ──${NC}"
  echo ""

  # API URL
  API_URL="${ARG_API_URL:-}"
  if [ -z "$API_URL" ]; then
    prompt_input "BUILDERX_API_URL" "https://api.storecake.io" API_URL ""
  fi
  API_URL="${API_URL:-https://api.storecake.io}"

  # Token
  TOKEN="${ARG_TOKEN:-}"
  if [ -z "$TOKEN" ]; then
    if [ "$IS_INTERACTIVE" = true ]; then
      while [ -z "$TOKEN" ]; do
        read -rp "  BUILDERX_TOKEN (JWT token): " TOKEN
        if [ -z "$TOKEN" ]; then
          warn "Token is required. Get it from BuilderX dashboard."
        fi
      done
    else
      error "Token is required. Use: --token YOUR_TOKEN"
      echo ""
      print_usage
      exit 1
    fi
  fi

  # Site ID
  SITE_ID="${ARG_SITE_ID:-}"
  if [ -z "$SITE_ID" ]; then
    if [ "$IS_INTERACTIVE" = true ]; then
      while [ -z "$SITE_ID" ]; do
        read -rp "  BUILDERX_SITE_ID: " SITE_ID
        if [ -z "$SITE_ID" ]; then
          warn "Site ID is required."
        fi
      done
    else
      error "Site ID is required. Use: --site-id YOUR_SITE_ID"
      echo ""
      print_usage
      exit 1
    fi
  fi

  echo ""
  success "Configuration:"
  echo "  API URL : $API_URL"
  echo "  Token   : ${TOKEN:0:20}..."
  echo "  Site ID : $SITE_ID"
}

print_usage() {
  echo "Usage:"
  echo "  Interactive:  ./install.sh"
  echo "  Non-interactive:"
  echo "    curl -fsSL <url>/install.sh | bash -s -- --token TOKEN --site-id SITE_ID [options]"
  echo ""
  echo "Options:"
  echo "  --api-url URL     API URL (default: https://api.storecake.io)"
  echo "  --token TOKEN     JWT Bearer token (required)"
  echo "  --site-id ID      Site ID (required)"
  echo "  --ide IDE         IDE to configure: claude, cursor, windsurf, augment, all (default: all)"
  echo "  --dir PATH        Install directory (default: ~/.builderx-cms-mcp)"
  echo "  --uninstall       Remove MCP server and IDE configs"
}

# ── IDE Configuration ──

configure_claude_code() {
  info "Configuring Claude Code..."

  if command -v claude &> /dev/null; then
    claude mcp add builderx-cms \
      -e BUILDERX_API_URL="$API_URL" \
      -e BUILDERX_TOKEN="$TOKEN" \
      -e BUILDERX_SITE_ID="$SITE_ID" \
      -- node "$MCP_INDEX"
    success "Claude Code configured (via CLI)"
  else
    # Fallback: write to ~/.claude.json
    CLAUDE_CONFIG="$HOME/.claude.json"
    if [ -f "$CLAUDE_CONFIG" ] && [ -s "$CLAUDE_CONFIG" ]; then
      # Use node to merge config
      node -e "
        const fs = require('fs');
        const config = JSON.parse(fs.readFileSync('$CLAUDE_CONFIG', 'utf8'));
        if (!config.mcpServers) config.mcpServers = {};
        config.mcpServers['builderx-cms'] = {
          command: 'node',
          args: ['$MCP_INDEX'],
          env: {
            BUILDERX_API_URL: '$API_URL',
            BUILDERX_TOKEN: '$TOKEN',
            BUILDERX_SITE_ID: '$SITE_ID'
          }
        };
        fs.writeFileSync('$CLAUDE_CONFIG', JSON.stringify(config, null, 2));
      "
    else
      write_claude_config
    fi
    success "Claude Code configured ($CLAUDE_CONFIG)"
  fi
}

write_claude_config() {
  CLAUDE_CONFIG="$HOME/.claude.json"
  cat > "$CLAUDE_CONFIG" << JSONEOF
{
  "mcpServers": {
    "builderx-cms": {
      "command": "node",
      "args": ["$MCP_INDEX"],
      "env": {
        "BUILDERX_API_URL": "$API_URL",
        "BUILDERX_TOKEN": "$TOKEN",
        "BUILDERX_SITE_ID": "$SITE_ID"
      }
    }
  }
}
JSONEOF
}

configure_cursor() {
  info "Configuring Cursor..."

  CURSOR_DIR="$HOME/.cursor"
  mkdir -p "$CURSOR_DIR"
  CURSOR_CONFIG="$CURSOR_DIR/mcp.json"

  if [ -f "$CURSOR_CONFIG" ] && [ -s "$CURSOR_CONFIG" ]; then
    node -e "
      const fs = require('fs');
      const config = JSON.parse(fs.readFileSync('$CURSOR_CONFIG', 'utf8'));
      if (!config.mcpServers) config.mcpServers = {};
      config.mcpServers['builderx-cms'] = {
        command: 'node',
        args: ['$MCP_INDEX'],
        env: {
          BUILDERX_API_URL: '$API_URL',
          BUILDERX_TOKEN: '$TOKEN',
          BUILDERX_SITE_ID: '$SITE_ID'
        }
      };
      fs.writeFileSync('$CURSOR_CONFIG', JSON.stringify(config, null, 2));
    "
  else
    cat > "$CURSOR_CONFIG" << JSONEOF
{
  "mcpServers": {
    "builderx-cms": {
      "command": "node",
      "args": ["$MCP_INDEX"],
      "env": {
        "BUILDERX_API_URL": "$API_URL",
        "BUILDERX_TOKEN": "$TOKEN",
        "BUILDERX_SITE_ID": "$SITE_ID"
      }
    }
  }
}
JSONEOF
  fi

  success "Cursor configured ($CURSOR_CONFIG)"
}

configure_windsurf() {
  info "Configuring Windsurf..."

  WINDSURF_DIR="$HOME/.codeium/windsurf"
  mkdir -p "$WINDSURF_DIR"
  WINDSURF_CONFIG="$WINDSURF_DIR/mcp_config.json"

  if [ -f "$WINDSURF_CONFIG" ] && [ -s "$WINDSURF_CONFIG" ]; then
    node -e "
      const fs = require('fs');
      const config = JSON.parse(fs.readFileSync('$WINDSURF_CONFIG', 'utf8'));
      if (!config.mcpServers) config.mcpServers = {};
      config.mcpServers['builderx-cms'] = {
        command: 'node',
        args: ['$MCP_INDEX'],
        env: {
          BUILDERX_API_URL: '$API_URL',
          BUILDERX_TOKEN: '$TOKEN',
          BUILDERX_SITE_ID: '$SITE_ID'
        }
      };
      fs.writeFileSync('$WINDSURF_CONFIG', JSON.stringify(config, null, 2));
    "
  else
    cat > "$WINDSURF_CONFIG" << JSONEOF
{
  "mcpServers": {
    "builderx-cms": {
      "command": "node",
      "args": ["$MCP_INDEX"],
      "env": {
        "BUILDERX_API_URL": "$API_URL",
        "BUILDERX_TOKEN": "$TOKEN",
        "BUILDERX_SITE_ID": "$SITE_ID"
      }
    }
  }
}
JSONEOF
  fi

  success "Windsurf configured ($WINDSURF_CONFIG)"
}

configure_augment() {
  info "Configuring Augment (VS Code)..."

  # Augment uses VS Code settings
  VSCODE_DIR="$HOME/.vscode"
  if [ -d "$HOME/Library/Application Support/Code/User" ]; then
    VSCODE_DIR="$HOME/Library/Application Support/Code/User"
  elif [ -d "$HOME/.config/Code/User" ]; then
    VSCODE_DIR="$HOME/.config/Code/User"
  fi

  AUGMENT_CONFIG="$VSCODE_DIR/augment_mcp.json"
  mkdir -p "$VSCODE_DIR"

  cat > "$AUGMENT_CONFIG" << JSONEOF
{
  "mcpServers": {
    "builderx-cms": {
      "command": "node",
      "args": ["$MCP_INDEX"],
      "env": {
        "BUILDERX_API_URL": "$API_URL",
        "BUILDERX_TOKEN": "$TOKEN",
        "BUILDERX_SITE_ID": "$SITE_ID"
      }
    }
  }
}
JSONEOF

  success "Augment config written to $AUGMENT_CONFIG"
  warn "Open VS Code > Cmd+Shift+P > 'Augment: Edit MCP Settings' and paste the config above"
}

# ── IDE Selection ──

select_ides() {
  # If IDE specified via CLI arg
  if [ -n "$ARG_IDE" ]; then
    apply_ide_choice "$ARG_IDE"
    return
  fi

  # Non-interactive: default to all
  if [ "$IS_INTERACTIVE" = false ]; then
    info "Configuring all IDEs (use --ide to select specific ones)"
    configure_claude_code
    configure_cursor
    configure_windsurf
    configure_augment
    return
  fi

  # Interactive menu
  echo ""
  echo -e "${BOLD}── Select IDE/Tool to configure ──${NC}"
  echo ""
  echo "  1) Claude Code"
  echo "  2) Cursor"
  echo "  3) Windsurf"
  echo "  4) Augment (VS Code)"
  echo "  5) All of the above"
  echo "  0) Skip (manual setup later)"
  echo ""
  read -rp "  Choose (comma-separated, e.g. 1,2): " IDE_CHOICE

  IFS=',' read -ra CHOICES <<< "$IDE_CHOICE"

  for choice in "${CHOICES[@]}"; do
    choice=$(echo "$choice" | tr -d ' ')
    case "$choice" in
      1) configure_claude_code ;;
      2) configure_cursor ;;
      3) configure_windsurf ;;
      4) configure_augment ;;
      5)
        configure_claude_code
        configure_cursor
        configure_windsurf
        configure_augment
        ;;
      0) info "Skipping IDE configuration." ;;
      *) warn "Unknown option: $choice" ;;
    esac
  done
}

apply_ide_choice() {
  local ide="$1"
  case "$ide" in
    claude)   configure_claude_code ;;
    cursor)   configure_cursor ;;
    windsurf) configure_windsurf ;;
    augment)  configure_augment ;;
    all)
      configure_claude_code
      configure_cursor
      configure_windsurf
      configure_augment
      ;;
    *)
      warn "Unknown IDE: $ide. Options: claude, cursor, windsurf, augment, all"
      ;;
  esac
}

# ── Verify installation ──

verify() {
  echo ""
  info "Verifying installation..."

  if node -e "import('$MCP_INDEX')" 2>/dev/null; then
    success "MCP server module loads correctly"
  else
    # Quick syntax check
    node --check "$MCP_INDEX" 2>/dev/null && success "MCP server syntax OK" || warn "Could not verify module (may need env vars to run)"
  fi
}

# ── Print summary ──

print_summary() {
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}${BOLD}  Installation Complete!${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "  MCP Server : ${BOLD}$MCP_INDEX${NC}"
  echo -e "  API URL    : $API_URL"
  echo -e "  Site ID    : $SITE_ID"
  echo ""
  echo -e "  ${BOLD}Next steps:${NC}"
  echo "  1. Restart your IDE"
  echo "  2. Start a conversation and use CMS tools"
  echo ""
  echo -e "  ${BOLD}Test (Claude Code):${NC}"
  echo "    claude mcp list"
  echo ""
  echo -e "  ${BOLD}Manual run:${NC}"
  echo "    BUILDERX_API_URL=$API_URL \\"
  echo "    BUILDERX_TOKEN=<token> \\"
  echo "    BUILDERX_SITE_ID=$SITE_ID \\"
  echo "    node $MCP_INDEX"
  echo ""
}

# ── Uninstall ──

uninstall() {
  print_banner
  echo -e "${BOLD}── Uninstall BuilderX CMS MCP ──${NC}"
  echo ""

  # Remove installed directory
  if [ -d "$DEFAULT_INSTALL_DIR" ]; then
    if [ "$IS_INTERACTIVE" = true ]; then
      read -rp "  Remove $DEFAULT_INSTALL_DIR? (y/N): " CONFIRM
    else
      CONFIRM="y"
    fi
    if [[ "$CONFIRM" =~ ^[Yy]$ ]]; then
      rm -rf "$DEFAULT_INSTALL_DIR"
      success "Removed $DEFAULT_INSTALL_DIR"
    fi
  fi

  # Remove Claude Code config
  if command -v claude &> /dev/null; then
    claude mcp remove builderx-cms 2>/dev/null && success "Removed from Claude Code" || true
  fi

  # Remove from Cursor
  if [ -f "$HOME/.cursor/mcp.json" ]; then
    node -e "
      const fs = require('fs');
      const f = '$HOME/.cursor/mcp.json';
      const c = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (c.mcpServers) delete c.mcpServers['builderx-cms'];
      fs.writeFileSync(f, JSON.stringify(c, null, 2));
    " 2>/dev/null && success "Removed from Cursor config" || true
  fi

  echo ""
  success "Uninstall complete. Restart your IDEs."
}

# ── Main ──

main() {
  print_banner

  # Handle --uninstall flag
  if [ "$ARG_UNINSTALL" = true ]; then
    uninstall
    exit 0
  fi

  check_node
  check_npm

  install_mcp
  collect_env
  select_ides
  verify
  print_summary
}

main
