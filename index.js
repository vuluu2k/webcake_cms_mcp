#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { BuilderxCmsApi } from "./api.js";

const BASE_URL = process.env.BUILDERX_API_URL;
const TOKEN = process.env.BUILDERX_TOKEN;
const SITE_ID = process.env.BUILDERX_SITE_ID;

if (!BASE_URL || !TOKEN || !SITE_ID) {
  console.error("Required env vars: BUILDERX_API_URL, BUILDERX_TOKEN, BUILDERX_SITE_ID");
  process.exit(1);
}

const api = new BuilderxCmsApi({ baseUrl: BASE_URL, token: TOKEN, siteId: SITE_ID });
const server = new McpServer({
  name: "builderx-cms",
  version: "1.0.0",
});

function result(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

async function handle(fn) {
  try {
    return result(await fn());
  } catch (e) {
    return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
  }
}

// ═══════════════════════════════════════════
// Prompts — dạy AI cách viết code CMS
// ═══════════════════════════════════════════

server.prompt(
  "http_function_guide",
  "Hướng dẫn cách viết HTTP function trong BuilderX CMS",
  () => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `# Hướng dẫn viết HTTP Function trong BuilderX CMS

## Cú pháp

File http_function chứa các hàm backend JavaScript. Mỗi hàm được export theo format:

\`\`\`javascript
export const [method]_[FunctionName] = (request) => {
  // code
  return result;
}
\`\`\`

## Quy tắc đặt tên
- Method: viết thường (get, post, put, patch, delete)
- FunctionName: PascalCase
- Ví dụ: get_Products, post_CreateOrder, put_UpdateUser, delete_RemoveItem

## Request object

\`\`\`javascript
export const get_Example = (request) => {
  request.params    // Object - query params hoặc body params
  request.customer  // Object - thông tin customer đang đăng nhập
                    //   { id, name, email, first_name, last_name, phone_number, avatar }
  request.account   // Object - thông tin account (admin)
                    //   { id, name, email, first_name, last_name, phone_number, avatar }
  request.data      // Object - toàn bộ request params (bao gồm query string)
}
\`\`\`

## Gọi API function

Sau khi deploy, function được gọi qua:
\`\`\`
GET/POST/PUT/PATCH /api/v1/{site_id}/_functions/{FunctionName}
\`\`\`

Ví dụ: \`get_Products\` → \`GET /api/v1/{site_id}/_functions/Products\`

## Sử dụng webcake-fn SDK

\`\`\`javascript
const apiClient = WebCakeFn.api
// Gọi function từ frontend
apiClient.get_Products({ category: "shoes" })
apiClient.post_CreateOrder({ items: [...] })
\`\`\`

## Sử dụng webcake-data (Database SDK)

HTTP function được tích hợp sẵn package \`webcake-data\` — SDK truy vấn database theo kiểu MongoDB.

### Khởi tạo (trong http_function không cần truyền config, đã được cấu hình sẵn)

\`\`\`javascript
import { DBConnection } from 'webcake-data';

const db = new DBConnection();
\`\`\`

### Tạo model và CRUD

\`\`\`javascript
const User = db.model('users');

// Create
const user = await User.create({ name: 'John', email: 'john@example.com', age: 30 });

// Insert nhiều
await User.insertMany([{ name: 'A' }, { name: 'B' }]);

// Find
const users = await User.find({ active: true }).exec();
const user = await User.findOne({ email: 'john@example.com' });
const userById = await User.findById('uuid-here');

// findOne/findById với options
const user = await User.findOne({ email: 'john@example.com' }, {
  select: ['id', 'name', 'email'],
  sort: { inserted_at: -1 },
  populate: { field: 'profile', table: 'profiles', referenceField: 'user_id', select: 'avatar bio' }
});

// Update
await User.updateOne({ email: 'john@example.com' }, { age: 31 });
await User.findByIdAndUpdate('uuid', { age: 32 });
await User.updateMany({ active: false }, { active: true });

// Delete
await User.deleteOne({ email: 'john@example.com' });
await User.findByIdAndDelete('uuid');
await User.deleteMany({ active: false });

// Count & Exists
const count = await User.countDocuments({ active: true });
const exists = await User.exists({ email: 'john@example.com' });
\`\`\`

### Query nâng cao (QueryBuilder)

\`\`\`javascript
const results = await User.find()
  .where('age').gte(25).lte(40)
  .where('active', true)
  .in('role', ['admin', 'editor'])
  .like('email', '%@example.com')
  .sort({ age: -1, name: 1 })
  .limit(20)
  .skip(10)
  .select('name email age')
  .exec();
\`\`\`

### Populate (joins)

\`\`\`javascript
const usersWithPosts = await User.find()
  .populate({
    field: 'posts',
    table: 'posts',
    referenceField: 'user_id',
    select: 'title content',
    where: { published: true },
    sort: { inserted_at: -1 },
    limit: 5
  })
  .exec();
\`\`\`

### Query operators
- \`where(field, operator, value)\` hoặc \`where(obj)\`
- \`eq\`, \`ne\`, \`gt\`, \`gte\`, \`lt\`, \`lte\`
- \`in\`, \`nin\`, \`between\`, \`like\`
- \`sort\`, \`limit\`, \`skip\`, \`select\`, \`populate\`

## Ví dụ thực tế

\`\`\`javascript
import { DBConnection } from 'webcake-data';
const db = new DBConnection();

// Lấy danh sách sản phẩm từ collection tùy chỉnh
const Product = db.model('my_products');

export const get_ProductsByCategory = async (request) => {
  const { category, page = 1, limit = 10 } = request.params;
  const products = await Product.find({ category })
    .sort({ inserted_at: -1 })
    .limit(limit)
    .skip((page - 1) * limit)
    .exec();
  const total = await Product.countDocuments({ category });
  return { products, total, page };
}

// Tạo đơn hàng với dữ liệu tùy chỉnh
const Order = db.model('custom_orders');

export const post_CreateOrder = async (request) => {
  const { items, note } = request.params;
  const customer = request.customer;
  if (!customer?.id) return { error: "Unauthorized" };
  const order = await Order.create({
    customer_id: customer.id,
    customer_name: customer.name,
    items,
    note,
    status: 'pending'
  });
  return { order_id: order.id, status: 'created' };
}

// Webhook nhận callback
export const post_PaymentWebhook = async (request) => {
  const { transaction_id, status } = request.params;
  await Order.updateOne({ transaction_id }, { payment_status: status });
  return { received: true };
}
\`\`\`

## Cron Jobs

File jobs_config (JSON) cấu hình các hàm chạy tự động:

\`\`\`json
{
  "jobs": [
    {
      "functionLocation": "backend/http_function",
      "functionName": "syncInventory",
      "description": "Đồng bộ tồn kho mỗi ngày lúc 2h sáng",
      "executionConfig": {
        "cronExpression": "0 2 * * *"
      }
    },
    {
      "functionLocation": "backend/http_function",
      "functionName": "sendDailyReport",
      "description": "Gửi báo cáo lúc 8h sáng",
      "executionConfig": {
        "time": "08:00",
        "dayOfWeek": "Monday"
      }
    }
  ]
}
\`\`\``
        },
      },
    ],
  })
);

server.prompt(
  "custom_code_guide",
  "Hướng dẫn cách viết custom code cho trang (CSS/JS)",
  () => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `# Hướng dẫn viết Custom Code cho trang trong BuilderX

## Cấu trúc custom code

Mỗi trang có thể chứa custom code được inject vào HTML:

### 1. code_before_head
Chèn vào trước thẻ đóng </head>. Dùng cho:
- Meta tags bổ sung
- External CSS/fonts
- Tracking scripts (Google Analytics, Facebook Pixel, ...)

\`\`\`html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto">
<meta name="custom-meta" content="value">
<script>
  // tracking code
</script>
\`\`\`

### 2. code_before_body
Chèn vào trước thẻ đóng </body>. Dùng cho:
- JavaScript chạy sau khi DOM ready
- Widget scripts (chat, popup, ...)
- Custom logic

\`\`\`html
<script>
  document.addEventListener('DOMContentLoaded', () => {
    // custom logic
  });
</script>
\`\`\`

### 3. code_custom_css
CSS tùy chỉnh cho trang. Tự động wrap trong <style> nếu chưa có.

\`\`\`css
.hero-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 80vh;
}

.product-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0,0,0,0.1);
}

@media (max-width: 768px) {
  .hero-section { min-height: 60vh; }
}
\`\`\`

### 4. code_custom_javascript
JavaScript tùy chỉnh cho trang.

\`\`\`javascript
// Sử dụng PubSub để giao tiếp giữa các component
window.pubsub.subscribe('product-added', (data) => {
  console.log('Product added:', data);
});

// Sử dụng notification
window.useNotification('success', {
  title: 'Thành công!',
  message: 'Sản phẩm đã được thêm vào giỏ hàng'
});

// Resize hình ảnh
const resized = window.resizeLink(imageUrl, 200, 200);
// resized.webp, resized.cdn
\`\`\`

## Sử dụng webcake-fn (gọi HTTP function từ frontend)

Package \`webcake-fn\` được tích hợp sẵn trong site, cho phép gọi các HTTP function backend từ custom code.

### Cài đặt

Thêm CDN vào \`code_before_head\` để load webcake-fn:

\`\`\`html
<script src="https://cdn.jsdelivr.net/npm/webcake-fn/dist/webcake-fn.umd.min.js"></script>
\`\`\`

### Cách dùng trong custom code

Sau khi load CDN, sử dụng \`window.api\` trong \`code_before_body\` hoặc \`code_custom_javascript\`:

\`\`\`javascript
// window.api là instance webcake-fn, gọi trực tiếp HTTP function
// Format: api.[method]_[FunctionName](params)

// GET request
const products = await api.get_ProductsByCategory({ category: 'shoes', page: 1 });

// POST request
const order = await api.post_CreateOrder({ items: [...], note: 'Giao nhanh' });

// PUT request
const updated = await api.put_UpdateProfile({ name: 'Tên mới' });

// DELETE request
const deleted = await api.delete_RemoveItem({ itemId: '123' });
\`\`\`

### Quy tắc đặt tên
- Method viết thường: \`get\`, \`post\`, \`put\`, \`delete\`
- FunctionName khớp với tên export trong http_function backend
- Ví dụ: backend export \`get_Products\` → frontend gọi \`api.get_Products(params)\`

### Kết hợp với các API khác trong custom code

\`\`\`javascript
// Lấy dữ liệu từ backend function rồi hiển thị
const reviews = await api.get_ProductReviews({ productId: '123' });
const container = document.getElementById('reviews');
container.innerHTML = reviews.map(r => \\\`
  <div class="review">
    <strong>\\\${r.author}</strong>
    <p>\\\${r.content}</p>
  </div>
\\\`).join('');

// Gọi function khi click button
document.getElementById('submit-btn')?.addEventListener('click', async () => {
  try {
    const result = await api.post_SubmitForm({
      name: document.getElementById('name').value,
      email: document.getElementById('email').value
    });
    window.useNotification('success', { title: 'Gửi thành công!' });
  } catch (error) {
    window.useNotification('error', { title: 'Lỗi', message: error.message });
  }
});
\`\`\`

### Gọi nhiều function song song

\`\`\`javascript
const [products, categories, banners] = await Promise.all([
  api.get_Products({ limit: 10 }),
  api.get_Categories(),
  api.get_Banners({ position: 'homepage' })
]);
\`\`\`

### Xử lý lỗi

\`\`\`javascript
try {
  const result = await api.post_CreateOrder({ items: cartItems });
  // result trả về trực tiếp kết quả (đã unwrap từ response.data.result)
  console.log(result);
} catch (error) {
  if (error.message.includes('HTTP error! status: 401')) {
    // Chưa đăng nhập
    window.location.href = '/login';
  } else {
    window.useNotification('error', { title: 'Lỗi', message: error.message });
  }
}
\`\`\`

## Lưu ý
- Custom code lưu trong **site settings** (áp dụng cho toàn bộ site, không theo từng page)
- Cập nhật qua tool update_site_custom_code
- Có thể dùng window.pubsub, window.useNotification, window.resizeLink
- Có thể dùng \`api\` (webcake-fn) để gọi HTTP function backend
- Có thể truy cập window.SITE_DATA, window.DATA_ORDER cho context của site`
        },
      },
    ],
  })
);

// ═══════════════════════════════════════════
// CMS Files — Viết và quản lý backend code
// ═══════════════════════════════════════════

server.tool("list_cms_files", "Liệt kê tất cả CMS files (HTTP functions, cron jobs, ...) của site", {}, () =>
  handle(() => api.listCmsFiles())
);

server.tool(
  "create_cms_file",
  `Tạo CMS file mới. Types:
- "http_function": backend JS function, path sẽ là "backend/http_function"
- "jobs_config": cron job config (JSON), path là "backend/jobs.config"
- "default": file JS/JSON tùy ý`,
  {
    name: z.string().describe("Tên file"),
    content: z.string().describe("Nội dung code (JavaScript hoặc JSON)"),
    type: z.enum(["http_function", "jobs_config", "default"]).default("default").describe("Loại file"),
  },
  ({ name, content, type }) =>
    handle(() => api.createCmsFile({ name, content, type_create: "backend", type }))
);

server.tool(
  "update_cms_file",
  "Cập nhật nội dung code của CMS file đã tồn tại",
  {
    id: z.string().describe("CMS file ID"),
    content: z.string().describe("Nội dung code mới"),
    name: z.string().optional().describe("Đổi tên file"),
  },
  ({ id, content, name }) =>
    handle(() => api.updateCmsFile(id, { content, ...(name && { name }) }))
);

server.tool(
  "get_http_function",
  "Lấy file HTTP function chính của site. Trả về nội dung code JS hiện tại để đọc/sửa",
  {},
  () => handle(() => api.getHttpFunction())
);

server.tool(
  "update_http_function",
  `Cập nhật file HTTP function chính. Code JS theo format:
export const [method]_[FunctionName] = (request) => { ... }
Ví dụ: export const get_Products = (request) => { return request.params; }
Sau khi update sẽ tự deploy lên bundle service`,
  {
    content: z.string().describe("Toàn bộ nội dung code JS của file http_function"),
  },
  ({ content }) => handle(() => api.createOrUpdateHttpFunction({ content }))
);

server.tool(
  "run_function",
  `Chạy một HTTP function đã deploy. Tên function không bao gồm prefix method.
Ví dụ: function "get_Products" → function_name="Products", method="GET"`,
  {
    function_name: z.string().describe("Tên function (không có prefix method, ví dụ: 'Products')"),
    method: z.enum(["GET", "POST", "PUT", "PATCH"]).default("POST").describe("HTTP method tương ứng"),
    params: z.record(z.any()).optional().describe("Tham số truyền vào function"),
  },
  ({ function_name, method, params }) =>
    handle(() => api.runFunction(function_name, method, params))
);

server.tool(
  "debug_function",
  `Chạy code JS ở chế độ debug để test trước khi deploy.
Gửi code trực tiếp, không cần save file trước.
Response trả về kết quả thực thi và log`,
  {
    content: z.string().describe("Code JS cần debug (cùng format http_function)"),
    function_name: z.string().describe("Tên function cần chạy trong code"),
    params: z.record(z.any()).optional().describe("Tham số test"),
  },
  ({ content, function_name, params }) =>
    handle(() => api.debugFunction({ content, functionName: function_name, params }))
);

server.tool(
  "save_file_version",
  "Lưu snapshot phiên bản của CMS file (để rollback khi cần)",
  {
    cms_file_id: z.string().describe("CMS file ID"),
    content: z.string().describe("Nội dung cần lưu version"),
    is_public: z.boolean().default(false).describe("Đánh dấu là version public"),
  },
  ({ cms_file_id, content, is_public }) =>
    handle(() => api.saveFileVersion({ cms_file_id, content, is_public }))
);

server.tool(
  "get_file_versions",
  "Xem lịch sử phiên bản của CMS file",
  {
    cms_file_id: z.string().describe("CMS file ID"),
  },
  ({ cms_file_id }) => handle(() => api.getFileVersions({ cms_file_id }))
);

server.tool(
  "toggle_debug_render",
  "Bật/tắt chế độ debug render cho CMS file",
  {
    cms_file_id: z.string().describe("CMS file ID"),
  },
  ({ cms_file_id }) => handle(() => api.toggleDebugRender({ cms_file_id }))
);

// ═══════════════════════════════════════════
// Pages — Quản lý trang và custom code
// ═══════════════════════════════════════════

server.tool("list_pages", "Liệt kê tất cả trang của site", {}, () =>
  handle(() => api.listPages())
);

server.tool(
  "create_page",
  "Tạo trang mới",
  {
    name: z.string().describe("Tên trang"),
    slug: z.string().describe("URL slug (ví dụ: '/about')"),
    type: z.string().optional().describe("Loại trang"),
    is_homepage: z.boolean().default(false).describe("Đặt làm trang chủ"),
  },
  ({ name, slug, type, is_homepage }) =>
    handle(() => api.createPage({ name, slug, type, is_homepage }))
);

server.tool(
  "update_page",
  "Cập nhật thuộc tính trang (tên, slug, settings, custom code)",
  {
    page_id: z.string().describe("Page ID"),
    name: z.string().optional().describe("Tên mới"),
    slug: z.string().optional().describe("Slug mới"),
    is_homepage: z.boolean().optional().describe("Đặt làm trang chủ"),
    settings: z.record(z.any()).optional().describe("Settings trang"),
  },
  ({ page_id, ...params }) => handle(() => api.updatePage(page_id, params))
);

server.tool(
  "update_site_custom_code",
  `Cập nhật custom code (CSS/JS) cho toàn bộ site. Lưu trong site settings, áp dụng cho mọi trang.
- code_before_head: HTML/script chèn trước </head>
- code_before_body: HTML/script chèn trước </body>
- code_custom_css: CSS tùy chỉnh (tự wrap trong <style>)
- code_custom_javascript: JavaScript tùy chỉnh`,
  {
    code_before_head: z.string().optional().describe("HTML/script chèn vào <head>"),
    code_before_body: z.string().optional().describe("HTML/script chèn trước </body>"),
    code_custom_css: z.string().optional().describe("CSS tùy chỉnh cho site"),
    code_custom_javascript: z.string().optional().describe("JavaScript tùy chỉnh cho site"),
  },
  (codes) => {
    const settings = {};
    for (const [k, v] of Object.entries(codes)) {
      if (v != null) settings[k] = v;
    }
    return handle(() => api.updateSiteSettings(settings));
  }
);

server.tool(
  "delete_page",
  "Xóa trang",
  {
    page_id: z.string().describe("Page ID cần xóa"),
  },
  ({ page_id }) => handle(() => api.deletePage({ page_id }))
);

server.tool(
  "get_page_versions",
  "Xem lịch sử phiên bản của trang",
  {
    page_id: z.string().describe("Page ID"),
  },
  ({ page_id }) => handle(() => api.getPageVersions(page_id))
);

server.tool(
  "list_page_contents",
  "Liệt kê nội dung đa ngôn ngữ của trang",
  {
    page_id: z.string().optional().describe("Lọc theo Page ID"),
  },
  ({ page_id }) => handle(() => api.listPageContents({ page_id }))
);

server.tool(
  "update_page_content",
  "Tạo/cập nhật nội dung trang cho một ngôn ngữ",
  {
    page_id: z.string().describe("Page ID"),
    language_code: z.string().describe("Mã ngôn ngữ (vd: 'en', 'vi')"),
    content: z.record(z.any()).describe("Nội dung trang"),
    meta_tags: z.array(z.record(z.any())).optional().describe("SEO meta tags"),
  },
  ({ page_id, language_code, content, meta_tags }) =>
    handle(() => api.updatePageContent({ page_id, language_code, content, meta_tags }))
);

server.tool("list_global_sections", "Liệt kê các global section dùng chung", {}, () =>
  handle(() => api.listGlobalSections())
);

// ═══════════════════════════════════════════
// Blog Articles
// ═══════════════════════════════════════════

server.tool(
  "list_articles",
  "Liệt kê bài viết blog",
  {
    page: z.number().optional().describe("Số trang"),
    limit: z.number().optional().describe("Số bài/trang"),
    category_id: z.string().optional().describe("Lọc theo danh mục"),
  },
  ({ page, limit, category_id }) =>
    handle(() => api.listArticles({ page, limit, category_id }))
);

server.tool(
  "get_article",
  "Lấy chi tiết bài viết theo ID",
  {
    id: z.string().describe("Article ID"),
  },
  ({ id }) => handle(() => api.getArticle(id))
);

server.tool(
  "create_article",
  "Tạo bài viết blog mới",
  {
    name: z.string().describe("Tiêu đề bài viết"),
    slug: z.string().describe("URL slug"),
    content: z.string().describe("Nội dung HTML"),
    summary: z.string().optional().describe("Tóm tắt"),
    category_id: z.string().optional().describe("ID danh mục"),
    tags: z.array(z.string()).optional().describe("Tags"),
    images: z.array(z.string()).optional().describe("URLs hình ảnh"),
    is_hidden: z.boolean().default(false).describe("Ẩn khỏi public"),
  },
  (params) => handle(() => api.createArticle(params))
);

server.tool(
  "update_article",
  "Cập nhật bài viết blog",
  {
    id: z.string().describe("Article ID"),
    name: z.string().optional().describe("Tiêu đề mới"),
    slug: z.string().optional().describe("Slug mới"),
    content: z.string().optional().describe("Nội dung HTML mới"),
    summary: z.string().optional().describe("Tóm tắt mới"),
    category_id: z.string().optional().describe("ID danh mục"),
    tags: z.array(z.string()).optional().describe("Tags"),
    is_hidden: z.boolean().optional().describe("Ẩn khỏi public"),
  },
  ({ id, ...params }) => handle(() => api.updateArticle(id, params))
);

server.tool(
  "delete_article",
  "Xóa bài viết blog",
  {
    id: z.string().describe("Article ID"),
  },
  ({ id }) => handle(() => api.deleteArticle(id))
);

// ═══════════════════════════════════════════
// Customers
// ═══════════════════════════════════════════

server.tool(
  "find_customer",
  "Tìm khách hàng theo ID, số điện thoại, hoặc email",
  {
    by: z.enum(["id", "phone", "email"]).describe("Tìm theo trường nào"),
    value: z.string().describe("Giá trị tìm kiếm"),
  },
  ({ by, value }) =>
    handle(() => {
      switch (by) {
        case "id": return api.findCustomerById(value);
        case "phone": return api.findCustomerByPhone(value);
        case "email": return api.findCustomerByEmail(value);
      }
    })
);

// ═══════════════════════════════════════════
// Automation
// ═══════════════════════════════════════════

server.tool(
  "send_mail",
  "Gửi email qua CMS automation",
  {
    to: z.string().describe("Email người nhận"),
    subject: z.string().describe("Tiêu đề email"),
    body: z.string().describe("Nội dung email (hỗ trợ HTML)"),
  },
  (params) => handle(() => api.sendMail(params))
);

// ═══════════════════════════════════════════
// Start server
// ═══════════════════════════════════════════

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
