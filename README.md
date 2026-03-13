# BuilderX CMS MCP Server

MCP server exposing BuilderX CMS features for AI agents.

## Setup

```bash
git clone https://github.com/vuluu2k/webcake_cms_mcp.git
cd webcake_cms_mcp
npm install
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `BUILDERX_API_URL` | BuilderX API base URL (e.g. `https://api.storecake.io`) |
| `BUILDERX_TOKEN` | JWT Bearer token (dashboard auth) |
| `BUILDERX_SITE_ID` | Target site ID |

> CMS admin token and CMS API key are automatically fetched via API when needed (no manual config required).

---

## Configuration by IDE / AI Tool

> Replace `/absolute-path/webcake_cms_mcp/index.js` below with the actual path where you cloned the repo.
> Example: `/Users/username/webcake_cms_mcp/index.js`

### 1. Claude Code (CLI)

Run in terminal:

```bash
claude mcp add builderx-cms \
  -e BUILDERX_API_URL=https://api.storecake.io \
  -e BUILDERX_TOKEN=<your-token> \
  -e BUILDERX_SITE_ID=<your-site-id> \
  -- node /absolute-path/webcake_cms_mcp/index.js
```

Or create `.claude.json` at project root:

```json
{
  "mcpServers": {
    "builderx-cms": {
      "command": "node",
      "args": ["/absolute-path/webcake_cms_mcp/index.js"],
      "env": {
        "BUILDERX_API_URL": "https://api.storecake.io",
        "BUILDERX_TOKEN": "<your-token>",
        "BUILDERX_SITE_ID": "<your-site-id>",
      }
    }
  }
}
```

Or configure globally at `~/.claude.json`.

Verify:
```bash
claude mcp list
```

---

### 2. Cursor

Create `.cursor/mcp.json` at project root:

```json
{
  "mcpServers": {
    "builderx-cms": {
      "command": "node",
      "args": ["/absolute-path/webcake_cms_mcp/index.js"],
      "env": {
        "BUILDERX_API_URL": "https://api.storecake.io",
        "BUILDERX_TOKEN": "<your-token>",
        "BUILDERX_SITE_ID": "<your-site-id>",
      }
    }
  }
}
```

Or global config at `~/.cursor/mcp.json`. Restart Cursor and check Settings > MCP Servers for **"Connected"** status.

---

### 3. Windsurf

Create `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "builderx-cms": {
      "command": "node",
      "args": ["/absolute-path/webcake_cms_mcp/index.js"],
      "env": {
        "BUILDERX_API_URL": "https://api.storecake.io",
        "BUILDERX_TOKEN": "<your-token>",
        "BUILDERX_SITE_ID": "<your-site-id>",
      }
    }
  }
}
```

Restart Windsurf. Type `@` in Cascade chat to see `builderx-cms` tools.

---

### 4. Augment (VS Code Extension)

Open Command Palette: `Cmd + Shift + P` > **"Augment: Edit MCP Settings"**, then add:

```json
{
  "mcpServers": {
    "builderx-cms": {
      "command": "node",
      "args": ["/absolute-path/webcake_cms_mcp/index.js"],
      "env": {
        "BUILDERX_API_URL": "https://api.storecake.io",
        "BUILDERX_TOKEN": "<your-token>",
        "BUILDERX_SITE_ID": "<your-site-id>",
      }
    }
  }
}
```

Restart VS Code.

---

## Available Tools

### CMS Files
- `list_cms_files` - List all CMS files
- `create_cms_file` - Create HTTP function / cron job / default file
- `update_cms_file` - Update file content
- `get_http_function` - Get main HTTP function file
- `update_http_function` - Create/update HTTP function
- `run_function` - Execute a deployed function
- `debug_function` - Run code in debug mode
- `save_file_version` - Save version snapshot
- `get_file_versions` - Get version history
- `toggle_debug_render` - Toggle debug mode

### Pages
- `list_pages` - List all pages
- `create_page` - Create a page
- `update_page` - Update page properties
- `update_page_custom_code` - Write CSS/JS custom code for a page
- `delete_page` - Delete a page
- `get_page_versions` - Page version history
- `list_page_contents` - Multi-language contents
- `update_page_content` - Update content for a language
- `list_global_sections` - List reusable sections

### Blog Articles
- `list_articles` - List articles with filtering
- `get_article` - Get article by ID
- `create_article` - Create article
- `update_article` - Update article
- `delete_article` - Delete article

### Customers
- `find_customer` - Find by ID, phone, or email

### Automation
- `send_mail` - Send email via CMS automation
