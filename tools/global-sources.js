import { z } from "zod";

/**
 * Global Sources tools — manage site-wide components: cart, popup, overview, etc.
 *
 * Global sources store reusable component configurations (source JSON) that appear
 * across all pages. Each has a `component` type (e.g. "cart-droppable", "popup")
 * and a `type` variant (e.g. "default").
 *
 * Source structure: same as page source — { sections: [{ id, type, style, config, specials, children }] }
 */

function parseSource(sourceJson) {
  try {
    return typeof sourceJson === "string" ? JSON.parse(sourceJson) : sourceJson;
  } catch {
    return null;
  }
}

/** Walk all nodes in source tree */
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

/** Build overview of a source: section count, element types, custom classes */
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

/** Build detail for a single node */
function nodeToDetail(node) {
  const entry = { id: node.id || "", type: node.type || "unknown" };
  if (node.style && Object.keys(node.style).length) entry.style = node.style;
  if (node.config && Object.keys(node.config).length) entry.config = node.config;
  if (node.specials && Object.keys(node.specials).length) entry.specials = node.specials;
  if (node.events && node.events.length) entry.events = node.events;
  if (node.bindings && node.bindings.length) entry.bindings = node.bindings;
  if (node.children && node.children.length) entry.children_count = node.children.length;
  return entry;
}

/** Find node by ID in source tree */
function findNodeById(source, elementId) {
  let found = null;
  walkSource(source, (node) => {
    if (node.id === elementId) { found = node; return false; }
  });
  return found;
}

/** Search elements by filters */
function searchElements(source, filters) {
  const results = [];
  const limit = filters.limit || 50;

  walkSource(source, (node) => {
    if (results.length >= limit) return false;
    if (filters.type && node.type !== filters.type) return;
    if (filters.id) {
      const nodeId = (node.id || "").toLowerCase();
      if (!nodeId.includes(filters.id.toLowerCase())) return;
    }
    if (filters.custom_class) {
      const cc = (node.specials && node.specials.custom_class) || "";
      if (!cc.toLowerCase().includes(filters.custom_class.toLowerCase())) return;
    }
    if (filters.text) {
      const text = (node.specials && node.specials.text) || "";
      if (!text.toLowerCase().includes(filters.text.toLowerCase())) return;
    }
    results.push(nodeToDetail(node));
  });

  return results;
}

/** Format a global source item for response */
function formatGlobalSource(gs) {
  const source = parseSource(gs.source);
  const overview = source ? buildOverview(source) : null;
  return {
    id: gs.id,
    site_id: gs.site_id,
    type: gs.type,
    component: gs.component,
    overview,
  };
}

export function registerGlobalSourceTools(server, api, handle) {

  // ── List / Query ──

  server.tool(
    "list_global_sources",
    `List global sources (site-wide components). Component types include: "cart-droppable" (cart), "popup", and others.
Returns overview for each: section count, element types, custom classes.
Omit component to list ALL global sources, or filter by component type.`,
    {
      component: z.string().optional().describe('Filter by component type (e.g. "cart-droppable", "popup"). Omit to list all'),
    },
    ({ component }) =>
      handle(async () => {
        const query = component ? { component } : {};
        const res = await api.getGlobalSources(query);
        const items = (res && res.data) || res || [];
        if (!Array.isArray(items)) return items;
        return {
          count: items.length,
          global_sources: items.map(formatGlobalSource),
          hint: "Use get_global_source_detail to see full element tree. Use search_global_source_elements to find specific elements.",
        };
      })
  );

  server.tool(
    "get_source_cart",
    "Get all cart (cart-droppable) global sources for the site. Shortcut for list_global_sources with component='cart-droppable'",
    {},
    () =>
      handle(async () => {
        const res = await api.getSourceCart();
        const items = (res && res.data) || res || [];
        if (!Array.isArray(items)) return items;
        return {
          count: items.length,
          carts: items.map(formatGlobalSource),
        };
      })
  );

  // ── Detail ──

  server.tool(
    "get_global_source_detail",
    "Get full detail of a global source by ID — returns source overview and all top-level elements",
    {
      global_source_id: z.string().describe("Global source ID"),
      component: z.string().describe('Component type (e.g. "cart-droppable", "popup")'),
    },
    ({ global_source_id, component }) =>
      handle(async () => {
        const res = await api.getGlobalSources({ component });
        const items = (res && res.data) || res || [];
        if (!Array.isArray(items)) return { error: "Failed to load global sources" };

        const gs = items.find((g) => String(g.id) === String(global_source_id));
        if (!gs) return { error: "Global source not found" };

        const source = parseSource(gs.source);
        const overview = source ? buildOverview(source) : null;
        const topElements = source && source.sections
          ? source.sections.map((s) => ({
              id: s.id,
              type: s.type,
              children_count: (s.children || []).length,
            }))
          : [];

        return {
          id: gs.id,
          site_id: gs.site_id,
          type: gs.type,
          component: gs.component,
          overview,
          top_level_elements: topElements,
          hint: "Use search_global_source_elements to find/filter elements. Use get_global_source_element for full detail of a single element.",
        };
      })
  );

  // ── Element search & detail ──

  server.tool(
    "search_global_source_elements",
    `Search/filter elements within a global source. Same as search_page_elements but for global sources (cart, popup, etc.).
Examples: find all buttons → type="button", find by class → custom_class="hero"`,
    {
      global_source_id: z.string().describe("Global source ID"),
      component: z.string().describe('Component type (e.g. "cart-droppable", "popup")'),
      type: z.string().optional().describe("Filter by element type"),
      id: z.string().optional().describe("Filter by element ID substring"),
      custom_class: z.string().optional().describe("Filter by custom class substring"),
      text: z.string().optional().describe("Filter by text content substring"),
      limit: z.number().default(50).describe("Max results"),
    },
    ({ global_source_id, component, ...filters }) =>
      handle(async () => {
        const res = await api.getGlobalSources({ component });
        const items = (res && res.data) || res || [];
        const gs = Array.isArray(items) && items.find((g) => String(g.id) === String(global_source_id));
        if (!gs) return { error: "Global source not found" };

        const source = parseSource(gs.source);
        if (!source) return { error: "Global source has no source data" };

        const results = searchElements(source, filters);
        return { global_source_id, matched: results.length, elements: results };
      })
  );

  server.tool(
    "get_global_source_element",
    "Get full detail of a single element within a global source by element ID",
    {
      global_source_id: z.string().describe("Global source ID"),
      component: z.string().describe('Component type (e.g. "cart-droppable", "popup")'),
      element_id: z.string().describe("Element ID (e.g. 'TEXT-3', 'BUTTON-1')"),
    },
    ({ global_source_id, component, element_id }) =>
      handle(async () => {
        const res = await api.getGlobalSources({ component });
        const items = (res && res.data) || res || [];
        const gs = Array.isArray(items) && items.find((g) => String(g.id) === String(global_source_id));
        if (!gs) return { error: "Global source not found" };

        const source = parseSource(gs.source);
        if (!source) return { error: "Global source has no source data" };

        const node = findNodeById(source, element_id);
        if (!node) return { error: `Element "${element_id}" not found` };

        const detail = nodeToDetail(node);
        if (node.children && node.children.length) {
          detail.children = node.children.map((c) => ({ id: c.id, type: c.type }));
        }
        return detail;
      })
  );

  // ── Create / Update / Delete ──

  server.tool(
    "create_global_source",
    `Create a new global source component. Component types: "cart-droppable" (cart), "popup", or any custom type.
The source field should be the JSON component configuration (sections/elements tree).`,
    {
      component: z.string().describe('Component type (e.g. "cart-droppable", "popup")'),
      source: z.any().describe("Source configuration (sections/elements JSON object)"),
      type: z.string().default("default").describe('Type variant (default: "default")'),
    },
    ({ component, source, type }) =>
      handle(async () => {
        const params = { component, source, type, site_id: api.siteId };
        if (component === "cart-droppable") {
          return api.createSourceCart(params);
        }
        return api.createGlobalSource(params);
      })
  );

  server.tool(
    "update_global_source",
    "Update an existing global source's source configuration",
    {
      global_source_id: z.string().describe("Global source ID to update"),
      component: z.string().describe('Component type (e.g. "cart-droppable", "popup")'),
      source: z.any().describe("New source configuration (JSON object)"),
      type: z.string().optional().describe("Type variant (required for cart-droppable)"),
    },
    ({ global_source_id, component, source, type }) =>
      handle(async () => {
        if (component === "cart-droppable") {
          return api.updateSourceCart({ source, type, site_id: api.siteId });
        }
        return api.updateGlobalSource({ global_source_id, source, type: component, site_id: api.siteId });
      })
  );

  server.tool(
    "delete_global_source",
    "Delete a global source and its published version",
    {
      global_source_id: z.string().describe("Global source ID to delete"),
    },
    ({ global_source_id }) =>
      handle(() => api.deleteGlobalSource({ global_source_id, site_id: api.siteId }))
  );

  // ── Multilingual contents ──

  server.tool(
    "get_global_source_contents",
    "Get multilingual contents for global sources by component type. Returns translations for each language.",
    {
      component: z.string().describe('Component type (e.g. "cart-droppable", "popup")'),
    },
    ({ component }) =>
      handle(() => api.getGlobalSourceContents({ site_id: api.siteId, component }))
  );

  server.tool(
    "update_global_source_contents",
    `Update multilingual contents for global sources. Each content entry needs: global_source_id, language_code, content (JSON), site_id, type_component.
Uses upsert — existing translations are updated, new ones are created.`,
    {
      contents: z.array(z.object({
        global_source_id: z.string().describe("Global source ID"),
        language_code: z.string().describe("Language code (e.g. 'en', 'vi')"),
        content: z.any().describe("Translation content (JSON object)"),
        type_component: z.string().optional().describe("Component type"),
      })).describe("Array of content entries to upsert"),
    },
    ({ contents }) =>
      handle(() => api.updateGlobalSourceContents({
        site_id: api.siteId,
        contents: contents.map((c) => ({ ...c, site_id: api.siteId })),
      }))
  );
}
