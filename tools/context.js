import { z } from "zod";
import { getConfig, setConfig } from "../db.js";

/** Read all saved credentials from SQLite for startup */
export function getSavedConfig() {
  return {
    token: getConfig("token") || "",
    session_id: getConfig("session_id") || "",
    site_id: getConfig("site_id") || "",
    api_url: getConfig("api_url") || "",
  };
}

// ── Tools ──

export function registerContextTools(server, api, handle) {
  server.tool(
    "get_current_context",
    "Show current connection context: which site_id, API URL, session, and account info. Call this first to confirm you're working on the right site",
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
          session_id: api.sessionId || null,
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
        const raw = res?.data?.sites || res?.data || [];
        const list = Array.isArray(raw) ? raw : [];
        const sites = list.map((s) => ({
          id: s.id,
          name: s.name,
          domain: s.domain || s.sub_domain || null,
          is_current: s.id === api.siteId,
        }));
        return {
          current_site_id: api.siteId,
          sites,
          total: res?.data?.total_entries || sites.length,
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
    "update_auth",
    `Update authentication credentials. All values are saved to local database — next session auto-restores them.
Get token and session_id from browser DevTools → Network tab → copy from any API request headers`,
    {
      token: z.string().optional().describe("JWT Bearer token (from Authorization header)"),
      session_id: z.string().optional().describe("Session ID (from x-session-id header)"),
      api_url: z.string().optional().describe("API base URL (e.g. https://api.storecake.io)"),
    },
    ({ token, session_id, api_url }) =>
      handle(async () => {
        if (!token && !session_id && !api_url) {
          throw new Error("Provide at least one of: token, session_id, api_url");
        }

        const oldToken = api.token;
        const oldSessionId = api.sessionId;
        const oldBaseUrl = api.baseUrl;

        if (api_url) api.baseUrl = api_url.replace(/\/$/, "");
        if (token) api.switchToken(token);
        if (session_id) api.switchSession(session_id);

        // Verify credentials work
        const me = await api.getMe().catch(() => null);
        if (!me?.data) {
          // Rollback
          if (token) api.switchToken(oldToken);
          if (session_id) api.switchSession(oldSessionId);
          if (api_url) api.baseUrl = oldBaseUrl;
          throw new Error("Authentication failed — credentials were NOT changed. Make sure token and session_id are both correct.");
        }

        // Persist all to SQLite
        if (token) setConfig("token", token);
        if (session_id) setConfig("session_id", session_id);
        if (api_url) setConfig("api_url", api.baseUrl);

        return {
          updated: true,
          saved: true,
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
