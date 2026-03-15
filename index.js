#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { WebcakeCmsApi } from "./api.js";

const BASE_URL = process.env.WEBCAKE_API_URL;
const TOKEN = process.env.WEBCAKE_TOKEN;
const SITE_ID = process.env.WEBCAKE_SITE_ID;

if (!BASE_URL || !TOKEN || !SITE_ID) {
  console.error("Required env vars: WEBCAKE_API_URL, WEBCAKE_TOKEN, WEBCAKE_SITE_ID");
  process.exit(1);
}

const api = new WebcakeCmsApi({ baseUrl: BASE_URL, token: TOKEN, siteId: SITE_ID });
const server = new McpServer({
  name: "webcake-cms",
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
// Guides — auto-injected into tool responses
// ═══════════════════════════════════════════

const HTTP_FUNCTION_GUIDE = `
# HTTP Function Guide

## Syntax
export const [method]_[FunctionName] = (request) => { return result; }
- Method: lowercase (get, post, put, patch, delete)
- FunctionName: PascalCase
- Examples: get_Products, post_CreateOrder, delete_RemoveItem

## Request object
- request.params    — query params or body params
- request.customer  — logged-in customer { id, name, email, first_name, last_name, phone_number, avatar }
- request.account   — admin account { id, name, email, first_name, last_name, phone_number, avatar }
- request.data      — full request params (including query string)

## API endpoint after deploy
GET/POST/PUT/PATCH /api/v1/{site_id}/_functions/{FunctionName}

## webcake-data (Database SDK, built-in, no config needed)
import { DBConnection } from 'webcake-data';
const db = new DBConnection();
const Model = db.model('table_name');

### CRUD
- Model.create({ field: value })
- Model.insertMany([...])
- Model.find(filter).sort().limit().skip().select().exec()
- Model.findOne(filter, { select, sort, populate })
- Model.findById(id)
- Model.updateOne(filter, update)
- Model.findByIdAndUpdate(id, update)
- Model.updateMany(filter, update)
- Model.deleteOne(filter)
- Model.findByIdAndDelete(id)
- Model.deleteMany(filter)
- Model.countDocuments(filter)
- Model.exists(filter)

### QueryBuilder
Model.find().where('age').gte(25).lte(40).in('role', ['admin']).like('email', '%@ex.com').sort({ age: -1 }).limit(20).skip(10).select('name email').exec()

### Populate (joins)
Model.find().populate({ field: 'posts', table: 'posts', referenceField: 'user_id', select: 'title', where: {}, sort: {}, limit: 5 }).exec()

### Operators
where, eq, ne, gt, gte, lt, lte, in, nin, between, like, sort, limit, skip, select, populate

## Built-in Modules
- import { findArticleById, findArticle, createArticle, updateArticleById, deleteArticleById } from '@webcake/article'
- import { findCustomerById, findCustomerByPhone, findCustomerByEmail } from '@webcake/customer'
- import { addBonus } from '@webcake/promotion'
- import { getAccessToken } from '@webcake/token'
- import { sendMail } from '@webcake/app/automation'
All module functions take (request, ...args) and auto-use global token/site_id.

## Sandbox Globals (no import needed)
- fetch(url, options) — HTTP requests
- URLSearchParams — URL query building
- console.log/warn/error — logging (captured in debug mode)
- global.domain, global.siteId, global.token, global.headers

## Cron Jobs (jobs_config JSON)
{ "jobs": [{ "functionLocation": "backend/http_function", "functionName": "myFunc", "executionConfig": { "cronExpression": "0 2 * * *" } }] }
`;

const CUSTOM_CODE_GUIDE = `
# Custom Code Guide

Custom code is stored in site settings (applies to entire site, not per page).

## Injection points
- code_before_head: HTML/script inserted before </head> (meta tags, external CSS, tracking scripts)
- code_before_body: HTML/script inserted before </body> (DOM-ready JS, widgets)
- code_custom_css: Custom CSS (auto-wrapped in <style>)
- code_custom_javascript: Custom JavaScript

## webcake-fn (call HTTP functions from frontend)
Add CDN to code_before_head:
<script src="https://cdn.jsdelivr.net/npm/webcake-fn/dist/webcake-fn.umd.min.js"></script>

Then use window.api in code_custom_javascript or code_before_body:
- api.get_Products({ category: 'shoes' })
- api.post_CreateOrder({ items: [...] })
- Method lowercase + FunctionName matching backend export

## Available globals
- window.pubsub.subscribe(event, callback) / window.pubsub.publish(event, data)
- window.useNotification(type, { title, message }) — type: 'success' | 'error' | 'warning'
- window.resizeLink(url, width, height) — returns { webp, cdn }
- window.SITE_DATA, window.DATA_ORDER — site context

## Error handling
try { const r = await api.post_X(params); } catch (e) { window.useNotification('error', { title: 'Error', message: e.message }); }
`;

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
  "Get the main HTTP function file. Returns current code, collection schemas, and a coding guide. Always call this before writing/updating HTTP functions",
  {},
  () =>
    handle(async () => {
      const [httpFunc, collections] = await Promise.all([
        api.getHttpFunction(),
        api.listCollections({ limit: 100 }).catch(() => null),
      ]);
      const schemas = (collections && collections.data || []).map((c) => ({
        name: c.name,
        table_name: c.table_name,
        fields: (c.schema || []).map((f) => ({
          name: f.name,
          type: f.type,
          is_required: f.is_required,
          reference: f.reference || undefined,
        })),
      }));
      return { guide: HTTP_FUNCTION_GUIDE, http_function: httpFunc, collections: schemas };
    })
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
  "Get current custom code of the site (CSS/JS) with coding guide. Always call this before writing/updating custom code to avoid overwriting existing code",
  {},
  () =>
    handle(async () => {
      const siteRes = await api.getSite();
      const s = (siteRes && siteRes.data && siteRes.data.settings) || {};
      return {
        guide: CUSTOM_CODE_GUIDE,
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
// Collections — Database tables and schemas
// ═══════════════════════════════════════════

server.tool(
  "list_collections",
  "List all database collections (tables) for the site. Returns collection names, schemas (field definitions with types), and record counts. Useful for understanding the data model before writing HTTP functions",
  {
    page: z.number().optional().describe("Page number"),
    limit: z.number().optional().describe("Items per page"),
    term: z.string().optional().describe("Search by collection name"),
  },
  ({ page, limit, term }) =>
    handle(() => api.listCollections({ page, limit, term }))
);

server.tool(
  "get_collection",
  "Get a specific collection's details including full schema (field names, types, constraints, references) and records",
  {
    id: z.string().describe("Collection ID"),
  },
  ({ id }) => handle(() => api.getCollection(id))
);

server.tool(
  "query_collection_records",
  "Query records from a collection by table name. Use to inspect existing data",
  {
    table_name: z.string().describe("Collection table name (e.g. 'subscribers', 'custom_orders')"),
    page: z.number().optional().describe("Page number"),
    limit: z.number().optional().describe("Items per page"),
  },
  ({ table_name, page, limit }) =>
    handle(() => api.queryCollectionRecords(table_name, { page, limit }))
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
