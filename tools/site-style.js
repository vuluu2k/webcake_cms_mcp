import { z } from "zod";

export function registerSiteStyleTools(server, api, handle) {
  server.tool(
    "get_site_info",
    "Get full site information: name, domain, settings (colors, typography, layout, language, payment methods, etc.)",
    {},
    () =>
      handle(async () => {
        const res = await api.getSite();
        const site = (res && res.data) || res;
        if (!site) return { error: "Site not found" };
        return {
          id: site.id,
          name: site.name,
          domain: site.domain,
          custom_domain: site.custom_domain || undefined,
          logo: site.logo || undefined,
          favicon: site.favicon || undefined,
          settings: site.settings || {},
          created_at: site.created_at,
        };
      })
  );

  server.tool(
    "list_themes",
    "List all custom themes of the site. Returns theme name, colors, typographies, transitions, and which one is active",
    {},
    () => handle(() => api.listThemes())
  );
}
