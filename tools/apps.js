import { z } from "zod";

export function registerAppTools(server, api, handle) {
  server.tool(
    "list_apps",
    "List all installed applications/subscriptions of the site. Returns app type, status, and settings",
    {},
    () => handle(() => api.listApps())
  );

  server.tool(
    "get_app",
    "Get a specific installed app by type ID. Common types: 1=CMS, 2=Product Design, 10=Multilingual, etc.",
    {
      type: z.string().describe("App type ID"),
    },
    ({ type }) => handle(() => api.getApp(type))
  );
}
