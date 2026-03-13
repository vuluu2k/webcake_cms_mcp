# BuilderX CMS MCP Server

MCP server exposing BuilderX CMS features for AI agents.

## Setup

```bash
cd mcp/cms
npm install
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `BUILDERX_API_URL` | BuilderX API base URL (e.g. `https://api.storecake.io`) |
| `BUILDERX_TOKEN` | JWT Bearer token (dashboard auth) or CMS admin token |
| `BUILDERX_SITE_ID` | Target site ID |
| `BUILDERX_CMS_API_KEY` | CMS API key (required for deploying functions to bundle service) |

## Claude Code Configuration

Add to `.claude.json` or Claude Code MCP settings:

```json
{
  "mcpServers": {
    "builderx-cms": {
      "command": "node",
      "args": ["mcp/cms/index.js"],
      "env": {
        "BUILDERX_API_URL": "https://api.storecake.io",
        "BUILDERX_TOKEN": "<your-token>",
        "BUILDERX_SITE_ID": "<your-site-id>",
        "BUILDERX_CMS_API_KEY": "<your-cms-api-key>"
      }
    }
  }
}
```

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
