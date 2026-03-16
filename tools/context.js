import { z } from "zod";
import { getConfig, setConfig } from "../db.js";

/**
 * Apply saved context on startup.
 * Saved site_id overrides env var. Token is NOT saved (security).
 */
export function applySavedContext(api) {
  const savedSiteId = getConfig("site_id");
  if (savedSiteId) {
    api.switchSite(savedSiteId);
  }
}

// ── Tools ──

export function registerContextTools(server, api, handle) {
  server.tool(
    "get_current_context",
    "Show current connection context: which site_id, API URL, and account info. Call this first to confirm you're working on the right site",
    {},
    () =>
      handle(async () => {
        const [me, site] = await Promise.all([
          api.getMe().catch(() => null),
          api.getSiteInfo().catch(() => null),
        ]);

        return {
          api_url: api.baseUrl,
          site_id: api.siteId,
          site_name: site?.data?.name || null,
          site_domain: site?.data?.domain || site?.data?.sub_domain || null,
          account: me?.data
            ? {
                id: me.data.id,
                email: me.data.email,
                name: [me.data.first_name, me.data.last_name].filter(Boolean).join(" ") || null,
              }
            : null,
          hint: "Use list_my_sites to see all sites, switch_site to change site",
        };
      })
  );

  server.tool(
    "list_my_sites",
    "List all sites accessible by the current account. Use this to find a site_id before switching",
    {
      page: z.number().default(1).describe("Page number"),
      limit: z.number().default(20).describe("Items per page"),
      term: z.string().optional().describe("Search by site name"),
    },
    ({ page, limit, term }) =>
      handle(async () => {
        const res = await api.listMySites({ page, limit, ...(term && { term }) });
        const sites = (res?.data || []).map((s) => ({
          id: s.id,
          name: s.name,
          domain: s.domain || s.sub_domain || null,
          is_current: s.id === api.siteId,
        }));
        return {
          current_site_id: api.siteId,
          sites,
          total: res?.total_entries || sites.length,
          page,
        };
      })
  );

  server.tool(
    "switch_site",
    `Switch to a different site by site_id. All subsequent tool calls will target the new site.
The choice is saved to local database — next session will auto-connect to this site.
Use list_my_sites first to find the site_id`,
    {
      site_id: z.string().describe("The site ID to switch to"),
    },
    ({ site_id }) =>
      handle(async () => {
        const oldSiteId = api.siteId;
        api.switchSite(site_id);

        // Verify the new site is accessible
        const site = await api.getSiteInfo().catch(() => null);
        if (!site?.data) {
          api.switchSite(oldSiteId);
          throw new Error(`Cannot access site "${site_id}". Check the ID or your permissions.`);
        }

        // Persist for next session
        setConfig("site_id", api.siteId);
        setConfig("site_name", site.data.name || "");
        setConfig("site_domain", site.data.domain || site.data.sub_domain || "");

        return {
          switched: true,
          saved: true,
          previous_site_id: oldSiteId,
          current_site_id: api.siteId,
          site_name: site.data.name,
          site_domain: site.data.domain || site.data.sub_domain || null,
        };
      })
  );

  server.tool(
    "update_auth_token",
    `Update the authentication token. Use this when the current token expires or you need to switch accounts.
All subsequent API calls will use the new token`,
    {
      token: z.string().describe("New JWT Bearer token"),
    },
    ({ token }) =>
      handle(async () => {
        const oldToken = api.token;
        api.switchToken(token);

        // Verify the new token works
        const me = await api.getMe().catch(() => null);
        if (!me?.data) {
          api.switchToken(oldToken);
          throw new Error("Invalid token — authentication failed. Token was NOT changed.");
        }

        return {
          updated: true,
          account: {
            id: me.data.id,
            email: me.data.email,
            name: [me.data.first_name, me.data.last_name].filter(Boolean).join(" ") || null,
          },
          current_site_id: api.siteId,
        };
      })
  );
}
