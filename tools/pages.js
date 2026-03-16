import { z } from "zod";
import { CUSTOM_CODE_GUIDE } from "../guides.js";

/**
 * Page source utilities.
 *
 * Source structure (from builder):
 *   { sections: [{ id, type, style, config, specials, children: [...] }] }
 *
 * Rendered HTML uses:
 *   - Sections: <section id="SECTION-1" class="x-section {custom_class}">
 *   - Elements: <div id="TEXT-1" class="x-element {custom_class}">
 *   - custom_class comes from specials.custom_class (comma-separated)
 *   - custom_css comes from specials.custom_css (element-scoped CSS)
 *   - style object generates scoped CSS via #ELEMENT-ID { ... }
 */

function parseSource(sourceJson) {
  try {
    return typeof sourceJson === "string" ? JSON.parse(sourceJson) : sourceJson;
  } catch {
    return null;
  }
}

/** Walk all nodes in source tree, call fn(node) for each */
function walkSource(source, fn) {
  if (!source || !source.sections) return;
  function walk(node) {
    if (!node) return;
    fn(node);
    const children = node.children || [];
    for (const child of children) walk(child);
  }
  for (const section of source.sections) walk(section);
}

/** Build overview: section count, element type counts, all custom_classes */
function buildOverview(source) {
  const typeCounts = {};
  const customClasses = new Set();
  let total = 0;

  walkSource(source, (node) => {
    total++;
    const type = node.type || "unknown";
    typeCounts[type] = (typeCounts[type] || 0) + 1;
    const cc = node.specials && node.specials.custom_class;
    if (cc) cc.split(",").map((s) => s.trim()).filter(Boolean).forEach((c) => customClasses.add(c));
  });

  return {
    sections_count: (source.sections || []).length,
    total_elements: total,
    element_types: typeCounts,
    custom_classes: [...customClasses].sort(),
  };
}

/** Build full detail for a single node — all properties except children tree */
function nodeToDetail(node) {
  const entry = { id: node.id || "", type: node.type || "unknown" };

  // Core properties
  if (node.style && Object.keys(node.style).length) entry.style = node.style;
  if (node.config && Object.keys(node.config).length) entry.config = node.config;
  if (node.specials && Object.keys(node.specials).length) entry.specials = node.specials;

  // Events (click, submit, mouseenter, etc.)
  if (node.events && node.events.length) entry.events = node.events;

  // Data bindings (product, category, blog, etc.)
  if (node.bindings && node.bindings.length) entry.bindings = node.bindings;

  // Responsive breakpoint overrides (keys like "bp_768_1024", etc.)
  for (const key of Object.keys(node)) {
    if (key.startsWith("bp_") && node[key] && typeof node[key] === "object") {
      if (!entry.responsive) entry.responsive = {};
      entry.responsive[key] = node[key];
    }
  }

  if (node.children && node.children.length) entry.children_count = node.children.length;

  return entry;
}

/** Search/filter elements in source by criteria */
function searchElements(source, filters) {
  const results = [];
  const limit = filters.limit || 50;

  walkSource(source, (node) => {
    if (results.length >= limit) return;

    // Filter by type
    if (filters.type && node.type !== filters.type) return;

    // Filter by id (substring match)
    if (filters.id) {
      const nodeId = (node.id || "").toLowerCase();
      if (!nodeId.includes(filters.id.toLowerCase())) return;
    }

    // Filter by custom_class
    if (filters.custom_class) {
      const cc = (node.specials && node.specials.custom_class) || "";
      if (!cc.toLowerCase().includes(filters.custom_class.toLowerCase())) return;
    }

    // Filter by text content (substring match)
    if (filters.text) {
      const text = (node.specials && node.specials.text) || "";
      if (!text.toLowerCase().includes(filters.text.toLowerCase())) return;
    }

    // Filter: has_custom_class — only elements with custom class
    if (filters.has_custom_class) {
      const cc = node.specials && node.specials.custom_class;
      if (!cc) return;
    }

    // Filter: has_bind — only data-bound elements
    if (filters.has_bind) {
      if (!(node.bindings && node.bindings.length) && !(node.specials && node.specials.bind)) return;
    }

    // Filter: has_events — only elements with events
    if (filters.has_events) {
      if (!(node.events && node.events.length)) return;
    }

    results.push(nodeToDetail(node));
  });

  return results;
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
    "Get page source overview: section count, element type counts, and all custom CSS classes. Use this first, then use search_page_elements to find specific elements",
    {
      page_id: z.string().describe("Page ID"),
    },
    ({ page_id }) =>
      handle(async () => {
        const res = await api.listPages();
        const pages = (res && res.data) || res || [];
        const page = Array.isArray(pages) ? pages.find((p) => p.id === page_id) : null;
        if (!page) return { error: "Page not found" };

        const source = parseSource(page.source && page.source.source);
        const overview = source ? buildOverview(source) : null;
        return {
          page: { id: page.id, name: page.name, slug: page.slug, type: page.type },
          custom_code: (page.source && page.source.custom_code) || null,
          overview,
          hint: "Use search_page_elements to query specific elements by type, class, text, etc. Target via CSS: #ELEMENT-ID or .custom-class. Sections have class 'x-section', elements have 'x-element'.",
        };
      })
  );

  server.tool(
    "search_page_elements",
    `Search/filter elements within a page source. Returns matching elements with full detail (id, type, style, text, classes, etc.).
Examples:
- Find all buttons: type="button"
- Find elements with custom class: custom_class="hero"
- Find text containing "subscribe": text="subscribe"
- Find all data-bound elements: has_bind=true
- Find all elements with events: has_events=true
- Find all elements with custom CSS classes: has_custom_class=true`,
    {
      page_id: z.string().describe("Page ID"),
      type: z.string().optional().describe("Filter by element type (e.g. 'text', 'button', 'image', 'container', 'section', 'form', 'input')"),
      id: z.string().optional().describe("Filter by element ID substring (e.g. 'TEXT', 'BUTTON-3')"),
      custom_class: z.string().optional().describe("Filter by custom class substring"),
      text: z.string().optional().describe("Filter by text content substring"),
      has_custom_class: z.boolean().optional().describe("Only elements that have a custom class"),
      has_bind: z.boolean().optional().describe("Only elements with data bindings (product, category, blog)"),
      has_events: z.boolean().optional().describe("Only elements with events (click, submit, mouseenter, etc.)"),
      limit: z.number().default(50).describe("Max results (default 50)"),
    },
    ({ page_id, ...filters }) =>
      handle(async () => {
        const res = await api.listPages();
        const pages = (res && res.data) || res || [];
        const page = Array.isArray(pages) ? pages.find((p) => p.id === page_id) : null;
        if (!page) return { error: "Page not found" };

        const source = parseSource(page.source && page.source.source);
        if (!source) return { error: "Page has no source" };

        const results = searchElements(source, filters);
        return { page_id, matched: results.length, elements: results };
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
    "Get current custom code of the site (CSS/JS). Always call this before writing/updating custom code to avoid overwriting existing code. Add include_guide=true on first call to get the coding guide",
    {
      include_guide: z.boolean().default(false).describe("Include the custom code coding guide (only needed on first call)"),
    },
    ({ include_guide }) =>
      handle(async () => {
        const siteRes = await api.getSite();
        const s = (siteRes && siteRes.data && siteRes.data.settings) || {};
        const res = {
          code_before_head: s.code_before_head || "",
          code_before_body: s.code_before_body || "",
          code_custom_css: s.code_custom_css || "",
          code_custom_javascript: s.code_custom_javascript || "",
        };
        if (include_guide) res.guide = CUSTOM_CODE_GUIDE;
        return res;
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
