import { z } from "zod";
import { CUSTOM_CODE_GUIDE } from "../guides.js";

/**
 * Extract a compact flat list from page source JSON.
 *
 * Source structure (from builder):
 *   { sections: [{ id, type, style, config, specials, children: [...] }] }
 *
 * Rendered HTML uses:
 *   - Sections: <section id="SECTION-1" class="x-section {custom_class}">
 *   - Elements: <div id="TEXT-1" class="x-element {custom_class}">
 *   - custom_class comes from specials.custom_class (comma-separated)
 *
 * Returns a flat list of all elements (id, type, custom_class) — no nested tree.
 */
function extractSourceInfo(sourceJson) {
  let source;
  try {
    source = typeof sourceJson === "string" ? JSON.parse(sourceJson) : sourceJson;
  } catch {
    return null;
  }
  if (!source || !source.sections) return null;

  const elements = [];

  function walk(node) {
    if (!node) return;
    const type = node.type || "unknown";
    const id = node.id || "";

    const entry = { id, type };

    // Extract custom classes from specials.custom_class
    const cc = node.specials && node.specials.custom_class;
    if (cc) {
      const classes = cc.split(",").map((s) => s.trim()).filter(Boolean);
      if (classes.length) entry.custom_class = classes;
    }

    // Include specials hints for context
    if (node.specials) {
      if (node.specials.global) entry.global = node.specials.global;
      if (node.specials.bind) entry.bind = node.specials.bind;
    }

    elements.push(entry);

    // Recurse all children — no depth limit
    const children = node.children || [];
    for (const child of children) {
      walk(child);
    }
  }

  for (const section of source.sections) {
    walk(section);
  }

  return elements;
}

export function registerPageTools(server, api, handle) {
  server.tool("list_pages", "List all pages of the site (metadata only, without source)", {}, () =>
    handle(async () => {
      const res = await api.listPages();
      const pages = (res && res.data) || res || [];
      if (!Array.isArray(pages)) return res;
      return pages.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        type: p.type,
        is_homepage: p.is_homepage,
        is_build: p.is_build,
        updated_at: p.updated_at,
      }));
    })
  );

  server.tool(
    "get_page_source",
    "Get page source structure for a specific page. Returns CSS classes and element types used on the page — useful before writing custom CSS/JS to target actual elements",
    {
      page_id: z.string().describe("Page ID"),
    },
    ({ page_id }) =>
      handle(async () => {
        const res = await api.listPages();
        const pages = (res && res.data) || res || [];
        const page = Array.isArray(pages) ? pages.find((p) => p.id === page_id) : null;
        if (!page) return { error: "Page not found" };

        const sourceData = page.source && page.source.source;
        const elements = extractSourceInfo(sourceData);
        return {
          page: { id: page.id, name: page.name, slug: page.slug, type: page.type },
          custom_code: (page.source && page.source.custom_code) || null,
          elements,
          hint: "Target elements via CSS: #ELEMENT-ID or .custom-class. All elements render with class 'x-element', sections with 'x-section'.",
        };
      })
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
}
