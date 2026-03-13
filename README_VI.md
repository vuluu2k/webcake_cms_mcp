**🌐 [English](README.md)** | Tiếng Việt

# WebCake CMS MCP Server

MCP server cung cấp các tính năng CMS của WebCake cho AI agent sử dụng.

## Cài đặt nhanh (Khuyên dùng)

Chạy script tự động — tự clone, cài dependencies, cấu hình IDE cho bạn.

**Cách A — Tương tác** (script sẽ hỏi từng bước):

```bash
# Nếu đã clone repo
./install.sh

# Hoặc tải về rồi chạy
curl -fsSL https://raw.githubusercontent.com/vuluu2k/webcake_cms_mcp/main/install.sh -o install.sh && bash install.sh
```

**Cách B — Không tương tác** (chạy qua `curl` pipe hoặc CI):

```bash
curl -fsSL https://raw.githubusercontent.com/vuluu2k/webcake_cms_mcp/main/install.sh | bash -s -- \
  --token TOKEN_CUA_BAN \
  --site-id SITE_ID_CUA_BAN
```

**Danh sách flags:**

| Flag | Mô tả | Mặc định |
|------|--------|----------|
| `--token TOKEN` | JWT Bearer token | *(bắt buộc)* |
| `--site-id ID` | ID của site | *(bắt buộc)* |
| `--api-url URL` | URL API | `https://api.storecake.io` |
| `--ide IDE` | IDE cần cấu hình: `claude-desktop`, `claude`, `cursor`, `windsurf`, `augment`, `all` | `all` |
| `--dir PATH` | Thư mục cài đặt | `~/.webcake-cms-mcp` |
| `--uninstall` | Gỡ MCP server và config IDE | — |

**Ví dụ:**

```bash
# Cài và chỉ cấu hình Claude Code
curl -fsSL .../install.sh | bash -s -- --token abc123 --site-id site_xyz --ide claude

# Cài và cấu hình Cursor + Windsurf
./install.sh --token abc123 --site-id site_xyz --ide cursor
./install.sh --token abc123 --site-id site_xyz --ide windsurf

# Gỡ cài đặt
./install.sh --uninstall
```

---

## Cài đặt thủ công

```bash
git clone https://github.com/vuluu2k/webcake_cms_mcp.git
cd webcake_cms_mcp
npm install
```

## Biến môi trường

| Biến | Mô tả |
|------|-------|
| `WEBCAKE_API_URL` | URL gốc của WebCake API (vd: `https://api.storecake.io`) |
| `WEBCAKE_TOKEN` | JWT Bearer token (xác thực dashboard) |
| `WEBCAKE_SITE_ID` | ID của site cần thao tác |

> CMS admin token và CMS API key được tự động lấy qua API khi cần (không cần cấu hình thủ công).

### Cách lấy `WEBCAKE_TOKEN` và `WEBCAKE_SITE_ID`

1. Mở [WebCake Dashboard](https://storecake.io) và đăng nhập
2. Mở DevTools (`F12` hoặc `Cmd + Option + I`)
3. Vào tab **Application** > **Cookies** > `https://storecake.io`
4. Tìm cookie tên `token` — copy giá trị → đây là `WEBCAKE_TOKEN`
5. `WEBCAKE_SITE_ID` nằm trong URL dashboard: `https://storecake.io/site/{site_id}/...`

---

## Cấu hình theo từng IDE / AI Tool

> Thay `/đường-dẫn-tuyệt-đối/webcake_cms_mcp/index.js` bằng đường dẫn thực tế nơi bạn đã clone repo.
> Ví dụ: `/Users/username/webcake_cms_mcp/index.js`

### 1. Claude Desktop

Mở Settings > Developer > Edit Config, hoặc sửa file trực tiếp:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "webcake-cms": {
      "command": "node",
      "args": ["/đường-dẫn-tuyệt-đối/webcake_cms_mcp/index.js"],
      "env": {
        "WEBCAKE_API_URL": "https://api.storecake.io",
        "WEBCAKE_TOKEN": "<token-của-bạn>",
        "WEBCAKE_SITE_ID": "<site-id-của-bạn>"
      }
    }
  }
}
```

Restart Claude Desktop. Các MCP tools sẽ xuất hiện trong chat input (icon búa).

---

### 2. Claude Code (CLI)

Chạy lệnh sau trong terminal:

```bash
claude mcp add webcake-cms \
  -e WEBCAKE_API_URL=https://api.storecake.io \
  -e WEBCAKE_TOKEN=<token-của-bạn> \
  -e WEBCAKE_SITE_ID=<site-id-của-bạn> \
  -- node /đường-dẫn-tuyệt-đối/webcake_cms_mcp/index.js
```

Hoặc tạo file `.claude.json` tại thư mục project:

```json
{
  "mcpServers": {
    "webcake-cms": {
      "command": "node",
      "args": ["/đường-dẫn-tuyệt-đối/webcake_cms_mcp/index.js"],
      "env": {
        "WEBCAKE_API_URL": "https://api.storecake.io",
        "WEBCAKE_TOKEN": "<token-của-bạn>",
        "WEBCAKE_SITE_ID": "<site-id-của-bạn>"
      }
    }
  }
}
```

Hoặc cấu hình global tại `~/.claude.json` (áp dụng cho mọi project).

Kiểm tra đã cài thành công:
```bash
claude mcp list
```

---

### 3. Cursor

**Bước 1:** Mở Cursor Settings: `Cmd + ,` (Mac) hoặc `Ctrl + ,` (Windows/Linux)

**Bước 2:** Tìm mục **"MCP Servers"** trong sidebar bên trái

**Bước 3:** Click **"Add new MCP Server"**

**Bước 4:** Tạo file `.cursor/mcp.json` tại thư mục gốc project với nội dung:

```json
{
  "mcpServers": {
    "webcake-cms": {
      "command": "node",
      "args": ["/đường-dẫn-tuyệt-đối/webcake_cms_mcp/index.js"],
      "env": {
        "WEBCAKE_API_URL": "https://api.storecake.io",
        "WEBCAKE_TOKEN": "<token-của-bạn>",
        "WEBCAKE_SITE_ID": "<site-id-của-bạn>"
      }
    }
  }
}
```

Hoặc cấu hình global tại `~/.cursor/mcp.json`.

**Bước 5:** Restart Cursor. Kiểm tra trong Settings > MCP Servers — sẽ thấy trạng thái **"Connected"** màu xanh.

---

### 4. Windsurf

**Bước 1:** Mở Windsurf Settings: `Cmd + ,` (Mac) hoặc `Ctrl + ,` (Windows/Linux)

**Bước 2:** Tìm mục **"Cascade"** > **"MCP Servers"**

**Bước 3:** Click **"Add Server"** > chọn **"Custom"**

**Bước 4:** Tạo file `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "webcake-cms": {
      "command": "node",
      "args": ["/đường-dẫn-tuyệt-đối/webcake_cms_mcp/index.js"],
      "env": {
        "WEBCAKE_API_URL": "https://api.storecake.io",
        "WEBCAKE_TOKEN": "<token-của-bạn>",
        "WEBCAKE_SITE_ID": "<site-id-của-bạn>"
      }
    }
  }
}
```

**Bước 5:** Restart Windsurf. Trong Cascade chat, gõ `@` sẽ thấy các tools của `webcake-cms`.

---

### 5. Augment (VS Code Extension)

**Bước 1:** Cài extension **Augment** từ VS Code Marketplace

**Bước 2:** Mở Command Palette: `Cmd + Shift + P` > tìm **"Augment: Edit MCP Settings"**

**Bước 3:** File settings sẽ mở ra. Thêm cấu hình:

```json
{
  "mcpServers": {
    "webcake-cms": {
      "command": "node",
      "args": ["/đường-dẫn-tuyệt-đối/webcake_cms_mcp/index.js"],
      "env": {
        "WEBCAKE_API_URL": "https://api.storecake.io",
        "WEBCAKE_TOKEN": "<token-của-bạn>",
        "WEBCAKE_SITE_ID": "<site-id-của-bạn>"
      }
    }
  }
}
```

**Bước 4:** Restart VS Code. Trong Augment chat panel sẽ thấy các tools MCP.

---

## Lưu ý quan trọng

### Lấy token và site_id
1. Đăng nhập dashboard WebCake
2. Mở DevTools (F12) > tab Network
3. Tìm bất kỳ API request nào > copy header `Authorization: Bearer <token>`
4. `site_id` nằm trong URL: `/api/v1/dashboard/site/{site_id}/...`

### Kiểm tra MCP hoạt động
Sau khi cấu hình, thử hỏi AI agent:
```
Liệt kê tất cả CMS files của site
```
Nếu trả về danh sách files → MCP đã hoạt động.

---

## Ví dụ sử dụng

### Ví dụ 1: Viết HTTP function backend + gọi từ frontend

**Prompt:**
```
Tạo tính năng đăng ký nhận newsletter. Backend lưu email vào collection "subscribers",
frontend có form nhập email gọi lên backend.
```

**AI agent sẽ tự động thực hiện:**

**Bước 1** — Gọi `get_http_function` để đọc code hiện tại

**Bước 2** — Gọi `update_http_function` để thêm function mới:

```javascript
import { DBConnection } from 'webcake-data';
const db = new DBConnection();
const Subscriber = db.model('subscribers');

export const post_Subscribe = async (request) => {
  const { email } = request.params;
  if (!email) return { error: 'Email là bắt buộc' };

  const exists = await Subscriber.exists({ email });
  if (exists) return { error: 'Email đã đăng ký' };

  await Subscriber.create({ email, subscribed_at: new Date() });
  return { success: true, message: 'Đăng ký thành công!' };
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

**Bước 3** — Gọi `update_site_custom_code` để thêm code frontend:

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
    window.useNotification('error', { title: 'Lỗi', message: err.message });
  }
});
```

---

### Ví dụ 2: Viết loạt bài blog

**Prompt:**
```
Viết 3 bài blog về chăm sóc da mùa hè, mỗi bài 300 từ, có slug tiếng Việt không dấu.
```

**AI agent gọi `create_article` 3 lần:**

```
create_article({
  name: "5 bước chăm sóc da mùa hè",
  slug: "5-buoc-cham-soc-da-mua-he",
  content: "<h2>...</h2><p>...</p>",
  tags: ["skincare", "mùa hè"]
})

create_article({
  name: "Chống nắng đúng cách",
  slug: "chong-nang-dung-cach",
  content: "<h2>...</h2><p>...</p>",
  tags: ["skincare", "chống nắng"]
})

create_article({
  name: "Dưỡng ẩm cho da dầu",
  slug: "duong-am-cho-da-dau",
  content: "<h2>...</h2><p>...</p>",
  tags: ["skincare", "dưỡng ẩm"]
})
```

---

### Ví dụ 3: Debug và test function

**Prompt:**
```
Test thử function get_Subscribers xem có chạy được không
```

**AI agent gọi:**
```
run_function({
  function_name: "Subscribers",
  method: "GET",
  params: { page: 1, limit: 5 }
})
```

Trả về kết quả hoặc lỗi, AI agent đọc và giải thích cho developer.

---

### Ví dụ 4: Thêm custom CSS cho site

**Prompt:**
```
Thêm hiệu ứng hover cho tất cả product card: nổi lên nhẹ và có bóng đổ.
```

**AI agent gọi `update_site_custom_code`:**

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

### Ví dụ 5: Tìm khách hàng và gửi email

**Prompt:**
```
Tìm khách hàng có email john@example.com rồi gửi email cảm ơn đã mua hàng.
```

**AI agent gọi 2 tools:**

```
find_customer({ by: "email", value: "john@example.com" })
→ Tìm thấy: { name: "John Doe", email: "john@example.com" }

send_mail({
  to: "john@example.com",
  subject: "Cảm ơn bạn đã mua hàng!",
  body: "<h2>Xin chào John Doe,</h2><p>Cảm ơn bạn đã mua hàng tại cửa hàng của chúng tôi...</p>"
})
```

---

## Danh sách công cụ

### Quản lý CMS Files
- `list_cms_files` - Liệt kê tất cả CMS files
- `create_cms_file` - Tạo HTTP function / cron job / file mặc định
- `update_cms_file` - Cập nhật nội dung file
- `get_http_function` - Lấy file HTTP function chính
- `update_http_function` - Tạo/cập nhật HTTP function
- `run_function` - Chạy một function đã triển khai
- `debug_function` - Chạy code ở chế độ debug
- `save_file_version` - Lưu phiên bản file
- `get_file_versions` - Xem lịch sử phiên bản
- `toggle_debug_render` - Bật/tắt chế độ debug

### Quản lý trang (Pages)
- `list_pages` - Liệt kê tất cả trang
- `create_page` - Tạo trang mới
- `update_page` - Cập nhật thuộc tính trang
- `update_site_custom_code` - Viết CSS/JS custom code cho toàn bộ site
- `delete_page` - Xóa trang
- `get_page_versions` - Lịch sử phiên bản trang
- `list_page_contents` - Nội dung đa ngôn ngữ
- `update_page_content` - Cập nhật nội dung theo ngôn ngữ
- `list_global_sections` - Liệt kê các section dùng chung

### Bài viết Blog
- `list_articles` - Liệt kê bài viết có lọc
- `get_article` - Lấy bài viết theo ID
- `create_article` - Tạo bài viết
- `update_article` - Cập nhật bài viết
- `delete_article` - Xóa bài viết

### Khách hàng
- `find_customer` - Tìm theo ID, số điện thoại, hoặc email

### Tự động hóa
- `send_mail` - Gửi email qua CMS automation
