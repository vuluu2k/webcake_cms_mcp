import { z } from "zod";
import { HTTP_FUNCTION_GUIDE } from "../guides.js";

export function registerCmsFileTools(server, api, handle) {
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
    "Get the main HTTP function file. Returns current code and collection schemas. Add include_guide=true on first call to get the coding guide",
    {
      include_guide: z.boolean().default(false).describe("Include the HTTP function coding guide (only needed on first call)"),
    },
    ({ include_guide }) =>
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
        const res = { http_function: httpFunc, collections: schemas };
        if (include_guide) res.guide = HTTP_FUNCTION_GUIDE;
        return res;
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
}
