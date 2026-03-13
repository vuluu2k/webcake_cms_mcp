#!/bin/bash

# ═══════════════════════════════════════════════════════════
#  BuilderX CMS MCP Server - Auto Installer
#  Supports: Claude Desktop, Claude Code, Cursor, Windsurf, Augment
# ═══════════════════════════════════════════════════════════

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

print_banner() {
  echo ""
  echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║${NC}  ${BOLD}BuilderX CMS MCP Server - Installer${NC}             ${CYAN}║${NC}"
  echo -e "${CYAN}║${NC}  Claude Desktop, Claude Code, Cursor, Windsurf...${CYAN}║${NC}"
  echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
  echo ""
}

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; }

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
  info "Where to install the MCP server?"
  echo -e "  Default: ${BOLD}$DEFAULT_INSTALL_DIR${NC}"
  read -rp "  Install path (Enter for default): " INSTALL_DIR
  INSTALL_DIR="${INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"

  # Expand ~ if user typed it
  INSTALL_DIR="${INSTALL_DIR/#\~/$HOME}"

  if [ -d "$INSTALL_DIR" ] && [ -f "$INSTALL_DIR/index.js" ]; then
    success "MCP server already exists at $INSTALL_DIR"
    read -rp "  Update to latest version? (y/N): " UPDATE
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
  read -rp "  BUILDERX_API_URL [https://api.storecake.io]: " API_URL
  API_URL="${API_URL:-https://api.storecake.io}"

  # Token
  while [ -z "$TOKEN" ]; do
    read -rp "  BUILDERX_TOKEN (JWT token): " TOKEN
    if [ -z "$TOKEN" ]; then
      warn "Token is required. Get it from BuilderX dashboard."
    fi
  done

  # Site ID
  while [ -z "$SITE_ID" ]; do
    read -rp "  BUILDERX_SITE_ID: " SITE_ID
    if [ -z "$SITE_ID" ]; then
      warn "Site ID is required."
    fi
  done

  echo ""
  success "Configuration:"
  echo "  API URL : $API_URL"
  echo "  Token   : ${TOKEN:0:20}..."
  echo "  Site ID : $SITE_ID"
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
    if [ -f "$CLAUDE_CONFIG" ]; then
      # Check if file has content
      if [ -s "$CLAUDE_CONFIG" ]; then
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
    else
      write_claude_config
    fi
    success "Claude Code configured ($CLAUDE_CONFIG)"
  fi
}

write_claude_config() {
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

configure_claude_desktop() {
  info "Configuring Claude Desktop..."

  # macOS
  CLAUDE_DESKTOP_DIR="$HOME/Library/Application Support/Claude"
  # Linux
  if [ ! -d "$CLAUDE_DESKTOP_DIR" ]; then
    CLAUDE_DESKTOP_DIR="$HOME/.config/Claude"
  fi

  mkdir -p "$CLAUDE_DESKTOP_DIR"
  CLAUDE_DESKTOP_CONFIG="$CLAUDE_DESKTOP_DIR/claude_desktop_config.json"

  if [ -f "$CLAUDE_DESKTOP_CONFIG" ] && [ -s "$CLAUDE_DESKTOP_CONFIG" ]; then
    node -e "
      const fs = require('fs');
      const config = JSON.parse(fs.readFileSync('$CLAUDE_DESKTOP_CONFIG', 'utf8'));
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
      fs.writeFileSync('$CLAUDE_DESKTOP_CONFIG', JSON.stringify(config, null, 2));
    "
  else
    cat > "$CLAUDE_DESKTOP_CONFIG" << JSONEOF
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

  success "Claude Desktop configured ($CLAUDE_DESKTOP_CONFIG)"
  warn "Restart Claude Desktop to activate"
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

# ── IDE Selection Menu ──

select_ides() {
  echo ""
  echo -e "${BOLD}── Select IDE/Tool to configure ──${NC}"
  echo ""
  echo "  1) Claude Desktop"
  echo "  2) Claude Code (CLI)"
  echo "  3) Cursor"
  echo "  4) Windsurf"
  echo "  5) Augment (VS Code)"
  echo "  6) All of the above"
  echo "  0) Skip (manual setup later)"
  echo ""
  read -rp "  Choose (comma-separated, e.g. 1,2): " IDE_CHOICE

  IFS=',' read -ra CHOICES <<< "$IDE_CHOICE"

  for choice in "${CHOICES[@]}"; do
    choice=$(echo "$choice" | tr -d ' ')
    case "$choice" in
      1) configure_claude_desktop ;;
      2) configure_claude_code ;;
      3) configure_cursor ;;
      4) configure_windsurf ;;
      5) configure_augment ;;
      6)
        configure_claude_desktop
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
    read -rp "  Remove $DEFAULT_INSTALL_DIR? (y/N): " CONFIRM
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
  if [ "${1:-}" = "--uninstall" ] || [ "${1:-}" = "uninstall" ]; then
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

main "$@"
