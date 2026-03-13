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
// Prompts — teach AI how to write CMS code
// ═══════════════════════════════════════════

server.prompt(
  "http_function_guide",
  "Guide for writing HTTP functions in BuilderX CMS",
  () => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `# HTTP Function Guide for BuilderX CMS

## Syntax

The http_function file contains backend JavaScript functions. Each function is exported with the format:

\`\`\`javascript
export const [method]_[FunctionName] = (request) => {
  // code
  return result;
}
\`\`\`

## Naming Rules
- Method: lowercase (get, post, put, patch, delete)
- FunctionName: PascalCase
- Examples: get_Products, post_CreateOrder, put_UpdateUser, delete_RemoveItem

## Request object

\`\`\`javascript
export const get_Example = (request) => {
  request.params    // Object - query params or body params
  request.customer  // Object - logged-in customer info
                    //   { id, name, email, first_name, last_name, phone_number, avatar }
  request.account   // Object - admin account info
                    //   { id, name, email, first_name, last_name, phone_number, avatar }
  request.data      // Object - full request params (including query string)
}
\`\`\`

## Calling API functions

After deployment, functions are called via:
\`\`\`
GET/POST/PUT/PATCH /api/v1/{site_id}/_functions/{FunctionName}
\`\`\`

Example: \`get_Products\` → \`GET /api/v1/{site_id}/_functions/Products\`

## Using webcake-fn SDK

\`\`\`javascript
const apiClient = WebCakeFn.api
// Call function from frontend
apiClient.get_Products({ category: "shoes" })
apiClient.post_CreateOrder({ items: [...] })
\`\`\`

## Using webcake-data (Database SDK)

HTTP functions have the \`webcake-data\` package built-in — a MongoDB-style database query SDK.

### Initialization (no config needed inside http_function, already pre-configured)

\`\`\`javascript
import { DBConnection } from 'webcake-data';

const db = new DBConnection();
\`\`\`

### Model creation and CRUD

\`\`\`javascript
const User = db.model('users');

// Create
const user = await User.create({ name: 'John', email: 'john@example.com', age: 30 });

// Insert many
await User.insertMany([{ name: 'A' }, { name: 'B' }]);

// Find
const users = await User.find({ active: true }).exec();
const user = await User.findOne({ email: 'john@example.com' });
const userById = await User.findById('uuid-here');

// findOne/findById with options
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

### Advanced queries (QueryBuilder)

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
- \`where(field, operator, value)\` or \`where(obj)\`
- \`eq\`, \`ne\`, \`gt\`, \`gte\`, \`lt\`, \`lte\`
- \`in\`, \`nin\`, \`between\`, \`like\`
- \`sort\`, \`limit\`, \`skip\`, \`select\`, \`populate\`

## Practical examples

\`\`\`javascript
import { DBConnection } from 'webcake-data';
const db = new DBConnection();

// Get products from a custom collection
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

// Create order with custom data
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

// Webhook callback handler
export const post_PaymentWebhook = async (request) => {
  const { transaction_id, status } = request.params;
  await Order.updateOne({ transaction_id }, { payment_status: status });
  return { received: true };
}
\`\`\`

## Cron Jobs

The jobs_config file (JSON) configures auto-running functions:

\`\`\`json
{
  "jobs": [
    {
      "functionLocation": "backend/http_function",
      "functionName": "syncInventory",
      "description": "Sync inventory daily at 2am",
      "executionConfig": {
        "cronExpression": "0 2 * * *"
      }
    },
    {
      "functionLocation": "backend/http_function",
      "functionName": "sendDailyReport",
      "description": "Send report at 8am",
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
  "Guide for writing custom code for pages (CSS/JS)",
  () => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `# Custom Code Guide for BuilderX

## Custom code structure

Custom code is injected into the site HTML:

### 1. code_before_head
Inserted before the closing </head> tag. Used for:
- Additional meta tags
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
Inserted before the closing </body> tag. Used for:
- JavaScript that runs after DOM ready
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
Custom CSS for the site. Automatically wrapped in <style> if not already.

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
Custom JavaScript for the site.

\`\`\`javascript
// Use PubSub for cross-component communication
window.pubsub.subscribe('product-added', (data) => {
  console.log('Product added:', data);
});

// Use notification
window.useNotification('success', {
  title: 'Success!',
  message: 'Product has been added to cart'
});

// Resize image
const resized = window.resizeLink(imageUrl, 200, 200);
// resized.webp, resized.cdn
\`\`\`

## Using webcake-fn (call HTTP functions from frontend)

The \`webcake-fn\` package allows calling backend HTTP functions from custom code.

### Installation

Add CDN to \`code_before_head\` to load webcake-fn:

\`\`\`html
<script src="https://cdn.jsdelivr.net/npm/webcake-fn/dist/webcake-fn.umd.min.js"></script>
\`\`\`

### Usage in custom code

After loading CDN, use \`window.api\` in \`code_before_body\` or \`code_custom_javascript\`:

\`\`\`javascript
// window.api is the webcake-fn instance, call HTTP functions directly
// Format: api.[method]_[FunctionName](params)

// GET request
const products = await api.get_ProductsByCategory({ category: 'shoes', page: 1 });

// POST request
const order = await api.post_CreateOrder({ items: [...], note: 'Express delivery' });

// PUT request
const updated = await api.put_UpdateProfile({ name: 'New Name' });

// DELETE request
const deleted = await api.delete_RemoveItem({ itemId: '123' });
\`\`\`

### Naming rules
- Method in lowercase: \`get\`, \`post\`, \`put\`, \`delete\`
- FunctionName matches the export name in http_function backend
- Example: backend exports \`get_Products\` → frontend calls \`api.get_Products(params)\`

### Combining with other APIs in custom code

\`\`\`javascript
// Fetch data from backend function and display
const reviews = await api.get_ProductReviews({ productId: '123' });
const container = document.getElementById('reviews');
container.innerHTML = reviews.map(r => \\\`
  <div class="review">
    <strong>\\\${r.author}</strong>
    <p>\\\${r.content}</p>
  </div>
\\\`).join('');

// Call function on button click
document.getElementById('submit-btn')?.addEventListener('click', async () => {
  try {
    const result = await api.post_SubmitForm({
      name: document.getElementById('name').value,
      email: document.getElementById('email').value
    });
    window.useNotification('success', { title: 'Submitted successfully!' });
  } catch (error) {
    window.useNotification('error', { title: 'Error', message: error.message });
  }
});
\`\`\`

### Calling multiple functions in parallel

\`\`\`javascript
const [products, categories, banners] = await Promise.all([
  api.get_Products({ limit: 10 }),
  api.get_Categories(),
  api.get_Banners({ position: 'homepage' })
]);
\`\`\`

### Error handling

\`\`\`javascript
try {
  const result = await api.post_CreateOrder({ items: cartItems });
  // result is the direct return value (unwrapped from response.data.result)
  console.log(result);
} catch (error) {
  if (error.message.includes('HTTP error! status: 401')) {
    // Not logged in
    window.location.href = '/login';
  } else {
    window.useNotification('error', { title: 'Error', message: error.message });
  }
}
\`\`\`

## Notes
- Custom code is stored in **site settings** (applies to the entire site, not per page)
- Update via the update_site_custom_code tool
- Available globals: window.pubsub, window.useNotification, window.resizeLink
- Use \`api\` (webcake-fn) to call backend HTTP functions
- Access window.SITE_DATA, window.DATA_ORDER for site context`
        },
      },
    ],
  })
);

// ═══════════════════════════════════════════
// CMS Files — Write and manage backend code
// ═══════════════════════════════════════════

server.tool("list_cms_files", "List all CMS files (HTTP functions, cron jobs, ...) for the site", {}, () =>
  handle(() => api.listCmsFiles())
);

server.tool(
  "create_cms_file",
  `Create a new CMS file. Types:
- "http_function": backend JS function, path will be "backend/http_function"
- "jobs_config": cron job config (JSON), path is "backend/jobs.config"
- "default": custom JS/JSON file`,
  {
    name: z.string().describe("File name"),
    content: z.string().describe("Code content (JavaScript or JSON)"),
    type: z.enum(["http_function", "jobs_config", "default"]).default("default").describe("File type"),
  },
  ({ name, content, type }) =>
    handle(() => api.createCmsFile({ name, content, type_create: "backend", type }))
);

server.tool(
  "update_cms_file",
  "Update the code content of an existing CMS file",
  {
    id: z.string().describe("CMS file ID"),
    content: z.string().describe("New code content"),
    name: z.string().optional().describe("Rename file"),
  },
  ({ id, content, name }) =>
    handle(() => api.updateCmsFile(id, { content, ...(name && { name }) }))
);

server.tool(
  "get_http_function",
  "Get the main HTTP function file of the site. Returns current JS code content for reading/editing",
  {},
  () => handle(() => api.getHttpFunction())
);

server.tool(
  "update_http_function",
  `Update the main HTTP function file. JS code follows the format:
export const [method]_[FunctionName] = (request) => { ... }
Example: export const get_Products = (request) => { return request.params; }
After update, it will auto-deploy to the bundle service`,
  {
    content: z.string().describe("Full JS code content of the http_function file"),
  },
  ({ content }) => handle(() => api.createOrUpdateHttpFunction({ content }))
);

server.tool(
  "run_function",
  `Run a deployed HTTP function. Function name does not include the method prefix.
Example: function "get_Products" → function_name="Products", method="GET"`,
  {
    function_name: z.string().describe("Function name (without method prefix, e.g. 'Products')"),
    method: z.enum(["GET", "POST", "PUT", "PATCH"]).default("POST").describe("Corresponding HTTP method"),
    params: z.record(z.any()).optional().describe("Parameters to pass to the function"),
  },
  ({ function_name, method, params }) =>
    handle(() => api.runFunction(function_name, method, params))
);

server.tool(
  "debug_function",
  `Run JS code in debug mode to test before deploying.
Send code directly, no need to save the file first.
Response returns execution result and logs`,
  {
    content: z.string().describe("JS code to debug (same format as http_function)"),
    function_name: z.string().describe("Function name to run in the code"),
    params: z.record(z.any()).optional().describe("Test parameters"),
  },
  ({ content, function_name, params }) =>
    handle(() => api.debugFunction({ content, functionName: function_name, params }))
);

server.tool(
  "save_file_version",
  "Save a version snapshot of a CMS file (for rollback when needed)",
  {
    cms_file_id: z.string().describe("CMS file ID"),
    content: z.string().describe("Content to save as version"),
    is_public: z.boolean().default(false).describe("Mark as public version"),
  },
  ({ cms_file_id, content, is_public }) =>
    handle(() => api.saveFileVersion({ cms_file_id, content, is_public }))
);

server.tool(
  "get_file_versions",
  "View version history of a CMS file",
  {
    cms_file_id: z.string().describe("CMS file ID"),
  },
  ({ cms_file_id }) => handle(() => api.getFileVersions({ cms_file_id }))
);

server.tool(
  "toggle_debug_render",
  "Toggle debug render mode for a CMS file",
  {
    cms_file_id: z.string().describe("CMS file ID"),
  },
  ({ cms_file_id }) => handle(() => api.toggleDebugRender({ cms_file_id }))
);

// ═══════════════════════════════════════════
// Pages — Manage pages and custom code
// ═══════════════════════════════════════════

server.tool("list_pages", "List all pages of the site", {}, () =>
  handle(() => api.listPages())
);

server.tool(
  "create_page",
  "Create a new page",
  {
    name: z.string().describe("Page name"),
    slug: z.string().describe("URL slug (e.g. '/about')"),
    type: z.string().optional().describe("Page type"),
    is_homepage: z.boolean().default(false).describe("Set as homepage"),
  },
  ({ name, slug, type, is_homepage }) =>
    handle(() => api.createPage({ name, slug, type, is_homepage }))
);

server.tool(
  "update_page",
  "Update page properties (name, slug, settings, custom code)",
  {
    page_id: z.string().describe("Page ID"),
    name: z.string().optional().describe("New name"),
    slug: z.string().optional().describe("New slug"),
    is_homepage: z.boolean().optional().describe("Set as homepage"),
    settings: z.record(z.any()).optional().describe("Page settings"),
  },
  ({ page_id, ...params }) => handle(() => api.updatePage(page_id, params))
);

server.tool(
  "get_site_custom_code",
  "Get current custom code of the site (CSS/JS). Use to read existing code before updating, to avoid overwriting",
  {},
  () =>
    handle(async () => {
      const siteRes = await api.getSite();
      const s = siteRes?.data?.settings || {};
      return {
        code_before_head: s.code_before_head || "",
        code_before_body: s.code_before_body || "",
        code_custom_css: s.code_custom_css || "",
        code_custom_javascript: s.code_custom_javascript || "",
      };
    })
);

server.tool(
  "update_site_custom_code",
  `Update custom code (CSS/JS) for the entire site. Stored in site settings, applies to all pages.
- code_before_head: HTML/script inserted before </head>
- code_before_body: HTML/script inserted before </body>
- code_custom_css: Custom CSS (auto-wrapped in <style>)
- code_custom_javascript: Custom JavaScript`,
  {
    code_before_head: z.string().optional().describe("HTML/script to insert in <head>"),
    code_before_body: z.string().optional().describe("HTML/script to insert before </body>"),
    code_custom_css: z.string().optional().describe("Custom CSS for the site"),
    code_custom_javascript: z.string().optional().describe("Custom JavaScript for the site"),
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
  "Delete a page",
  {
    page_id: z.string().describe("Page ID to delete"),
  },
  ({ page_id }) => handle(() => api.deletePage({ page_id }))
);

server.tool(
  "get_page_versions",
  "View version history of a page",
  {
    page_id: z.string().describe("Page ID"),
  },
  ({ page_id }) => handle(() => api.getPageVersions(page_id))
);

server.tool(
  "list_page_contents",
  "List multi-language contents of a page",
  {
    page_id: z.string().optional().describe("Filter by Page ID"),
  },
  ({ page_id }) => handle(() => api.listPageContents({ page_id }))
);

server.tool(
  "update_page_content",
  "Create/update page content for a specific language",
  {
    page_id: z.string().describe("Page ID"),
    language_code: z.string().describe("Language code (e.g. 'en', 'vi')"),
    content: z.record(z.any()).describe("Page content"),
    meta_tags: z.array(z.record(z.any())).optional().describe("SEO meta tags"),
  },
  ({ page_id, language_code, content, meta_tags }) =>
    handle(() => api.updatePageContent({ page_id, language_code, content, meta_tags }))
);

server.tool("list_global_sections", "List reusable global sections", {}, () =>
  handle(() => api.listGlobalSections())
);

// ═══════════════════════════════════════════
// Blog Articles
// ═══════════════════════════════════════════

server.tool(
  "list_articles",
  "List blog articles with filtering",
  {
    page: z.number().optional().describe("Page number"),
    limit: z.number().optional().describe("Items per page"),
    category_id: z.string().optional().describe("Filter by category"),
  },
  ({ page, limit, category_id }) =>
    handle(() => api.listArticles({ page, limit, category_id }))
);

server.tool(
  "get_article",
  "Get article details by ID",
  {
    id: z.string().describe("Article ID"),
  },
  ({ id }) => handle(() => api.getArticle(id))
);

server.tool(
  "create_article",
  "Create a new blog article",
  {
    name: z.string().describe("Article title"),
    slug: z.string().describe("URL slug"),
    content: z.string().describe("HTML content"),
    summary: z.string().optional().describe("Summary"),
    category_id: z.string().optional().describe("Category ID"),
    tags: z.array(z.string()).optional().describe("Tags"),
    images: z.array(z.string()).optional().describe("Image URLs"),
    is_hidden: z.boolean().default(false).describe("Hide from public"),
  },
  (params) => handle(() => api.createArticle(params))
);

server.tool(
  "update_article",
  "Update a blog article",
  {
    id: z.string().describe("Article ID"),
    name: z.string().optional().describe("New title"),
    slug: z.string().optional().describe("New slug"),
    content: z.string().optional().describe("New HTML content"),
    summary: z.string().optional().describe("New summary"),
    category_id: z.string().optional().describe("Category ID"),
    tags: z.array(z.string()).optional().describe("Tags"),
    is_hidden: z.boolean().optional().describe("Hide from public"),
  },
  ({ id, ...params }) => handle(() => api.updateArticle(id, params))
);

server.tool(
  "delete_article",
  "Delete a blog article",
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
  "Find a customer by ID, phone number, or email",
  {
    by: z.enum(["id", "phone", "email"]).describe("Search field"),
    value: z.string().describe("Search value"),
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
  "Send email via CMS automation",
  {
    to: z.string().describe("Recipient email"),
    subject: z.string().describe("Email subject"),
    body: z.string().describe("Email body (supports HTML)"),
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
