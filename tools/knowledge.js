import { z } from "zod";
import { readdir, readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import { existsSync } from "node:fs";

const SUPPORTED_EXTS = new Set([".md", ".txt", ".json"]);

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

// ── Local directory ──

function getLocalDir() {
  if (process.env.WEBCAKE_KNOWLEDGE_DIR) return process.env.WEBCAKE_KNOWLEDGE_DIR;
  const moduleDir = new URL("../", import.meta.url).pathname;
  return join(moduleDir, "knowledge");
}

async function ensureDir(dir) {
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
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

// ── GitHub API ──

function parseRepoUrl(input) {
  let owner, repo, branch = null, path = "";
  const urlMatch = input.match(
    /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/([^/]+)(?:\/(.*))?)?$/
  );
  if (urlMatch) {
    owner = urlMatch[1];
    repo = urlMatch[2];
    branch = urlMatch[3] || null;
    path = urlMatch[4] || "";
  } else {
    const parts = input.replace(/^\/+|\/+$/g, "").split("/");
    if (parts.length < 2) return null;
    owner = parts[0];
    repo = parts[1];
    path = parts.slice(2).join("/");
  }
  return { owner, repo, branch, path };
}

function getRepoConfig() {
  const url = process.env.WEBCAKE_KNOWLEDGE_REPO;
  if (!url) return null;
  return parseRepoUrl(url);
}

function ghHeaders(write = false) {
  const h = { "User-Agent": "webcake-cms-mcp", Accept: "application/vnd.github.v3+json" };
  const token = process.env.WEBCAKE_KNOWLEDGE_TOKEN;
  if (token) h.Authorization = `token ${token}`;
  if (write) h["Content-Type"] = "application/json";
  return h;
}

async function ghRequest(method, url, body) {
  const token = process.env.WEBCAKE_KNOWLEDGE_TOKEN;
  if (method !== "GET" && !token) throw new Error("WEBCAKE_KNOWLEDGE_TOKEN is required to write to GitHub");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method,
      headers: ghHeaders(method !== "GET"),
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`GitHub ${res.status}: ${err.message || res.statusText}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

function ghContentsUrl(parsed, filename) {
  const { owner, repo, path: basePath } = parsed;
  const full = basePath ? `${basePath}/${filename}` : filename;
  return `https://api.github.com/repos/${owner}/${repo}/contents/${full}`;
}

// ── Sync: GitHub → Local ──

async function syncFromGithub(dir, repoCfg) {
  const { owner, repo, branch, path } = repoCfg;
  const ref = branch ? `?ref=${branch}` : "";
  const apiPath = path ? `/${path}` : "";

  const data = await ghRequest("GET",
    `https://api.github.com/repos/${owner}/${repo}/contents${apiPath}${ref}`
  );
  const files = (Array.isArray(data) ? data : [])
    .filter((f) => f.type === "file" && SUPPORTED_EXTS.has(extname(f.name).toLowerCase()));

  await ensureDir(dir);
  let synced = 0;

  // Download each file, store SHA in .sync.json for future push
  const shaMap = {};
  for (const f of files) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch(f.download_url, {
        headers: { "User-Agent": "webcake-cms-mcp" },
        signal: controller.signal,
      });
      if (!res.ok) continue;
      const text = await res.text();
      await writeFile(join(dir, f.name), text, "utf-8");
      shaMap[f.name] = f.sha;
      synced++;
    } finally {
      clearTimeout(timer);
    }
  }

  // Save SHA map for push operations
  await writeFile(join(dir, ".sync.json"), JSON.stringify(shaMap, null, 2), "utf-8");
  return { synced, files: files.map((f) => f.name) };
}

async function getShaMap(dir) {
  try {
    const raw = await readFile(join(dir, ".sync.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function updateShaMap(dir, filename, sha) {
  const map = await getShaMap(dir);
  if (sha === null) {
    delete map[filename];
  } else {
    map[filename] = sha;
  }
  await writeFile(join(dir, ".sync.json"), JSON.stringify(map, null, 2), "utf-8");
}

// ── Push: Local → GitHub ──

async function pushFileToGithub(dir, filename, repoCfg, message) {
  const content = await readFile(join(dir, filename), "utf-8");
  const shaMap = await getShaMap(dir);
  const url = ghContentsUrl(repoCfg, filename);

  const body = {
    message,
    content: Buffer.from(content).toString("base64"),
    ...(repoCfg.branch && { branch: repoCfg.branch }),
  };

  // If we have SHA, it's an update; otherwise, it's a create
  if (shaMap[filename]) {
    body.sha = shaMap[filename];
  }

  const res = await ghRequest("PUT", url, body);
  await updateShaMap(dir, filename, res.content?.sha);
  return res;
}

async function deleteFileFromGithub(dir, filename, repoCfg, message) {
  const shaMap = await getShaMap(dir);
  const url = ghContentsUrl(repoCfg, filename);

  let sha = shaMap[filename];
  if (!sha) {
    // Fetch SHA from GitHub
    const ref = repoCfg.branch ? `?ref=${repoCfg.branch}` : "";
    const existing = await ghRequest("GET", url + ref);
    sha = existing?.sha;
  }
  if (!sha) throw new Error(`File "${filename}" not found on GitHub`);

  await ghRequest("DELETE", url, {
    message,
    sha,
    ...(repoCfg.branch && { branch: repoCfg.branch }),
  });
  await updateShaMap(dir, filename, null);
}

/** Auto-sync from GitHub on startup (silent, non-blocking) */
export async function autoSync() {
  const repoCfg = getRepoConfig();
  if (!repoCfg) return;
  const dir = getLocalDir();
  await syncFromGithub(dir, repoCfg);
}

// ── Register tools ──

export function registerKnowledgeTools(server, handle) {

  server.tool(
    "sync_knowledge",
    `Pull all knowledge files from GitHub to local for fast access.
Run this once at start or when you know files changed on GitHub.
After sync, list_knowledge and get_knowledge read from local (instant)`,
    {},
    () =>
      handle(async () => {
        const repoCfg = getRepoConfig();
        if (!repoCfg) throw new Error("WEBCAKE_KNOWLEDGE_REPO is not configured");
        const dir = getLocalDir();
        const result = await syncFromGithub(dir, repoCfg);
        return { ...result, local_dir: dir };
      })
  );

  server.tool(
    "list_knowledge",
    "List all knowledge files (reads from local — use sync_knowledge first to pull from GitHub)",
    {},
    () =>
      handle(async () => {
        const dir = getLocalDir();
        const files = await listLocalFiles(dir);

        if (!files.length) {
          return {
            files: [],
            hint: `No files found in "${dir}". Run sync_knowledge to pull from GitHub, or add files manually.`,
          };
        }

        const items = [];
        for (const file of files) {
          const raw = await readFile(join(dir, file), "utf-8");
          const { meta } = parseFrontmatter(raw);
          items.push({
            file,
            name: meta.name || basename(file, extname(file)),
            description: meta.description || undefined,
            tags: meta.tags || undefined,
          });
        }
        return { files: items };
      })
  );

  server.tool(
    "get_knowledge",
    "Read a knowledge file content (from local)",
    {
      file: z.string().describe("Filename (e.g. 'business-rules.md' or 'business-rules')"),
    },
    ({ file }) =>
      handle(async () => {
        const fileKey = file.includes(".") ? basename(file, extname(file)) : file;
        const dir = getLocalDir();
        const files = await listLocalFiles(dir);
        const match = files.find(
          (f) => f === file || basename(f, extname(f)) === fileKey
        );
        if (!match) return { error: `File "${file}" not found. Use list_knowledge to see available files.` };

        const raw = await readFile(join(dir, match), "utf-8");
        const { meta, body } = parseFrontmatter(raw);
        return {
          file: match,
          name: meta.name || basename(match, extname(match)),
          content: body.trim(),
        };
      })
  );

  server.tool(
    "create_knowledge",
    `Create a new knowledge file locally and push to GitHub.
Use markdown with optional frontmatter:
---
name: My Guide
description: What this file is about
tags: guide, rules
---
# Content here...`,
    {
      filename: z.string().describe("Filename with extension (e.g. 'business-rules.md')"),
      content: z.string().describe("File content (markdown)"),
      message: z.string().optional().describe("Git commit message"),
    },
    ({ filename, content, message }) =>
      handle(async () => {
        const dir = getLocalDir();
        await ensureDir(dir);

        // Write local
        await writeFile(join(dir, filename), content, "utf-8");

        // Push to GitHub if configured
        const repoCfg = getRepoConfig();
        if (repoCfg) {
          const res = await pushFileToGithub(dir, filename, repoCfg, message || `Add ${filename}`);
          return { success: true, file: filename, sha: res.content?.sha, url: res.content?.html_url };
        }

        return { success: true, file: filename, source: "local_only" };
      })
  );

  server.tool(
    "update_knowledge",
    "Update a knowledge file locally and push to GitHub",
    {
      filename: z.string().describe("Filename to update (e.g. 'business-rules.md')"),
      content: z.string().describe("New file content (replaces entire file)"),
      message: z.string().optional().describe("Git commit message"),
    },
    ({ filename, content, message }) =>
      handle(async () => {
        const dir = getLocalDir();
        const filePath = join(dir, filename);

        if (!existsSync(filePath)) throw new Error(`File "${filename}" not found locally. Use sync_knowledge or create_knowledge first.`);

        // Write local
        await writeFile(filePath, content, "utf-8");

        // Push to GitHub if configured
        const repoCfg = getRepoConfig();
        if (repoCfg) {
          const res = await pushFileToGithub(dir, filename, repoCfg, message || `Update ${filename}`);
          return { success: true, file: filename, sha: res.content?.sha, url: res.content?.html_url };
        }

        return { success: true, file: filename, source: "local_only" };
      })
  );

  server.tool(
    "delete_knowledge",
    "Delete a knowledge file locally and from GitHub",
    {
      filename: z.string().describe("Filename to delete"),
      message: z.string().optional().describe("Git commit message"),
    },
    ({ filename, message }) =>
      handle(async () => {
        const dir = getLocalDir();
        const filePath = join(dir, filename);

        // Delete from GitHub first
        const repoCfg = getRepoConfig();
        if (repoCfg) {
          await deleteFileFromGithub(dir, filename, repoCfg, message || `Delete ${filename}`);
        }

        // Delete local
        if (existsSync(filePath)) await unlink(filePath);

        return { success: true, deleted: filename };
      })
  );
}
