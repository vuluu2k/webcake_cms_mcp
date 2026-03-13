# BuilderX CMS MCP Server

MCP server cung cap cac tinh nang CMS cua BuilderX cho AI agent su dung.

## Cai dat

```bash
git clone https://github.com/vuluu2k/webcake_cms_mcp.git
cd webcake_cms_mcp
npm install
```

## Bien moi truong

| Bien | Mo ta |
|------|-------|
| `BUILDERX_API_URL` | URL goc cua BuilderX API (vd: `https://api.storecake.io`) |
| `BUILDERX_TOKEN` | JWT Bearer token (xac thuc dashboard) |
| `BUILDERX_SITE_ID` | ID cua site can thao tac |

> CMS admin token va CMS API key duoc tu dong lay qua API khi can (khong can cau hinh thu cong).

---

## Cau hinh theo tung IDE / AI Tool

> Thay `/duong-dan-tuyet-doi/webcake_cms_mcp/index.js` bang duong dan thuc te noi ban da clone repo.
> Vi du: `/Users/username/webcake_cms_mcp/index.js`

### 1. Claude Code (CLI)

Chay lenh sau trong terminal:

```bash
claude mcp add builderx-cms \
  -e BUILDERX_API_URL=https://api.storecake.io \
  -e BUILDERX_TOKEN=<token-cua-ban> \
  -e BUILDERX_SITE_ID=<site-id-cua-ban> \
  -- node /duong-dan-tuyet-doi/webcake_cms_mcp/index.js
```

Hoac tao file `.claude.json` tai thu muc project:

```json
{
  "mcpServers": {
    "builderx-cms": {
      "command": "node",
      "args": ["/duong-dan-tuyet-doi/webcake_cms_mcp/index.js"],
      "env": {
        "BUILDERX_API_URL": "https://api.storecake.io",
        "BUILDERX_TOKEN": "<token-cua-ban>",
        "BUILDERX_SITE_ID": "<site-id-cua-ban>",
      }
    }
  }
}
```

Hoac cau hinh global tai `~/.claude.json` (ap dung cho moi project).

Kiem tra da cai thanh cong:
```bash
claude mcp list
```

---

### 2. Cursor

**Buoc 1:** Mo Cursor Settings: `Cmd + ,` (Mac) hoac `Ctrl + ,` (Windows/Linux)

**Buoc 2:** Tim muc **"MCP Servers"** trong sidebar ben trai

**Buoc 3:** Click **"Add new MCP Server"**

**Buoc 4:** Tao file `.cursor/mcp.json` tai thu muc goc project voi noi dung:

```json
{
  "mcpServers": {
    "builderx-cms": {
      "command": "node",
      "args": ["/duong-dan-tuyet-doi/webcake_cms_mcp/index.js"],
      "env": {
        "BUILDERX_API_URL": "https://api.storecake.io",
        "BUILDERX_TOKEN": "<token-cua-ban>",
        "BUILDERX_SITE_ID": "<site-id-cua-ban>",
      }
    }
  }
}
```

Hoac cau hinh global tai `~/.cursor/mcp.json`.

**Buoc 5:** Restart Cursor. Kiem tra trong Settings > MCP Servers — se thay trang thai **"Connected"** mau xanh.

---

### 3. Windsurf

**Buoc 1:** Mo Windsurf Settings: `Cmd + ,` (Mac) hoac `Ctrl + ,` (Windows/Linux)

**Buoc 2:** Tim muc **"Cascade"** > **"MCP Servers"**

**Buoc 3:** Click **"Add Server"** > chon **"Custom"**

**Buoc 4:** Tao file `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "builderx-cms": {
      "command": "node",
      "args": ["/duong-dan-tuyet-doi/webcake_cms_mcp/index.js"],
      "env": {
        "BUILDERX_API_URL": "https://api.storecake.io",
        "BUILDERX_TOKEN": "<token-cua-ban>",
        "BUILDERX_SITE_ID": "<site-id-cua-ban>",
      }
    }
  }
}
```

**Buoc 5:** Restart Windsurf. Trong Cascade chat, go `@` se thay cac tools cua `builderx-cms`.

---

### 4. Augment (VS Code Extension)

**Buoc 1:** Cai extension **Augment** tu VS Code Marketplace

**Buoc 2:** Mo Command Palette: `Cmd + Shift + P` > tim **"Augment: Edit MCP Settings"**

**Buoc 3:** File settings se mo ra. Them cau hinh:

```json
{
  "mcpServers": {
    "builderx-cms": {
      "command": "node",
      "args": ["/duong-dan-tuyet-doi/webcake_cms_mcp/index.js"],
      "env": {
        "BUILDERX_API_URL": "https://api.storecake.io",
        "BUILDERX_TOKEN": "<token-cua-ban>",
        "BUILDERX_SITE_ID": "<site-id-cua-ban>",
      }
    }
  }
}
```

**Buoc 4:** Restart VS Code. Trong Augment chat panel se thay cac tools MCP.

---

## Luu y quan trong

### Lay token va site_id
1. Dang nhap dashboard BuilderX
2. Mo DevTools (F12) > tab Network
3. Tim bat ky API request nao > copy header `Authorization: Bearer <token>`
4. `site_id` nam trong URL: `/api/v1/dashboard/site/{site_id}/...`

### Kiem tra MCP hoat dong
Sau khi cau hinh, thu hoi AI agent:
```
Liet ke tat ca CMS files cua site
```
Neu tra ve danh sach files → MCP da hoat dong.

---

## Danh sach cong cu

### Quan ly CMS Files
- `list_cms_files` - Liet ke tat ca CMS files
- `create_cms_file` - Tao HTTP function / cron job / file mac dinh
- `update_cms_file` - Cap nhat noi dung file
- `get_http_function` - Lay file HTTP function chinh
- `update_http_function` - Tao/cap nhat HTTP function
- `run_function` - Chay mot function da trien khai
- `debug_function` - Chay code o che do debug
- `save_file_version` - Luu phien ban file
- `get_file_versions` - Xem lich su phien ban
- `toggle_debug_render` - Bat/tat che do debug

### Quan ly trang (Pages)
- `list_pages` - Liet ke tat ca trang
- `create_page` - Tao trang moi
- `update_page` - Cap nhat thuoc tinh trang
- `update_page_custom_code` - Viet CSS/JS custom code cho trang
- `delete_page` - Xoa trang
- `get_page_versions` - Lich su phien ban trang
- `list_page_contents` - Noi dung da ngon ngu
- `update_page_content` - Cap nhat noi dung theo ngon ngu
- `list_global_sections` - Liet ke cac section dung chung

### Bai viet Blog
- `list_articles` - Liet ke bai viet co loc
- `get_article` - Lay bai viet theo ID
- `create_article` - Tao bai viet
- `update_article` - Cap nhat bai viet
- `delete_article` - Xoa bai viet

### Khach hang
- `find_customer` - Tim theo ID, so dien thoai, hoac email

### Tu dong hoa
- `send_mail` - Gui email qua CMS automation
