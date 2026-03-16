# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

An MCP (Model Context Protocol) server that exposes WebCake CMS features as tools for AI agents. It acts as a bridge between AI IDEs (Claude Desktop, Claude Code, Cursor, Windsurf, Augment) and the WebCake/StoreCake CMS backend API.

## Commands

```bash
npm install          # Install dependencies
npm start            # Run the MCP server (node index.js)
node index.js        # Direct run (requires env vars)
./install.sh         # Interactive installer for macOS/Linux
./update.sh          # Update to latest version
```

The server communicates over stdio (stdin/stdout) using the MCP protocol — it is not an HTTP server.

## Required Environment Variables

- `WEBCAKE_API_URL` — Backend API base URL (e.g. `https://api.storecake.io`)
- `WEBCAKE_TOKEN` — JWT Bearer token from the WebCake dashboard
- `WEBCAKE_SITE_ID` — Target site ID

CMS admin token and CMS API key are auto-fetched at runtime via `api.fetchCmsTokens()` — no manual config needed.

## Architecture

```
index.js          — Entry point: creates McpServer, registers all tool modules, starts stdio transport
api.js            — WebcakeCmsApi class: all HTTP calls to the WebCake backend REST API
guides.js         — Embedded documentation strings (HTTP_FUNCTION_GUIDE, CUSTOM_CODE_GUIDE)
                    injected into tool responses so AI agents know how to write CMS code
tools/
  cms-files.js    — File management, HTTP function CRUD, debug/run, versioning (10 tools)
  pages.js        — Page CRUD, custom code (CSS/JS), page contents, global sections (9 tools)
  collections.js  — Database collection listing, schema inspection, record queries (3 tools)
  articles.js     — Blog article CRUD (5 tools)
  customers.js    — Customer lookup by ID/phone/email (1 tool)
  automation.js   — Email sending (1 tool)
```

### Key Patterns

- **Tool registration**: Each `tools/*.js` file exports a `register*Tools(server, api, handle)` function. `server` is the McpServer instance, `api` is the WebcakeCmsApi client, `handle` wraps async calls with error handling.
- **Unified error handling**: The `handle()` wrapper in `index.js` catches all errors and returns `{ isError: true }` MCP responses.
- **Schema validation**: All tool inputs validated with `zod` schemas passed directly to `server.tool()`.
- **API client**: `WebcakeCmsApi` uses native `fetch` with a 15-second timeout (`AbortController`). Auth token bundling (`fetchCmsTokens`) is called lazily before CMS file mutations.
- **Guide injection**: `get_http_function` and `get_site_custom_code` tools return embedded guides alongside data, teaching the AI agent the WebCake coding conventions (function naming, SDK usage, available globals).

### HTTP Function Convention (backend code on WebCake)

Functions follow `export const [method]_[FunctionName]` naming — e.g. `get_Products`, `post_CreateOrder`. The `webcake-data` SDK (`DBConnection`) is the built-in database layer. See `guides.js` for full reference.

## Dependencies

Only two runtime dependencies:
- `@modelcontextprotocol/sdk` — MCP protocol implementation
- `zod` — Input validation schemas

ES modules (`"type": "module"` in package.json). Node.js required.
