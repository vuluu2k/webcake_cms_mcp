# BuilderX CMS MCP Server

MCP server cung cấp các tính năng CMS của BuilderX cho AI agent sử dụng.

## Cài đặt

```bash
cd mcp/cms
npm install
```

## Biến môi trường

| Biến | Mô tả |
|------|-------|
| `BUILDERX_API_URL` | URL gốc của BuilderX API (vd: `http://localhost:4000`) |
| `BUILDERX_TOKEN` | JWT Bearer token (xác thực dashboard) hoặc CMS admin token |
| `BUILDERX_SITE_ID` | ID của site cần thao tác |

## Cấu hình Claude Code

Thêm vào `.claude.json` hoặc cài đặt MCP của Claude Code:

```json
{
  "mcpServers": {
    "builderx-cms": {
      "command": "node",
      "args": ["mcp/cms/index.js"],
      "env": {
        "BUILDERX_API_URL": "http://localhost:4000",
        "BUILDERX_TOKEN": "<token-của-bạn>",
        "BUILDERX_SITE_ID": "<site-id-của-bạn>"
      }
    }
  }
}
```

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
