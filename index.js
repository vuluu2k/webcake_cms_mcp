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
// CMS Files
// ═══════════════════════════════════════════

server.tool("list_cms_files", "List all CMS files (HTTP functions, cron jobs, etc.) for the site", {}, () =>
  handle(() => api.listCmsFiles())
);

server.tool(
  "create_cms_file",
  "Create a new CMS file (HTTP function, cron job config, or default file)",
  {
    name: z.string().describe("File name"),
    path: z.string().describe("File path (e.g. 'functions/my-api')"),
    content: z.string().describe("File content (JavaScript code)"),
    type: z.enum(["http_function", "jobs_config", "default"]).default("default").describe("File type"),
  },
  ({ name, path, content, type }) =>
    handle(() => api.createCmsFile({ name, path, content, type_create: type }))
);

server.tool(
  "update_cms_file",
  "Update an existing CMS file's content",
  {
    id: z.string().describe("CMS file ID"),
    content: z.string().describe("Updated file content"),
    name: z.string().optional().describe("Updated file name"),
  },
  ({ id, content, name }) =>
    handle(() => api.updateCmsFile(id, { content, ...(name && { name }) }))
);

server.tool("get_http_function", "Get the main HTTP function file for the site", {}, () =>
  handle(() => api.getHttpFunction())
);

server.tool(
  "update_http_function",
  "Create or update the main HTTP function file",
  {
    content: z.string().describe("HTTP function JavaScript code"),
  },
  ({ content }) => handle(() => api.createOrUpdateHttpFunction({ content }))
);

server.tool(
  "run_function",
  "Execute a deployed HTTP function by name",
  {
    function_name: z.string().describe("Function name to execute"),
    method: z.enum(["GET", "POST", "PUT", "PATCH"]).default("POST").describe("HTTP method"),
    params: z.record(z.any()).optional().describe("Request parameters/body"),
  },
  ({ function_name, method, params }) =>
    handle(() => api.runFunction(function_name, method, params))
);

server.tool(
  "debug_function",
  "Run a CMS function in debug mode for testing",
  {
    content: z.string().describe("JavaScript code to debug"),
    params: z.record(z.any()).optional().describe("Test parameters"),
  },
  ({ content, params }) => handle(() => api.debugFunction({ content, params }))
);

server.tool(
  "save_file_version",
  "Save a version snapshot of a CMS file",
  {
    cms_file_id: z.string().describe("CMS file ID"),
    content: z.string().describe("Version content to save"),
    is_public: z.boolean().default(false).describe("Make this version public"),
  },
  ({ cms_file_id, content, is_public }) =>
    handle(() => api.saveFileVersion({ cms_file_id, content, is_public }))
);

server.tool(
  "get_file_versions",
  "Get version history of a CMS file",
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
// Pages
// ═══════════════════════════════════════════

server.tool("list_pages", "List all pages for the site", {}, () =>
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
  "Update a page's properties (name, slug, settings)",
  {
    page_id: z.string().describe("Page ID"),
    name: z.string().optional().describe("Updated name"),
    slug: z.string().optional().describe("Updated slug"),
    is_homepage: z.boolean().optional().describe("Set as homepage"),
    settings: z.record(z.any()).optional().describe("Page settings"),
  },
  ({ page_id, ...params }) => handle(() => api.updatePage(page_id, params))
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
  "Get version history of a page",
  {
    page_id: z.string().describe("Page ID"),
  },
  ({ page_id }) => handle(() => api.getPageVersions(page_id))
);

server.tool(
  "list_page_contents",
  "List multi-language page contents",
  {
    page_id: z.string().optional().describe("Filter by page ID"),
  },
  ({ page_id }) => handle(() => api.listPageContents({ page_id }))
);

server.tool(
  "update_page_content",
  "Create or update page content for a language",
  {
    page_id: z.string().describe("Page ID"),
    language_code: z.string().describe("Language code (e.g. 'en', 'vi')"),
    content: z.record(z.any()).describe("Page content data"),
    meta_tags: z.array(z.record(z.any())).optional().describe("SEO meta tags"),
  },
  ({ page_id, language_code, content, meta_tags }) =>
    handle(() => api.updatePageContent({ page_id, language_code, content, meta_tags }))
);

server.tool("list_global_sections", "List all reusable global sections", {}, () =>
  handle(() => api.listGlobalSections())
);

// ═══════════════════════════════════════════
// Blog Articles
// ═══════════════════════════════════════════

server.tool(
  "list_articles",
  "List blog articles with optional filtering",
  {
    page: z.number().optional().describe("Page number for pagination"),
    limit: z.number().optional().describe("Items per page"),
    category_id: z.string().optional().describe("Filter by category ID"),
  },
  ({ page, limit, category_id }) =>
    handle(() => api.listArticles({ page, limit, category_id }))
);

server.tool(
  "get_article",
  "Get a blog article by ID",
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
    content: z.string().describe("Article HTML content"),
    summary: z.string().optional().describe("Article summary"),
    category_id: z.string().optional().describe("Category ID"),
    tags: z.array(z.string()).optional().describe("Article tags"),
    images: z.array(z.string()).optional().describe("Image URLs"),
    is_hidden: z.boolean().default(false).describe("Hidden from public"),
  },
  (params) => handle(() => api.createArticle(params))
);

server.tool(
  "update_article",
  "Update a blog article",
  {
    id: z.string().describe("Article ID"),
    name: z.string().optional().describe("Updated title"),
    slug: z.string().optional().describe("Updated slug"),
    content: z.string().optional().describe("Updated HTML content"),
    summary: z.string().optional().describe("Updated summary"),
    category_id: z.string().optional().describe("Category ID"),
    tags: z.array(z.string()).optional().describe("Article tags"),
    is_hidden: z.boolean().optional().describe("Hidden from public"),
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
  "Find a customer by ID, phone, or email",
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
  "Send an email via CMS automation",
  {
    to: z.string().describe("Recipient email address"),
    subject: z.string().describe("Email subject"),
    body: z.string().describe("Email body (HTML supported)"),
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
