// Offline tests for the page-creation rules (no backend needed):
//  - main/error/maintain are one-per-site,
//  - slugs are unique per site,
//  - 'custom' pages are unlimited,
//  - every page created through the MCP is stamped by_ai.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPageCreateConflict } from "../dist/tools/builder.js";
import { WebcakeCmsApi, BY_AI_MARKER } from "../dist/api.js";

// A site with the pages a real storefront starts with.
const PAGES = [
  { id: "p-home", name: "Trang chủ", slug: null, type: 1, is_homepage: true },
  { id: "p-cart", name: "Giỏ hàng", slug: "cart", type: 2, is_homepage: false },
  { id: "p-404", name: "404", slug: "error", type: 6, is_homepage: false },
  { id: "p-about", name: "Về chúng tôi", slug: "about", type: 5, is_homepage: false },
];

const api = (pages = PAGES) => ({ listPages: async () => ({ data: pages }) });

test("a second homepage is refused and points at the existing page", async () => {
  const byKind = await checkPageCreateConflict(api(), { kind: "main", slug: "home-2" });
  assert.ok(byKind, "type main must be refused when a homepage exists");
  assert.equal(byKind.existing_page.id, "p-home");

  const byFlag = await checkPageCreateConflict(api(), { slug: "home-2", is_homepage: true });
  assert.ok(byFlag, "is_homepage:true must be refused when a homepage exists");
  assert.equal(byFlag.existing_page.id, "p-home");
});

test("error / maintain are one per site", async () => {
  assert.ok(await checkPageCreateConflict(api(), { kind: "error", slug: "error-2" }));
  // No maintain page yet -> allowed.
  assert.equal(await checkPageCreateConflict(api(), { kind: "maintain", slug: "maintain" }), null);
});

test("store is NOT singleton — checkout is allowed next to cart, a 2nd cart is not", async () => {
  assert.equal(await checkPageCreateConflict(api(), { kind: "store", slug: "checkout" }), null);
  const dup = await checkPageCreateConflict(api(), { kind: "store", slug: "cart" });
  assert.ok(dup, "a duplicate slug must be refused");
  assert.equal(dup.existing_page.id, "p-cart");
});

test("custom pages are unlimited as long as the slug is free", async () => {
  assert.equal(await checkPageCreateConflict(api(), { kind: "custom", slug: "landing-1" }), null);
  assert.equal(await checkPageCreateConflict(api(), { kind: "custom", slug: "landing-2" }), null);
  assert.ok(await checkPageCreateConflict(api(), { kind: "custom", slug: "about" }));
});

test("a leading slash does not sneak a duplicate slug past the check", async () => {
  assert.ok(await checkPageCreateConflict(api(), { kind: "store", slug: "/cart" }));
});

test("a failed page lookup never blocks the create", async () => {
  const broken = { listPages: async () => { throw new Error("network down"); } };
  assert.equal(await checkPageCreateConflict(broken, { kind: "main" }), null);
});

test("createPage stamps by_ai so the builder can tag AI-authored pages", async () => {
  const client = new WebcakeCmsApi({ baseUrl: "http://x", token: "t", siteId: "s" });
  let sent;
  client.request = async (_m, _p, opts) => { sent = opts.body; return { data: { id: "new" } }; };

  await client.createPage({ name: "AI page" });
  assert.equal(sent.by_ai, BY_AI_MARKER);

  // An explicit marker wins over the default.
  await client.createPage({ name: "AI page", by_ai: "agent" });
  assert.equal(sent.by_ai, "agent");
});
