#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebcakeCmsApi } from "./api.js";
import { registerCmsFileTools } from "./tools/cms-files.js";
import { registerPageTools } from "./tools/pages.js";
import { registerCollectionTools } from "./tools/collections.js";
import { registerArticleTools } from "./tools/articles.js";
import { registerCustomerTools } from "./tools/customers.js";
import { registerAutomationTools } from "./tools/automation.js";
import { registerProductTools } from "./tools/products.js";
import { registerOrderTools } from "./tools/orders.js";
import { registerSiteStyleTools } from "./tools/site-style.js";
import { registerAppTools } from "./tools/apps.js";
import { registerPromotionTools } from "./tools/promotions.js";
import { registerComboTools } from "./tools/combos.js";
import { registerKnowledgeTools } from "./tools/knowledge.js";
import { registerContextTools, getSavedConfig } from "./tools/context.js";

// Priority: SQLite (saved by AI tools) > env vars (initial config)
// SQLite empty → fallback to env vars
const saved = getSavedConfig();
const BASE_URL = saved.api_url || process.env.WEBCAKE_API_URL || "";
const TOKEN = saved.token || process.env.WEBCAKE_TOKEN || "";
const SITE_ID = saved.site_id || process.env.WEBCAKE_SITE_ID || "";
const SESSION_ID = saved.session_id || process.env.WEBCAKE_SESSION_ID || "";

if (!BASE_URL) {
  console.error("Required: WEBCAKE_API_URL (env var or saved in database)");
  console.error("Use update_auth tool to set token, session_id, site_id after first run");
  process.exit(1);
}

const api = new WebcakeCmsApi({ baseUrl: BASE_URL, token: TOKEN, siteId: SITE_ID, sessionId: SESSION_ID });
const server = new McpServer({ name: "webcake-cms", version: "1.0.0" });

function result(data) {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

async function handle(fn) {
  try {
    return result(await fn());
  } catch (e) {
    return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
  }
}

// Register all tools
registerContextTools(server, api, handle);
registerCmsFileTools(server, api, handle);
registerPageTools(server, api, handle);
registerCollectionTools(server, api, handle);
registerArticleTools(server, api, handle);
registerCustomerTools(server, api, handle);
registerAutomationTools(server, api, handle);
registerProductTools(server, api, handle);
registerOrderTools(server, api, handle);
registerSiteStyleTools(server, api, handle);
registerAppTools(server, api, handle);
registerPromotionTools(server, api, handle);
registerComboTools(server, api, handle);
registerKnowledgeTools(server, handle);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
