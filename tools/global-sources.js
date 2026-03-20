import { z } from "zod";

/**
 * Global Sources tools — manage site-wide components: cart, popup, overview, etc.
 *
 * Source structure: same as page source — { sections: [{ id, type, style, config, specials, children }] }
 *
 * Improvements over page tools:
 * - 30s cache (fetch once, reuse across tools)
 * - No `component` needed for detail/search/element tools — auto-resolved from cache
 * - Compact tree text output (3-5x token savings vs JSON)
 * - Element-level update tools (shallow merge, same as pages)
 * - Safeguard on full source update (block if data shrinks >50%)
 */

// ── Source tree helpers ──

function parseSource(sourceJson) {
  try {
    return typeof sourceJson === "string" ? JSON.parse(sourceJson) : sourceJson;
  } catch {
    return null;
  }
}

function walkSource(source, fn) {
  if (!source || !source.sections) return;
  function walk(node) {
    if (!node) return true;
    if (fn(node) === false) return false;
    for (const child of node.children || []) {
      if (walk(child) === false) return false;
    }
    return true;
  }
  for (const section of source.sections) {
    if (walk(section) === false) return;
  }
}

function buildOverview(source) {
  const typeCounts = {};
  const customClasses = new Set();
  let total = 0;
  walkSource(source, (node) => {
    total++;
    const t = node.type || "unknown";
    typeCounts[t] = (typeCounts[t] || 0) + 1;
    const cc = node.specials && node.specials.custom_class;
    if (cc) cc.split(",").map((s) => s.trim()).filter(Boolean).forEach((c) => customClasses.add(c));
  });
  return {
    sections: (source.sections || []).length,
    elements: total,
    types: typeCounts,
    classes: [...customClasses].sort(),
  };
}

function nodeToDetail(node) {
  const entry = { id: node.id || "", type: node.type || "unknown" };
  if (node.style && Object.keys(node.style).length) entry.style = node.style;
  if (node.config && Object.keys(node.config).length) entry.config = node.config;
  if (node.specials && Object.keys(node.specials).length) entry.specials = node.specials;
  if (node.events && node.events.length) entry.events = node.events;
  if (node.bindings && node.bindings.length) entry.bindings = node.bindings;
  for (const key of Object.keys(node)) {
    if (/^bp\d+$/.test(key) && node[key] && typeof node[key] === "object") {
      if (!entry.responsive) entry.responsive = {};
      entry.responsive[key] = node[key];
    }
  }
  if (node.children && node.children.length) entry.children_count = node.children.length;
  return entry;
}

function findNodeById(source, elementId) {
  let found = null;
  walkSource(source, (node) => {
    if (node.id === elementId) { found = node; return false; }
  });
  return found;
}

function applyNodeUpdates(node, updates) {
  if (updates.style) node.style = { ...(node.style || {}), ...updates.style };
  if (updates.config) node.config = { ...(node.config || {}), ...updates.config };
  if (updates.specials) node.specials = { ...(node.specials || {}), ...updates.specials };
  if (updates.events !== undefined) node.events = updates.events;
  if (updates.bindings !== undefined) node.bindings = updates.bindings;
  if (updates.responsive) {
    for (const [bp, val] of Object.entries(updates.responsive)) {
      if (/^bp\d+$/.test(bp)) {
        node[bp] = node[bp]
          ? { style: { ...node[bp].style, ...val.style }, config: { ...node[bp].config, ...val.config } }
          : val;
      }
    }
  }
}

function searchElements(source, filters) {
  const results = [];
  const limit = filters.limit || 50;
  walkSource(source, (node) => {
    if (results.length >= limit) return false;
    if (filters.type && node.type !== filters.type) return;
    if (filters.id && !(node.id || "").toLowerCase().includes(filters.id.toLowerCase())) return;
    if (filters.custom_class) {
      const cc = (node.specials && node.specials.custom_class) || "";
      if (!cc.toLowerCase().includes(filters.custom_class.toLowerCase())) return;
    }
    if (filters.text) {
      const text = (node.specials && node.specials.text) || "";
      if (!text.toLowerCase().includes(filters.text.toLowerCase())) return;
    }
    if (filters.has_custom_class && !(node.specials && node.specials.custom_class)) return;
    if (filters.has_bind && !(node.bindings && node.bindings.length) && !(node.specials && node.specials.bind)) return;
    if (filters.has_events && !(node.events && node.events.length)) return;
    results.push(nodeToDetail(node));
  });
  return results;
}

/**
 * Build compact tree text — 3-5x fewer tokens than JSON.
 *
 * Output example:
 *   SECTION-1 [section] (3)
 *   ├─ TEXT-1 [text] "Giỏ hàng" .cart-title
 *   ├─ CONTAINER-1 [container] .cart-items [bind] (2)
 *   │  ├─ IMAGE-1 [image] .product-img
 *   │  └─ TEXT-2 [text] "Product name"
 *   └─ BUTTON-1 [button] "Thanh toán" .checkout-btn [2ev]
 */
function buildTreeText(source) {
  if (!source || !source.sections || !source.sections.length) return "(empty)";
  const lines = [];

  function walk(node, prefix, isLast) {
    const connector = prefix === "" ? "" : (isLast ? "└─ " : "├─ ");
    const nextPrefix = prefix === "" ? "" : prefix + (isLast ? "   " : "│  ");

    let line = `${prefix}${connector}${node.id || "?"} [${node.type || "?"}]`;

    // Compact annotations
    const tags = [];
    if (node.specials) {
      if (node.specials.text) {
        const t = node.specials.text.replace(/[\n\r]+/g, " ").substring(0, 50);
        tags.push(`"${t}"`);
      }
      if (node.specials.custom_class) tags.push(`.${node.specials.custom_class.split(",")[0].trim()}`);
      if (node.specials.custom_css) tags.push("{css}");
      if (node.specials.bind) tags.push(`[bind:${node.specials.bind}]`);
    }
    if (node.bindings && node.bindings.length) tags.push(`[${node.bindings.length}bind]`);
    if (node.events && node.events.length) tags.push(`[${node.events.length}ev]`);
    if (tags.length) line += " " + tags.join(" ");

    const children = node.children || [];
    if (children.length) line += ` (${children.length})`;

    lines.push(line);
    for (let i = 0; i < children.length; i++) {
      walk(children[i], nextPrefix, i === children.length - 1);
    }
  }

  for (let i = 0; i < source.sections.length; i++) {
    walk(source.sections[i], "", i === source.sections.length - 1);
  }
  return lines.join("\n");
}

// ── Cache — fetch once, reuse 30s ──

let _gsCache = null;
let _gsCacheTime = 0;
const CACHE_TTL = 30000;

async function getCachedGlobalSources(api) {
  const now = Date.now();
  if (_gsCache && now - _gsCacheTime < CACHE_TTL) return _gsCache;

  // Fetch from both endpoints (cart uses a separate API) and merge by ID
  const [gsRes, cartRes] = await Promise.all([
    api.getGlobalSources({}).catch(() => null),
    api.getSourceCart().catch(() => null),
  ]);

  const gsList = Array.isArray(gsRes?.data) ? gsRes.data : (Array.isArray(gsRes) ? gsRes : []);
  const cartList = Array.isArray(cartRes?.data) ? cartRes.data : (Array.isArray(cartRes) ? cartRes : []);

  const byId = new Map();
  for (const item of [...gsList, ...cartList]) {
    if (item && item.id) byId.set(String(item.id), item);
  }

  _gsCache = [...byId.values()];
  _gsCacheTime = now;
  return _gsCache;
}

function invalidateGsCache() {
  _gsCache = null;
  _gsCacheTime = 0;
}

/** Resolve global source by ID from cache — no component param needed */
async function getGsWithSource(api, globalSourceId) {
  const items = await getCachedGlobalSources(api);
  if (!Array.isArray(items)) return { error: "Failed to load global sources" };
  const gs = items.find((g) => String(g.id) === String(globalSourceId));
  if (!gs) return { error: `Global source "${globalSourceId}" not found` };
  const source = parseSource(gs.source);
  return { gs, source };
}

// ── Zod schemas (reused across tools) ──

const elementUpdateShape = z.object({
  element_id: z.string().describe("Element ID"),
  style: z.record(z.any()).optional(),
  config: z.record(z.any()).optional(),
  specials: z.record(z.any()).optional(),
  events: z.array(z.record(z.any())).optional(),
  bindings: z.array(z.record(z.any())).optional(),
  responsive: z.record(z.any()).optional(),
});

// ── Tool registration ──

export function registerGlobalSourceTools(server, api, handle) {

  // ── List ──

  server.tool(
    "list_global_sources",
    `List all global sources (cart, popup, etc.). Returns compact summary per source.
Omit component to list ALL, or filter by type.`,
    {
      component: z.string().optional().describe('Filter by component type (e.g. "cart-droppable", "popup"). Omit to list all'),
    },
    ({ component }) =>
      handle(async () => {
        const items = await getCachedGlobalSources(api);
        if (!Array.isArray(items)) return items;

        const filtered = component ? items.filter((g) => g.component === component) : items;
        return {
          count: filtered.length,
          global_sources: filtered.map((gs) => {
            const source = parseSource(gs.source);
            const ov = source ? buildOverview(source) : null;
            return { id: gs.id, component: gs.component, type: gs.type, elements: ov ? ov.elements : 0, sections: ov ? ov.sections : 0 };
          }),
          hint: "Use get_global_source_detail for full element tree (only global_source_id needed).",
        };
      })
  );

  server.tool(
    "get_source_cart",
    `Get all cart global sources with compact tree view.
Shows full element hierarchy — no need to call get_global_source_detail separately.`,
    {},
    () =>
      handle(async () => {
        const items = await getCachedGlobalSources(api);
        if (!Array.isArray(items)) return items;

        const carts = items.filter((g) => g.component === "cart-droppable");
        return {
          count: carts.length,
          carts: carts.map((gs) => {
            const source = parseSource(gs.source);
            return {
              id: gs.id,
              type: gs.type,
              overview: source ? buildOverview(source) : null,
              tree: source ? buildTreeText(source) : "(empty)",
            };
          }),
          hint: "Use get_global_source_element for full style/config. Use update_global_source_element to modify.",
        };
      })
  );

  // ── Detail ──

  server.tool(
    "get_global_source_detail",
    `Get full detail of a global source — compact tree view showing all elements.
Each line: ID [type] "text" .class [events] [bindings] (children_count).
No component param needed — auto-resolved from cache.`,
    {
      global_source_id: z.string().describe("Global source ID"),
    },
    ({ global_source_id }) =>
      handle(async () => {
        const { gs, source, error } = await getGsWithSource(api, global_source_id);
        if (error) return { error };

        return {
          id: gs.id,
          component: gs.component,
          type: gs.type,
          overview: source ? buildOverview(source) : null,
          tree: source ? buildTreeText(source) : "(empty)",
          hint: "Use get_global_source_element for full style/config of a specific element. Use search_global_source_elements to filter.",
        };
      })
  );

  // ── Element search & detail ──

  server.tool(
    "search_global_source_elements",
    `Search/filter elements within a global source. No component param needed.
Examples:
- Find all buttons: type="button"
- Find by class: custom_class="hero"
- Find text: text="subscribe"
- Data-bound only: has_bind=true
- With events: has_events=true
- With custom class: has_custom_class=true`,
    {
      global_source_id: z.string().describe("Global source ID"),
      type: z.string().optional().describe("Filter by element type (e.g. 'text', 'button', 'image', 'container', 'section')"),
      id: z.string().optional().describe("Filter by element ID substring (e.g. 'TEXT', 'BUTTON-3')"),
      custom_class: z.string().optional().describe("Filter by custom class substring"),
      text: z.string().optional().describe("Filter by text content substring"),
      has_custom_class: z.boolean().optional().describe("Only elements with custom class"),
      has_bind: z.boolean().optional().describe("Only elements with data bindings"),
      has_events: z.boolean().optional().describe("Only elements with events"),
      limit: z.number().default(50).describe("Max results (default 50)"),
    },
    ({ global_source_id, ...filters }) =>
      handle(async () => {
        const { source, error } = await getGsWithSource(api, global_source_id);
        if (error) return { error };
        if (!source) return { error: "Global source has no source data" };

        const results = searchElements(source, filters);
        return { global_source_id, matched: results.length, elements: results };
      })
  );

  server.tool(
    "get_global_source_element",
    "Get full detail of a single element (style, config, specials, events, bindings, responsive, children). No component needed.",
    {
      global_source_id: z.string().describe("Global source ID"),
      element_id: z.string().describe("Element ID (e.g. 'TEXT-3', 'BUTTON-1')"),
    },
    ({ global_source_id, element_id }) =>
      handle(async () => {
        const { source, error } = await getGsWithSource(api, global_source_id);
        if (error) return { error };
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

  // ── Element-level updates (shallow merge, same as page tools) ──

  server.tool(
    "update_global_source_element",
    `Update a single element within a global source. Finds by ID, merges, saves back.
- style: shallow merge (only send changed CSS props)
- config: shallow merge
- specials: shallow merge (text, custom_class, custom_css individually)
- events: replaces entire array
- bindings: replaces entire array
- responsive: merge by breakpoint key (bp1, bp2)`,
    {
      global_source_id: z.string().describe("Global source ID"),
      element_id: z.string().describe("Element ID to update (e.g. 'TEXT-3', 'BUTTON-1')"),
      style: z.record(z.any()).optional().describe("CSS style properties to merge"),
      config: z.record(z.any()).optional().describe("Config properties to merge"),
      specials: z.record(z.any()).optional().describe("Specials to merge (text, custom_class, custom_css)"),
      events: z.array(z.record(z.any())).optional().describe("Complete events array (replaces existing)"),
      bindings: z.array(z.record(z.any())).optional().describe("Complete bindings array (replaces existing)"),
      responsive: z.record(z.any()).optional().describe("Responsive overrides (e.g. {bp1: {style: {...}}})"),
    },
    ({ global_source_id, element_id, ...updates }) =>
      handle(async () => {
        const { gs, source, error } = await getGsWithSource(api, global_source_id);
        if (error) return { error };
        if (!source) return { error: "Global source has no source data" };

        const node = findNodeById(source, element_id);
        if (!node) return { error: `Element "${element_id}" not found` };

        applyNodeUpdates(node, updates);
        const newSource = JSON.stringify(source);

        // Route to correct API based on component type
        const isCart = gs.component === "cart-droppable";
        if (isCart) {
          await api.updateSourceCart({ source: newSource, type: gs.type, site_id: api.siteId });
        } else {
          await api.updateGlobalSource({ global_source_id, source: newSource, type: gs.component, site_id: api.siteId });
        }
        invalidateGsCache();

        return { success: true, element: nodeToDetail(node) };
      })
  );

  server.tool(
    "update_global_source_elements",
    `Batch update multiple elements in one global source.
Same merge rules as update_global_source_element: style/config/specials are shallow-merged, events/bindings are replaced.`,
    {
      global_source_id: z.string().describe("Global source ID"),
      updates: z.array(elementUpdateShape).describe("Array of element updates"),
    },
    ({ global_source_id, updates: elementUpdates }) =>
      handle(async () => {
        const { gs, source, error } = await getGsWithSource(api, global_source_id);
        if (error) return { error };
        if (!source) return { error: "Global source has no source data" };

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
        const isCart = gs.component === "cart-droppable";
        if (isCart) {
          await api.updateSourceCart({ source: newSource, type: gs.type, site_id: api.siteId });
        } else {
          await api.updateGlobalSource({ global_source_id, source: newSource, type: gs.component, site_id: api.siteId });
        }
        invalidateGsCache();

        return { success: true, updated: results };
      })
  );

  // ── CRUD ──

  server.tool(
    "create_global_source",
    `Create a new global source component. Component types: "cart-droppable" (cart), "popup", or any custom type.`,
    {
      component: z.string().describe('Component type (e.g. "cart-droppable", "popup")'),
      source: z.any().describe("Source configuration (sections/elements JSON)"),
      type: z.string().default("default").describe('Type variant (default: "default")'),
    },
    ({ component, source, type }) =>
      handle(async () => {
        const params = { component, source, type, site_id: api.siteId };
        const res = component === "cart-droppable"
          ? await api.createSourceCart(params)
          : await api.createGlobalSource(params);
        invalidateGsCache();
        return res;
      })
  );

  server.tool(
    "update_global_source",
    `Replace full source of a global source. Safeguarded: blocks if new source is <50% of existing size (likely data loss).
For element-level changes, prefer update_global_source_element instead.`,
    {
      global_source_id: z.string().describe("Global source ID"),
      source: z.any().describe("New source configuration (JSON object)"),
    },
    ({ global_source_id, source: newSourceInput }) =>
      handle(async () => {
        const { gs, source: existingSource, error } = await getGsWithSource(api, global_source_id);
        if (error) return { error };

        const newSourceStr = typeof newSourceInput === "string" ? newSourceInput : JSON.stringify(newSourceInput);

        // Safeguard: block if new source is suspiciously smaller
        if (existingSource) {
          const existingStr = JSON.stringify(existingSource);
          if (existingStr.length > 200 && newSourceStr.length < existingStr.length * 0.5) {
            return {
              error: `BLOCKED: New source (${newSourceStr.length} chars) is much smaller than existing (${existingStr.length} chars) — ${Math.round((newSourceStr.length / existingStr.length) * 100)}% of original. Use get_global_source_detail to read existing data first, or use update_global_source_element for targeted changes.`,
              existing_length: existingStr.length,
              new_length: newSourceStr.length,
            };
          }
        }

        const isCart = gs.component === "cart-droppable";
        if (isCart) {
          await api.updateSourceCart({ source: newSourceStr, type: gs.type, site_id: api.siteId });
        } else {
          await api.updateGlobalSource({ global_source_id, source: newSourceStr, type: gs.component, site_id: api.siteId });
        }
        invalidateGsCache();

        return { success: true, global_source_id, new_length: newSourceStr.length };
      })
  );

  server.tool(
    "delete_global_source",
    "Delete a global source and its published version",
    {
      global_source_id: z.string().describe("Global source ID to delete"),
    },
    ({ global_source_id }) =>
      handle(async () => {
        const res = await api.deleteGlobalSource({ global_source_id, site_id: api.siteId });
        invalidateGsCache();
        return res;
      })
  );

  // ── Multilingual contents ──

  server.tool(
    "get_global_source_contents",
    "Get multilingual contents for global sources by component type",
    {
      component: z.string().describe('Component type (e.g. "cart-droppable", "popup")'),
    },
    ({ component }) =>
      handle(() => api.getGlobalSourceContents({ site_id: api.siteId, component }))
  );

  server.tool(
    "update_global_source_contents",
    `Update multilingual contents (upsert). Each entry: global_source_id, language_code, content.`,
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
