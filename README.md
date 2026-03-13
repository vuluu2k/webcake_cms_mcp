# BuilderX CMS MCP Server

MCP server exposing BuilderX CMS features for AI agents.

## Quick Install (Recommended)

Run the auto-install script — it handles everything: clone, install dependencies, configure your IDE.

**Option A — Interactive** (prompts for input):

```bash
# If you already cloned the repo
./install.sh

# Or download and run
curl -fsSL https://raw.githubusercontent.com/vuluu2k/webcake_cms_mcp/main/install.sh -o install.sh && bash install.sh
```

**Option B — Non-interactive** (via `curl` pipe or CI):

```bash
curl -fsSL https://raw.githubusercontent.com/vuluu2k/webcake_cms_mcp/main/install.sh | bash -s -- \
  --token YOUR_TOKEN \
  --site-id YOUR_SITE_ID
```

**All flags:**

| Flag | Description | Default |
|------|-------------|---------|
| `--token TOKEN` | JWT Bearer token | *(required)* |
| `--site-id ID` | Target site ID | *(required)* |
| `--api-url URL` | API base URL | `https://api.storecake.io` |
| `--ide IDE` | IDE to configure: `claude-desktop`, `claude`, `cursor`, `windsurf`, `augment`, `all` | `all` |
| `--dir PATH` | Install directory | `~/.builderx-cms-mcp` |
| `--uninstall` | Remove MCP server and IDE configs | — |

**Examples:**

```bash
# Install and configure only Claude Code
curl -fsSL .../install.sh | bash -s -- --token abc123 --site-id site_xyz --ide claude

# Install and configure Cursor + Windsurf
./install.sh --token abc123 --site-id site_xyz --ide cursor
./install.sh --token abc123 --site-id site_xyz --ide windsurf

# Uninstall
./install.sh --uninstall
```

---

## Manual Setup

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

### 1. Claude Desktop

Open Settings > Developer > Edit Config, or edit the file directly:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "builderx-cms": {
      "command": "node",
      "args": ["/absolute-path/webcake_cms_mcp/index.js"],
      "env": {
        "BUILDERX_API_URL": "https://api.storecake.io",
        "BUILDERX_TOKEN": "<your-token>",
        "BUILDERX_SITE_ID": "<your-site-id>"
      }
    }
  }
}
```

Restart Claude Desktop. The MCP tools will appear in the chat input (hammer icon).

---

### 2. Claude Code (CLI)

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

### 3. Cursor

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

### 4. Windsurf

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

### 5. Augment (VS Code Extension)

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

## Usage Examples

### Example 1: Write backend HTTP function + frontend integration

**Prompt:**
```
Create a newsletter subscription feature. Backend saves email to "subscribers" collection,
frontend calls the backend function.
```

**AI agent will automatically:**

**Step 1** — Call `get_http_function` to read current code

**Step 2** — Call `update_http_function` to add new functions:

```javascript
import { DBConnection } from 'webcake-data';
const db = new DBConnection();
const Subscriber = db.model('subscribers');

export const post_Subscribe = async (request) => {
  const { email } = request.params;
  if (!email) return { error: 'Email is required' };

  const exists = await Subscriber.exists({ email });
  if (exists) return { error: 'Already subscribed' };

  await Subscriber.create({ email, subscribed_at: new Date() });
  return { success: true, message: 'Subscribed successfully!' };
}

export const get_Subscribers = async (request) => {
  const { page = 1, limit = 20 } = request.params;
  const data = await Subscriber.find()
    .sort({ subscribed_at: -1 })
    .limit(limit)
    .skip((page - 1) * limit)
    .exec();
  const total = await Subscriber.countDocuments();
  return { data, total, page };
}
```

**Step 3** — Call `update_site_custom_code` to add frontend code:

`code_before_head`:
```html
<script src="https://cdn.jsdelivr.net/npm/webcake-fn/dist/webcake-fn.umd.min.js"></script>
```

`code_custom_javascript`:
```javascript
document.getElementById('newsletter-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('newsletter-email').value;
  try {
    const result = await api.post_Subscribe({ email });
    if (result.success) {
      window.useNotification('success', { title: result.message });
    } else {
      window.useNotification('error', { title: result.error });
    }
  } catch (err) {
    window.useNotification('error', { title: 'Error', message: err.message });
  }
});
```

---

### Example 2: Batch create blog articles

**Prompt:**
```
Write 3 blog posts about summer skincare, each 300 words, with SEO-friendly slugs.
```

**AI agent calls `create_article` 3 times:**

```
create_article({
  name: "5 Steps for Summer Skincare",
  slug: "5-steps-summer-skincare",
  content: "<h2>...</h2><p>...</p>",
  tags: ["skincare", "summer"]
})

create_article({
  name: "Sun Protection Done Right",
  slug: "sun-protection-done-right",
  content: "<h2>...</h2><p>...</p>",
  tags: ["skincare", "sunscreen"]
})

create_article({
  name: "Moisturizing Oily Skin",
  slug: "moisturizing-oily-skin",
  content: "<h2>...</h2><p>...</p>",
  tags: ["skincare", "moisturizer"]
})
```

---

### Example 3: Debug and test a function

**Prompt:**
```
Test the get_Subscribers function to see if it works
```

**AI agent calls:**
```
run_function({
  function_name: "Subscribers",
  method: "GET",
  params: { page: 1, limit: 5 }
})
```

Returns the result or error, AI agent reads and explains to the developer.

---

### Example 4: Add custom CSS

**Prompt:**
```
Add hover effect to all product cards: slight lift with drop shadow.
```

**AI agent calls `update_site_custom_code`:**

`code_custom_css`:
```css
.product-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.product-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
}
```

---

### Example 5: Find customer and send email

**Prompt:**
```
Find the customer with email john@example.com and send a thank-you email.
```

**AI agent calls 2 tools:**

```
find_customer({ by: "email", value: "john@example.com" })
→ Found: { name: "John Doe", email: "john@example.com" }

send_mail({
  to: "john@example.com",
  subject: "Thank you for your purchase!",
  body: "<h2>Hi John Doe,</h2><p>Thank you for shopping with us...</p>"
})
```

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
- `update_site_custom_code` - Write CSS/JS custom code for the entire site
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
