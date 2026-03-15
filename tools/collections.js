import { z } from "zod";

export function registerCollectionTools(server, api, handle) {
  server.tool(
    "list_collections",
    "List all database collections (tables) for the site. Returns collection names, schemas (field definitions with types), and record counts. Useful for understanding the data model before writing HTTP functions",
    {
      page: z.number().optional().describe("Page number"),
      limit: z.number().optional().describe("Items per page"),
      term: z.string().optional().describe("Search by collection name"),
    },
    ({ page, limit, term }) =>
      handle(() => api.listCollections({ page, limit, term }))
  );

  server.tool(
    "get_collection",
    "Get a specific collection's details including full schema (field names, types, constraints, references) and records",
    {
      id: z.string().describe("Collection ID"),
    },
    ({ id }) => handle(() => api.getCollection(id))
  );

  server.tool(
    "query_collection_records",
    "Query records from a collection by table name. Use to inspect existing data",
    {
      table_name: z.string().describe("Collection table name (e.g. 'subscribers', 'custom_orders')"),
      page: z.number().optional().describe("Page number"),
      limit: z.number().optional().describe("Items per page"),
    },
    ({ table_name, page, limit }) =>
      handle(() => api.queryCollectionRecords(table_name, { page, limit }))
  );
}
