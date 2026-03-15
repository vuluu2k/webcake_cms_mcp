import { z } from "zod";

export function registerAutomationTools(server, api, handle) {
  server.tool(
    "send_mail",
    "Send email via CMS automation",
    {
      to: z.string().describe("Recipient email"),
      subject: z.string().describe("Email subject"),
      body: z.string().describe("Email body (supports HTML)"),
    },
    (params) => handle(() => api.sendMail(params))
  );
}
