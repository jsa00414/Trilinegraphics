const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const express = require("express");
const multer = require("multer");
const AdmZip = require("adm-zip");

const ROOT = __dirname;
const HOSTED_ROOT = path.join(ROOT, "hosted");
const PORT = Number(process.env.PORT || 4173);
const HOST_PORT_START = Number(process.env.HOST_PORT_START || 5100);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "triline-admin";
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 20);
const ADMIN_COOKIE = "triline_admin";
const PORTAL_COOKIE = "triline_portal";

const DEMO_CLIENTS = {
  "4fc58b4efe97aacc7ac3dbc2d3066c4355db8576b8269ad28fda551549a7f4da": {
    id: "northbound",
    name: "Northbound Coffee",
    type: "static",
    path: "/clients/northbound/index.html",
  },
  "43db78b7cb347a58d4688b6dcee90cb19659d39c3400d14560e2da3eee9462d3": {
    id: "fieldnote",
    name: "Fieldnote Atlas",
    type: "static",
    path: "/clients/fieldnote/index.html",
  },
  "fa77a8d5f934c42aa65ea9ddcbbbe4663c1e4937f95f867682f11fde3b3c815e": {
    id: "orbit",
    name: "Orbit Labs",
    type: "static",
    path: "/clients/orbit/index.html",
  },
};

fs.mkdirSync(HOSTED_ROOT, { recursive: true });

/** @type {Map<string, any>} */
const sites = new Map();
/** @type {Map<string, string>} codeHash -> siteId */
const codeIndex = new Map();
const adminSessions = new Set();
/** @type {Map<string, { siteId: string, type: string, name: string, path: string }>} */
const portalSessions = new Map();

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ok =
      file.mimetype === "application/zip" ||
      file.mimetype === "application/x-zip-compressed" ||
      file.originalname.toLowerCase().endsWith(".zip");
    cb(ok ? null : new Error("Upload a .zip website package."), ok);
  },
});

function createToken() {
  return crypto.randomBytes(24).toString("hex");
}

function hashAccessCode(code) {
  return crypto.createHash("sha256").update(String(code).trim().toUpperCase()).digest("hex");
}

function generateAccessCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i += 1) {
    suffix += alphabet[crypto.randomInt(alphabet.length)];
  }
  return `TRI-${suffix}`;
}

function assignAccessCode(site, preferred) {
  if (site.codeHash) codeIndex.delete(site.codeHash);

  let code = preferred ? String(preferred).trim().toUpperCase() : generateAccessCode();
  if (preferred) {
    if (!/^TRI-[A-Z0-9]{4,12}$/.test(code)) {
      throw new Error("Custom codes must look like TRI-XXXX (letters/numbers).");
    }
  } else {
    // Avoid collisions with demos or other hosted codes.
    while (DEMO_CLIENTS[hashAccessCode(code)] || codeIndex.has(hashAccessCode(code))) {
      code = generateAccessCode();
    }
  }

  const codeHash = hashAccessCode(code);
  if (DEMO_CLIENTS[codeHash] || (codeIndex.has(codeHash) && codeIndex.get(codeHash) !== site.id)) {
    throw new Error("That access code is already in use.");
  }

  site.accessCode = code;
  site.codeHash = codeHash;
  codeIndex.set(codeHash, site.id);
  return code;
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf("=");
        if (idx === -1) return [part, ""];
        return [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))];
      })
  );
}

function getCookieToken(req, name) {
  return parseCookies(req.get("cookie") || "")[name] || "";
}

function getAdminToken(req) {
  const header = req.get("x-admin-token") || "";
  const queryToken = typeof req.query.token === "string" ? req.query.token : "";
  return header || queryToken || getCookieToken(req, ADMIN_COOKIE) || "";
}

function requireAdmin(req, res, next) {
  const token = getAdminToken(req);
  if (!token || !adminSessions.has(token)) {
    return res.status(401).json({ error: "Admin authentication required." });
  }
  req.adminToken = token;
  next();
}

function requireAdminPage(req, res, next) {
  const token = getAdminToken(req);
  if (!token || !adminSessions.has(token)) {
    return res.status(401).send("Admin authentication required.");
  }
  req.adminToken = token;
  next();
}

function getPortalSession(req) {
  const token = getCookieToken(req, PORTAL_COOKIE);
  if (!token) return null;
  return portalSessions.get(token) || null;
}

function requirePortalPage(req, res, next) {
  const session = getPortalSession(req);
  if (!session) return res.status(401).send("Portal access required.");
  req.portalSession = session;
  next();
}

function safeJoin(root, target) {
  const resolved = path.resolve(root, target);
  const rootResolved = path.resolve(root);
  if (resolved !== rootResolved && !resolved.startsWith(rootResolved + path.sep)) {
    throw new Error("Invalid archive path.");
  }
  return resolved;
}

function findIndexHtml(rootDir) {
  const direct = path.join(rootDir, "index.html");
  if (fs.existsSync(direct)) return rootDir;

  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  if (dirs.length === 1) {
    const nested = path.join(rootDir, dirs[0]);
    if (fs.existsSync(path.join(nested, "index.html"))) return nested;
  }
  return null;
}

function extractZip(buffer, destDir) {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  if (!entries.length) throw new Error("Zip archive is empty.");

  for (const entry of entries) {
    const name = entry.entryName.replace(/^\/+/, "");
    if (!name || name.includes("..")) throw new Error("Zip contains unsafe paths.");

    const target = safeJoin(destDir, name);
    if (entry.isDirectory) {
      fs.mkdirSync(target, { recursive: true });
      continue;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, entry.getData());
  }
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const tester = http.createServer();
    tester.once("error", () => resolve(false));
    tester.once("listening", () => tester.close(() => resolve(true)));
    tester.listen(port, "127.0.0.1");
  });
}

async function nextFreePort(start = HOST_PORT_START) {
  for (let port = start; port < start + 200; port += 1) {
    const usedByUs = [...sites.values()].some((s) => s.port === port);
    if (usedByUs) continue;
    if (await isPortFree(port)) return port;
  }
  throw new Error("No free local ports available for hosting.");
}

function startStaticHost(dir, port) {
  const hostApp = express();
  hostApp.disable("x-powered-by");
  hostApp.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });
  hostApp.use(express.static(dir, { index: ["index.html"], extensions: ["html"] }));
  hostApp.use((_req, res) => {
    res.status(404).send("Not found in hosted site.");
  });
  const server = http.createServer(hostApp);
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function absoluteUrl(req, pathname) {
  const host = req.get("host") || `127.0.0.1:${PORT}`;
  const protocol = req.protocol === "https" ? "https" : "http";
  return `${protocol}://${host}${pathname}`;
}

function sitePayload(site, req) {
  return {
    id: site.id,
    name: site.name,
    port: site.port,
    accessCode: site.accessCode,
    localUrl: `http://127.0.0.1:${site.port}`,
    iframeUrl: absoluteUrl(req, `/api/admin/preview/${site.id}/`),
    portalUrl: absoluteUrl(req, "/portal.html"),
    clientViewUrl: absoluteUrl(req, `/view.html?id=${site.id}`),
    createdAt: site.createdAt,
  };
}

function removeDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

async function stopSite(id) {
  const site = sites.get(id);
  if (!site) return false;
  if (site.codeHash) codeIndex.delete(site.codeHash);
  await new Promise((resolve) => site.server.close(() => resolve()));
  removeDir(path.join(HOSTED_ROOT, id));
  sites.delete(id);

  for (const [token, session] of portalSessions.entries()) {
    if (session.siteId === id) portalSessions.delete(token);
  }
  return true;
}

function proxyToSite(site, req, res, prefix) {
  let targetPath = req.originalUrl.slice(prefix.length) || "/";
  const q = targetPath.indexOf("?");
  if (q !== -1) targetPath = targetPath.slice(0, q) || "/";
  if (!targetPath.startsWith("/")) targetPath = `/${targetPath}`;

  const upstream = `http://127.0.0.1:${site.port}${targetPath}`;
  http
    .get(upstream, (upstreamRes) => {
      res.status(upstreamRes.statusCode || 502);
      for (const [key, value] of Object.entries(upstreamRes.headers)) {
        const lower = key.toLowerCase();
        if (lower === "transfer-encoding") continue;
        if (lower === "x-frame-options") continue;
        if (lower === "content-security-policy") continue;
        if (value !== undefined) res.setHeader(key, value);
      }
      upstreamRes.pipe(res);
    })
    .on("error", () => {
      res.status(502).send("Hosted site is unavailable.");
    });
}

app.post("/api/admin/login", (req, res) => {
  const password = String(req.body?.password || "");
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Incorrect admin password." });
  }
  const token = createToken();
  adminSessions.add(token);
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax`
  );
  res.json({ token });
});

app.post("/api/admin/logout", requireAdmin, (req, res) => {
  adminSessions.delete(req.adminToken);
  res.setHeader("Set-Cookie", `${ADMIN_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  res.json({ ok: true });
});

app.get("/api/admin/session", requireAdmin, (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/admin/sites", requireAdmin, (req, res) => {
  res.json({ sites: [...sites.values()].map((s) => sitePayload(s, req)) });
});

app.post("/api/admin/upload", requireAdmin, (req, res) => {
  upload.single("website")(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "Upload failed." });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Choose a .zip file to upload." });
    }

    const id = createToken().slice(0, 12);
    const workDir = path.join(HOSTED_ROOT, id);
    fs.mkdirSync(workDir, { recursive: true });

    try {
      extractZip(req.file.buffer, workDir);
      const serveRoot = findIndexHtml(workDir);
      if (!serveRoot) {
        removeDir(workDir);
        return res.status(400).json({
          error: "Zip must include an index.html at the root or in one top-level folder.",
        });
      }

      const port = await nextFreePort();
      const server = await startStaticHost(serveRoot, port);
      const name =
        String(req.body?.name || "").trim() ||
        path.basename(req.file.originalname, path.extname(req.file.originalname)) ||
        `Site ${id}`;

      const customCode = String(req.body?.accessCode || "").trim();
      const site = {
        id,
        name,
        dir: serveRoot,
        port,
        server,
        createdAt: new Date().toISOString(),
      };
      assignAccessCode(site, customCode || undefined);
      sites.set(id, site);
      res.status(201).json({ site: sitePayload(site, req) });
    } catch (error) {
      removeDir(workDir);
      res.status(500).json({ error: error.message || "Could not host uploaded website." });
    }
  });
});

app.post("/api/admin/sites/:id/code", requireAdmin, (req, res) => {
  const site = sites.get(req.params.id);
  if (!site) return res.status(404).json({ error: "Hosted site not found." });

  try {
    const customCode = String(req.body?.accessCode || "").trim();
    assignAccessCode(site, customCode || undefined);
    res.json({ site: sitePayload(site, req) });
  } catch (error) {
    res.status(400).json({ error: error.message || "Could not generate access code." });
  }
});

app.delete("/api/admin/sites/:id", requireAdmin, async (req, res) => {
  const stopped = await stopSite(req.params.id);
  if (!stopped) return res.status(404).json({ error: "Hosted site not found." });
  res.json({ ok: true });
});

app.use("/api/admin/preview/:id", requireAdminPage, (req, res) => {
  const site = sites.get(req.params.id);
  if (!site) return res.status(404).send("Hosted site not found.");
  proxyToSite(site, req, res, `/api/admin/preview/${site.id}`);
});

app.post("/api/portal/unlock", (req, res) => {
  const code = String(req.body?.code || "").trim();
  if (!code) return res.status(400).json({ error: "Enter an access code." });

  const codeHash = hashAccessCode(code);
  const demo = DEMO_CLIENTS[codeHash];
  let unlock = null;

  if (demo) {
    unlock = { ...demo };
  } else if (codeIndex.has(codeHash)) {
    const site = sites.get(codeIndex.get(codeHash));
    if (site) {
      unlock = {
        id: site.id,
        name: site.name,
        type: "hosted",
        path: `/view.html?id=${site.id}`,
      };
    }
  }

  if (!unlock) {
    return res.status(401).json({ error: "That code wasn’t recognized. Check the spelling and try again." });
  }

  const token = createToken();
  portalSessions.set(token, {
    siteId: unlock.id,
    type: unlock.type,
    name: unlock.name,
    path: unlock.path,
  });
  res.setHeader(
    "Set-Cookie",
    `${PORTAL_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax`
  );
  res.json({
    client: {
      id: unlock.id,
      name: unlock.name,
      type: unlock.type,
      path: unlock.path,
    },
  });
});

app.get("/api/portal/session", (req, res) => {
  const session = getPortalSession(req);
  if (!session) return res.status(401).json({ error: "No active portal session." });

  if (session.type === "hosted" && !sites.has(session.siteId)) {
    return res.status(404).json({ error: "That hosted website is no longer available." });
  }

  res.json({
    client: {
      id: session.siteId,
      name: session.name,
      type: session.type,
      path: session.path,
      previewUrl:
        session.type === "hosted"
          ? absoluteUrl(req, `/api/portal/preview/${session.siteId}/`)
          : session.path,
    },
  });
});

app.post("/api/portal/logout", (req, res) => {
  const token = getCookieToken(req, PORTAL_COOKIE);
  if (token) portalSessions.delete(token);
  res.setHeader("Set-Cookie", `${PORTAL_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
  res.json({ ok: true });
});

app.use("/api/portal/preview/:id", requirePortalPage, (req, res) => {
  if (req.portalSession.siteId !== req.params.id || req.portalSession.type !== "hosted") {
    return res.status(403).send("This portal session cannot view that website.");
  }
  const site = sites.get(req.params.id);
  if (!site) return res.status(404).send("Hosted site not found.");
  proxyToSite(site, req, res, `/api/portal/preview/${site.id}`);
});

app.use(express.static(ROOT, { extensions: ["html"], index: ["index.html"] }));

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Server error." });
});

const mainServer = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Triline Graphics running at http://127.0.0.1:${PORT}`);
  console.log(`Admin page: http://127.0.0.1:${PORT}/admin.html`);
  console.log(`Admin password: ${ADMIN_PASSWORD}`);
});

async function shutdown() {
  for (const id of [...sites.keys()]) {
    await stopSite(id);
  }
  mainServer.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
