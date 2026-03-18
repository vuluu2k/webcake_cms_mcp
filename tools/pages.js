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

/** Walk all nodes in source tree, call fn(node). Return false from fn to stop early */
function walkSource(source, fn) {
  if (!source || !source.sections) return;
  function walk(node) {
    if (!node) return true;
    if (fn(node) === false) return false;
    const children = node.children || [];
    for (const child of children) {
      if (walk(child) === false) return false;
    }
    return true;
  }
  for (const section of source.sections) {
    if (walk(section) === false) return;
  }
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

  // Responsive breakpoint data (bp1, bp2, bp3, ...)
  for (const key of Object.keys(node)) {
    if (/^bp\d+$/.test(key) && node[key] && typeof node[key] === "object") {
      if (!entry.responsive) entry.responsive = {};
      entry.responsive[key] = node[key];
    }
  }

  if (node.children && node.children.length) entry.children_count = node.children.length;

  return entry;
}

/** Find a node by ID in source tree, returns reference to the node */
function findNodeById(source, elementId) {
  let found = null;
  walkSource(source, (node) => {
    if (node.id === elementId) { found = node; return false; }
  });
  return found;
}

/** Apply updates to a node in-place (shallow merge for objects, replace for arrays) */
function applyNodeUpdates(node, updates) {
  if (updates.style) node.style = { ...(node.style || {}), ...updates.style };
  if (updates.config) node.config = { ...(node.config || {}), ...updates.config };
  if (updates.specials) node.specials = { ...(node.specials || {}), ...updates.specials };
  if (updates.events !== undefined) node.events = updates.events;
  if (updates.bindings !== undefined) node.bindings = updates.bindings;
  // Responsive breakpoints (bp1, bp2, ...)
  if (updates.responsive) {
    for (const [bp, val] of Object.entries(updates.responsive)) {
      if (/^bp\d+$/.test(bp)) {
        node[bp] = node[bp] ? { style: { ...node[bp].style, ...val.style }, config: { ...node[bp].config, ...val.config } } : val;
      }
    }
  }
}

/** Search/filter elements in source by criteria */
function searchElements(source, filters) {
  const results = [];
  const limit = filters.limit || 50;

  walkSource(source, (node) => {
    if (results.length >= limit) return false;

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

/** Cache listPages for 30s to avoid repeated API calls within a session */
let _pagesCache = null;
let _pagesCacheTime = 0;
const CACHE_TTL = 30000;

async function getCachedPages(api) {
  const now = Date.now();
  if (_pagesCache && now - _pagesCacheTime < CACHE_TTL) return _pagesCache;
  const res = await api.listPages();
  _pagesCache = (res && res.data) || res || [];
  _pagesCacheTime = now;
  return _pagesCache;
}

function invalidatePageCache() {
  _pagesCache = null;
  _pagesCacheTime = 0;
}

async function getPageWithSource(api, pageId) {
  const pages = await getCachedPages(api);
  if (!Array.isArray(pages)) return { error: "Failed to load pages" };
  const page = pages.find((p) => p.id === pageId);
  if (!page) return { error: "Page not found" };
  const source = parseSource(page.source && page.source.source);
  return { page, source };
}

export function registerPageTools(server, api, handle) {
  server.tool("list_pages", "List all pages of the site (metadata only, without source)", {}, () =>
    handle(async () => {
      const pages = await getCachedPages(api);
      if (!Array.isArray(pages)) return pages;
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
        const { page, source, error } = await getPageWithSource(api, page_id);
        if (error) return { error };

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
        const { source, error } = await getPageWithSource(api, page_id);
        if (error) return { error };
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
      handle(async () => {
        const res = await api.createPage({ name, slug, type, is_homepage });
        invalidatePageCache();
        return res;
      })
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
    ({ page_id, ...params }) => handle(async () => {
      const res = await api.updatePage(page_id, params);
      invalidatePageCache();
      return res;
    })
  );

  server.tool(
    "get_site_custom_code",
    `Get custom code of the site (CSS/JS). Two modes:
- Default: returns ALL 4 code fields (full content)
- With field filter: returns only the specified field(s) — saves tokens when you only need CSS or JS
Add include_guide=true on first call to get the coding guide`,
    {
      fields: z.array(z.enum(["code_before_head", "code_before_body", "code_custom_css", "code_custom_javascript"]))
        .optional()
        .describe("Only return specific fields (e.g. ['code_custom_css']). Omit to get all 4 fields"),
      include_guide: z.boolean().default(false).describe("Include the custom code coding guide (only needed on first call)"),
    },
    ({ fields, include_guide }) =>
      handle(async () => {
        const allFields = ["code_before_head", "code_before_body", "code_custom_css", "code_custom_javascript"];
        const selected = fields && fields.length ? fields : allFields;
        const values = await Promise.all(selected.map((f) => api.getSiteSettingField(f)));
        const res = {};
        for (let i = 0; i < selected.length; i++) {
          res[selected[i]] = values[i] || "";
        }
        if (!fields || !fields.length) {
          res._sizes = {};
          for (const f of allFields) {
            res._sizes[f] = (res[f] || "").length;
          }
        }
        if (include_guide) res.guide = CUSTOM_CODE_GUIDE;
        return res;
      })
  );

  server.tool(
    "update_site_custom_code",
    `Update custom code (CSS/JS) for the entire site. Only sends fields you specify — others remain unchanged.
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
    "append_site_custom_code",
    `Append or prepend code to a custom code field WITHOUT reading the existing content first.
Use this when you need to ADD new CSS rules, JS code, or script tags — no need to read first.
For full rewrites, use update_site_custom_code instead.`,
    {
      field: z.enum(["code_before_head", "code_before_body", "code_custom_css", "code_custom_javascript"])
        .describe("Which code field to modify"),
      code: z.string().describe("Code to add"),
      position: z.enum(["append", "prepend"]).default("append").describe("Add to end (append) or beginning (prepend)"),
    },
    ({ field, code, position }) =>
      handle(async () => {
        const existing = await api.getSiteSettingField(field);
        let content = existing || "";

        if (position === "prepend") {
          content = code.trimEnd() + "\n\n" + content.trimStart();
        } else {
          content = content.trimEnd() + "\n\n" + code.trimEnd() + "\n";
        }

        await api.updateSiteSettings({ [field]: content });
        return { success: true, field, position, new_length: content.length };
      })
  );

  server.tool(
    "delete_page",
    "Delete a page",
    {
      page_id: z.string().describe("Page ID to delete"),
    },
    ({ page_id }) => handle(async () => {
      const res = await api.deletePage({ page_id });
      invalidatePageCache();
      return res;
    })
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

  // ── Element interaction tools ──

  server.tool(
    "get_page_element",
    "Get full detail of a single element by its ID (e.g. 'TEXT-3', 'BUTTON-1', 'SECTION-2'). Returns style, config, specials, events, bindings, responsive, and children IDs",
    {
      page_id: z.string().describe("Page ID"),
      element_id: z.string().describe("Element ID (e.g. 'TEXT-3', 'BUTTON-1')"),
    },
    ({ page_id, element_id }) =>
      handle(async () => {
        const { source, error } = await getPageWithSource(api, page_id);
        if (error) return { error };
        if (!source) return { error: "Page has no source" };

        const node = findNodeById(source, element_id);
        if (!node) return { error: `Element "${element_id}" not found` };

        const detail = nodeToDetail(node);
        if (node.children && node.children.length) {
          detail.children = node.children.map((c) => ({ id: c.id, type: c.type }));
        }
        return detail;
      })
  );

  server.tool(
    "update_page_element",
    `Update properties of a specific element in page source. Finds the element by ID, merges updates, saves back.
- style: shallow merge with existing (only send changed CSS properties)
- config: shallow merge with existing
- specials: shallow merge (update text, custom_class, custom_css individually)
- events: replaces entire events array
- bindings: replaces entire bindings array
- responsive: merge by breakpoint key (e.g. "bp1", "bp2"). Each bp contains {style, config}`,
    {
      page_id: z.string().describe("Page ID"),
      element_id: z.string().describe("Element ID to update (e.g. 'TEXT-3', 'BUTTON-1')"),
      style: z.record(z.any()).optional().describe("CSS style properties to merge (e.g. {color: '#fff', 'font-size': '16px'})"),
      config: z.record(z.any()).optional().describe("Config properties to merge"),
      specials: z.record(z.any()).optional().describe("Specials to merge (text, custom_class, custom_css, etc.)"),
      events: z.array(z.record(z.any())).optional().describe("Complete events array (replaces existing)"),
      bindings: z.array(z.record(z.any())).optional().describe("Complete bindings array (replaces existing)"),
      responsive: z.record(z.any()).optional().describe("Responsive breakpoint overrides (e.g. {bp1: {style: {...}, config: {...}}})"),
    },
    ({ page_id, element_id, ...updates }) =>
      handle(async () => {
        const { page, source, error } = await getPageWithSource(api, page_id);
        if (error) return { error };
        if (!source) return { error: "Page has no source" };

        const node = findNodeById(source, element_id);
        if (!node) return { error: `Element "${element_id}" not found` };

        applyNodeUpdates(node, updates);
        const newSource = JSON.stringify(source);
        const res = await api.updatePageSource(page_id, { source: newSource });
        invalidatePageCache();

        // Verify backend persisted the change
        const saved = res && res.data;
        if (!saved) return { error: "Backend returned empty response — update may not have persisted", sent_length: newSource.length };

        return { success: true, element: nodeToDetail(node), page_source_id: saved.id };
      })
  );

  server.tool(
    "update_page_elements",
    `Batch update multiple elements in one page. Each update specifies element_id and properties to change.
Same merge rules as update_page_element: style/config/specials are shallow-merged, events/bindings are replaced`,
    {
      page_id: z.string().describe("Page ID"),
      updates: z.array(z.object({
        element_id: z.string().describe("Element ID"),
        style: z.record(z.any()).optional(),
        config: z.record(z.any()).optional(),
        specials: z.record(z.any()).optional(),
        events: z.array(z.record(z.any())).optional(),
        bindings: z.array(z.record(z.any())).optional(),
        responsive: z.record(z.any()).optional(),
      })).describe("Array of element updates"),
    },
    ({ page_id, updates: elementUpdates }) =>
      handle(async () => {
        const { page, source, error } = await getPageWithSource(api, page_id);
        if (error) return { error };
        if (!source) return { error: "Page has no source" };

        const results = [];
        for (const upd of elementUpdates) {
          const node = findNodeById(source, upd.element_id);
          if (!node) {
            results.push({ element_id: upd.element_id, error: "Not found" });
            continue;
          }
          const { element_id, ...updates } = upd;
          applyNodeUpdates(node, updates);
          results.push({ element_id, success: true });
        }

        const newSource = JSON.stringify(source);
        const res = await api.updatePageSource(page_id, { source: newSource });
        invalidatePageCache();

        const saved = res && res.data;
        if (!saved) return { error: "Backend returned empty response — update may not have persisted", sent_length: newSource.length };

        return { success: true, updated: results, page_source_id: saved.id };
      })
  );

  server.tool(
    "update_page_source",
    `Directly update the full page source JSON. Use this when you need to replace the entire source or when element-level updates don't persist.
Sends the source directly to the backend API and returns the saved result for verification.`,
    {
      page_id: z.string().describe("Page ID"),
      source: z.any().describe("Full page source object (sections tree) or JSON string"),
      custom_code: z.string().optional().describe("Custom code (CSS/JS) for this page"),
    },
    ({ page_id, source, custom_code }) =>
      handle(async () => {
        const body = {};
        if (source != null) {
          body.source = typeof source === "string" ? source : JSON.stringify(source);
        }
        if (custom_code != null) {
          body.custom_code = custom_code;
        }

        const res = await api.updatePageSource(page_id, body);
        invalidatePageCache();

        const saved = res && res.data;
        if (!saved) return { error: "Backend returned empty response — update may not have persisted" };

        return {
          success: true,
          page_source_id: saved.id,
          page_id: saved.page_id,
          source_length: (saved.source || "").length,
        };
      })
  );

}
