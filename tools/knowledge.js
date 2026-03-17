import { z } from "zod";
import { readdir, readFile } from "node:fs/promises";
import { join, extname, basename } from "node:path";

const SUPPORTED_EXTS = new Set([".md", ".txt", ".json"]);
const GITHUB_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** Parse optional YAML-like frontmatter from markdown files */
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const meta = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      meta[key] = val;
    }
  }
  return { meta, body: match[2] };
}

// ── Local files ──

function getLocalDir() {
  if (process.env.WEBCAKE_KNOWLEDGE_DIR) return process.env.WEBCAKE_KNOWLEDGE_DIR;
  const moduleDir = new URL("../", import.meta.url).pathname;
  return join(moduleDir, "knowledge");
}

async function listLocalFiles(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && SUPPORTED_EXTS.has(extname(e.name).toLowerCase()))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

// ── GitHub repo ──

/**
 * Parse repo URL/shorthand into { owner, repo, branch, path }.
 * Supports:
 *   - "owner/repo"
 *   - "owner/repo/path/to/dir"
 *   - "https://github.com/owner/repo"
 *   - "https://github.com/owner/repo/tree/main/docs"
 */
function parseRepoUrl(input) {
  let owner, repo, branch = null, path = "";

  // Full GitHub URL
  const urlMatch = input.match(
    /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/([^/]+)(?:\/(.*))?)?$/
  );
  if (urlMatch) {
    owner = urlMatch[1];
    repo = urlMatch[2];
    branch = urlMatch[3] || null;
    path = urlMatch[4] || "";
  } else {
    // Shorthand: owner/repo or owner/repo/path
    const parts = input.replace(/^\/+|\/+$/g, "").split("/");
    if (parts.length < 2) return null;
    owner = parts[0];
    repo = parts[1];
    path = parts.slice(2).join("/");
  }

  return { owner, repo, branch, path };
}

const _ghCache = { list: null, listAt: 0, files: new Map() };

async function ghFetch(url) {
  const headers = { "User-Agent": "webcake-cms-mcp", Accept: "application/vnd.github.v3+json" };
  const token = process.env.WEBCAKE_KNOWLEDGE_TOKEN;
  if (token) headers.Authorization = `token ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) throw new Error(`GitHub API ${res.status}: ${res.statusText}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function listGhFiles(parsed) {
  const now = Date.now();
  if (_ghCache.list && now - _ghCache.listAt < GITHUB_CACHE_TTL) return _ghCache.list;

  const { owner, repo, branch, path } = parsed;
  const ref = branch ? `?ref=${branch}` : "";
  const apiPath = path ? `/${path}` : "";
  const data = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/contents${apiPath}${ref}`
  );

  const files = (Array.isArray(data) ? data : [])
    .filter((f) => f.type === "file" && SUPPORTED_EXTS.has(extname(f.name).toLowerCase()))
    .map((f) => ({ name: f.name, download_url: f.download_url, sha: f.sha }));

  _ghCache.list = files;
  _ghCache.listAt = now;
  return files;
}

async function readGhFile(fileEntry) {
  const cached = _ghCache.files.get(fileEntry.sha);
  if (cached) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(fileEntry.download_url, {
      headers: { "User-Agent": "webcake-cms-mcp" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Failed to download ${fileEntry.name}`);
    const text = await res.text();
    _ghCache.files.set(fileEntry.sha, text);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

// ── Combined sources ──

function getRepoConfig() {
  const url = process.env.WEBCAKE_KNOWLEDGE_REPO;
  if (!url) return null;
  return parseRepoUrl(url);
}

// ── GitHub write operations ──

async function ghWrite(method, url, body) {
  const token = process.env.WEBCAKE_KNOWLEDGE_TOKEN;
  if (!token) throw new Error("WEBCAKE_KNOWLEDGE_TOKEN is required to write to GitHub");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "User-Agent": "webcake-cms-mcp",
        Accept: "application/vnd.github.v3+json",
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`GitHub API ${res.status}: ${err.message || res.statusText}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

function buildGhApiUrl(parsed, filePath) {
  const { owner, repo, path: basePath } = parsed;
  const full = basePath ? `${basePath}/${filePath}` : filePath;
  return `https://api.github.com/repos/${owner}/${repo}/contents/${full}`;
}

export function registerKnowledgeTools(server, handle) {
  server.tool(
    "list_knowledge",
    "List all custom knowledge/guide files. Sources: local knowledge/ directory and/or GitHub repo (WEBCAKE_KNOWLEDGE_REPO)",
    {},
    () =>
      handle(async () => {
        const items = [];

        // Local files
        const dir = getLocalDir();
        const localFiles = await listLocalFiles(dir);
        for (const file of localFiles) {
          const raw = await readFile(join(dir, file), "utf-8");
          const { meta } = parseFrontmatter(raw);
          items.push({
            file: basename(file, extname(file)),
            name: meta.name || basename(file, extname(file)),
            description: meta.description || undefined,
            tags: meta.tags || undefined,
            source: "local",
          });
        }

        // GitHub repo files
        const repoCfg = getRepoConfig();
        if (repoCfg) {
          try {
            const ghFiles = await listGhFiles(repoCfg);
            for (const f of ghFiles) {
              const raw = await readGhFile(f);
              const { meta } = parseFrontmatter(raw);
              // Skip if same filename already exists locally (local wins)
              const key = basename(f.name, extname(f.name));
              if (items.some((i) => i.file === key)) continue;
              items.push({
                file: key,
                name: meta.name || key,
                description: meta.description || undefined,
                tags: meta.tags || undefined,
                source: "github",
              });
            }
          } catch (e) {
            items.push({ file: "_error", name: "GitHub Error", description: e.message, source: "github" });
          }
        }

        if (!items.length) {
          return {
            files: [],
            hint: `No knowledge files found. Add .md/.txt files to "${dir}" or set WEBCAKE_KNOWLEDGE_REPO=owner/repo to load from GitHub.`,
          };
        }

        return { files: items };
      })
  );

  server.tool(
    "get_knowledge",
    "Read a specific knowledge/guide file. Use list_knowledge first to see available files",
    {
      file: z.string().describe("File name (without extension, e.g. 'business-rules') or full filename (e.g. 'business-rules.md')"),
    },
    ({ file }) =>
      handle(async () => {
        const fileKey = file.includes(".") ? basename(file, extname(file)) : file;

        // Try local first
        const dir = getLocalDir();
        const localFiles = await listLocalFiles(dir);
        const localMatch = localFiles.find(
          (f) => f === file || basename(f, extname(f)) === fileKey
        );
        if (localMatch) {
          const raw = await readFile(join(dir, localMatch), "utf-8");
          const { meta, body } = parseFrontmatter(raw);
          return {
            file: localMatch,
            name: meta.name || basename(localMatch, extname(localMatch)),
            content: body.trim(),
            source: "local",
          };
        }

        // Try GitHub
        const repoCfg = getRepoConfig();
        if (repoCfg) {
          try {
            const ghFiles = await listGhFiles(repoCfg);
            const ghMatch = ghFiles.find(
              (f) => f.name === file || basename(f.name, extname(f.name)) === fileKey
            );
            if (ghMatch) {
              const raw = await readGhFile(ghMatch);
              const { meta, body } = parseFrontmatter(raw);
              return {
                file: ghMatch.name,
                name: meta.name || basename(ghMatch.name, extname(ghMatch.name)),
                content: body.trim(),
                source: "github",
              };
            }
          } catch (e) {
            return { error: `GitHub error: ${e.message}` };
          }
        }

        return { error: `File "${file}" not found. Use list_knowledge to see available files.` };
      })
  );

  // ── GitHub write tools ──

  server.tool(
    "create_knowledge",
    `Create a new knowledge file on GitHub. Use markdown format with optional frontmatter.
Example content:
---
name: Business Rules
description: Core business logic and rules
tags: business, rules
---
# Business Rules
...your content...`,
    {
      filename: z.string().describe("Filename with extension (e.g. 'business-rules.md', 'api-guide.md')"),
      content: z.string().describe("File content (markdown with optional frontmatter)"),
      message: z.string().optional().describe("Git commit message (default: 'Add {filename}')"),
    },
    ({ filename, content, message }) =>
      handle(async () => {
        const repoCfg = getRepoConfig();
        if (!repoCfg) throw new Error("WEBCAKE_KNOWLEDGE_REPO is not configured");

        const url = buildGhApiUrl(repoCfg, filename);
        const res = await ghWrite("PUT", url, {
          message: message || `Add ${filename}`,
          content: Buffer.from(content).toString("base64"),
          ...(repoCfg.branch && { branch: repoCfg.branch }),
        });

        _ghCache.list = null;
        _ghCache.listAt = 0;

        return {
          success: true,
          file: filename,
          sha: res.content?.sha,
          url: res.content?.html_url,
        };
      })
  );

  server.tool(
    "update_knowledge",
    "Update an existing knowledge file on GitHub. Fetches current SHA automatically",
    {
      filename: z.string().describe("Filename to update (e.g. 'business-rules.md')"),
      content: z.string().describe("New file content (replaces entire file)"),
      message: z.string().optional().describe("Git commit message (default: 'Update {filename}')"),
    },
    ({ filename, content, message }) =>
      handle(async () => {
        const repoCfg = getRepoConfig();
        if (!repoCfg) throw new Error("WEBCAKE_KNOWLEDGE_REPO is not configured");

        const url = buildGhApiUrl(repoCfg, filename);

        // Get current SHA (required by GitHub API for updates)
        const existing = await ghFetch(url + (repoCfg.branch ? `?ref=${repoCfg.branch}` : ""));
        if (!existing?.sha) throw new Error(`File "${filename}" not found on GitHub`);

        const res = await ghWrite("PUT", url, {
          message: message || `Update ${filename}`,
          content: Buffer.from(content).toString("base64"),
          sha: existing.sha,
          ...(repoCfg.branch && { branch: repoCfg.branch }),
        });

        _ghCache.list = null;
        _ghCache.listAt = 0;
        _ghCache.files.delete(existing.sha);

        return {
          success: true,
          file: filename,
          sha: res.content?.sha,
          url: res.content?.html_url,
        };
      })
  );

  server.tool(
    "delete_knowledge",
    "Delete a knowledge file from GitHub",
    {
      filename: z.string().describe("Filename to delete (e.g. 'old-guide.md')"),
      message: z.string().optional().describe("Git commit message (default: 'Delete {filename}')"),
    },
    ({ filename, message }) =>
      handle(async () => {
        const repoCfg = getRepoConfig();
        if (!repoCfg) throw new Error("WEBCAKE_KNOWLEDGE_REPO is not configured");

        const url = buildGhApiUrl(repoCfg, filename);

        const existing = await ghFetch(url + (repoCfg.branch ? `?ref=${repoCfg.branch}` : ""));
        if (!existing?.sha) throw new Error(`File "${filename}" not found on GitHub`);

        await ghWrite("DELETE", url, {
          message: message || `Delete ${filename}`,
          sha: existing.sha,
          ...(repoCfg.branch && { branch: repoCfg.branch }),
        });

        _ghCache.list = null;
        _ghCache.listAt = 0;
        _ghCache.files.delete(existing.sha);

        return { success: true, deleted: filename };
      })
  );
}
