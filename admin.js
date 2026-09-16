const TOKEN_KEY = "triline_admin_token";

const loginPanel = document.getElementById("login-panel");
const workspace = document.getElementById("admin-workspace");
const loginForm = document.getElementById("login-form");
const loginStatus = document.getElementById("login-status");
const uploadForm = document.getElementById("upload-form");
const uploadStatus = document.getElementById("upload-status");
const siteList = document.getElementById("site-list");
const previewFrame = document.getElementById("preview-frame");
const previewEmpty = document.getElementById("preview-empty");
const previewTitle = document.getElementById("preview-title");
const previewMeta = document.getElementById("preview-meta");
const openLocal = document.getElementById("open-local");
const stopSiteBtn = document.getElementById("stop-site");
const logoutBtn = document.getElementById("logout-btn");
const codeBox = document.getElementById("code-box");
const accessCodeDisplay = document.getElementById("access-code-display");
const copyCodeBtn = document.getElementById("copy-code");
const regenCodeBtn = document.getElementById("regen-code");

let token = localStorage.getItem(TOKEN_KEY) || "";
let selectedId = "";
let sites = [];

function setStatus(el, message, type = "") {
  if (!el) return;
  el.textContent = message;
  el.classList.remove("is-error", "is-success");
  if (type) el.classList.add(type);
}

function authHeaders(extra = {}) {
  return {
    "x-admin-token": token,
    ...extra,
  };
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { "x-admin-token": token } : {}),
    },
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : { error: await response.text() };

  if (!response.ok) {
    const error = new Error(data.error || "Request failed.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function showLoggedOut() {
  token = "";
  localStorage.removeItem(TOKEN_KEY);
  selectedId = "";
  sites = [];
  loginPanel.hidden = false;
  workspace.hidden = true;
  logoutBtn.hidden = true;
  previewFrame.removeAttribute("src");
  previewEmpty.hidden = false;
  codeBox.hidden = true;
}

function showLoggedIn() {
  loginPanel.hidden = true;
  workspace.hidden = false;
  logoutBtn.hidden = false;
}

function renderSites() {
  siteList.innerHTML = "";
  if (!sites.length) {
    siteList.innerHTML = "<li class=\"admin-empty\">No hosted websites yet.</li>";
    return;
  }

  sites.forEach((site) => {
    const li = document.createElement("li");
    li.className = "admin-site-item" + (site.id === selectedId ? " is-active" : "");
    li.innerHTML = `
      <div>
        <strong>${escapeHtml(site.name)}</strong>
        <p>Port ${site.port} · code <code>${escapeHtml(site.accessCode || "—")}</code></p>
      </div>
      <div class="admin-site-actions">
        <button type="button" data-preview="${site.id}">Preview</button>
        <button type="button" data-copy="${site.id}">Copy code</button>
        <button type="button" data-stop="${site.id}">Stop</button>
      </div>
    `;
    siteList.appendChild(li);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function copyText(value) {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    setStatus(uploadStatus, `Copied access code ${value}`, "is-success");
  } catch (_error) {
    setStatus(uploadStatus, `Access code: ${value}`, "is-success");
  }
}

function selectSite(id) {
  const site = sites.find((item) => item.id === id);
  selectedId = id;
  renderSites();

  if (!site) {
    previewTitle.textContent = "No site selected";
    previewMeta.textContent = "Upload a zip to start hosting.";
    previewFrame.removeAttribute("src");
    previewEmpty.hidden = false;
    openLocal.hidden = true;
    stopSiteBtn.hidden = true;
    copyCodeBtn.hidden = true;
    regenCodeBtn.hidden = true;
    codeBox.hidden = true;
    return;
  }

  previewTitle.textContent = site.name;
  previewMeta.textContent = `Hosted on ${site.localUrl} · clients unlock at Portal with the access code below`;
  previewFrame.src = site.iframeUrl;
  previewEmpty.hidden = true;
  openLocal.hidden = false;
  openLocal.href = site.localUrl;
  stopSiteBtn.hidden = false;
  copyCodeBtn.hidden = false;
  regenCodeBtn.hidden = false;
  codeBox.hidden = false;
  accessCodeDisplay.textContent = site.accessCode || "—";
}

async function refreshSites(selectId) {
  const data = await api("/api/admin/sites");
  sites = data.sites || [];
  renderSites();
  const nextId = selectId || selectedId || (sites[0] && sites[0].id) || "";
  selectSite(nextId);
}

async function ensureSession() {
  if (!token) {
    showLoggedOut();
    return false;
  }
  try {
    await api("/api/admin/session");
    showLoggedIn();
    await refreshSites();
    return true;
  } catch (_error) {
    showLoggedOut();
    return false;
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(loginStatus, "Signing in…");
  try {
    const password = document.getElementById("admin-password").value;
    const data = await api("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    token = data.token;
    localStorage.setItem(TOKEN_KEY, token);
    setStatus(loginStatus, "", "");
    showLoggedIn();
    await refreshSites();
  } catch (error) {
    setStatus(loginStatus, error.message, "is-error");
  }
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const fileInput = document.getElementById("site-file");
  const nameInput = document.getElementById("site-name");
  const codeInput = document.getElementById("access-code-input");
  if (!fileInput.files.length) {
    setStatus(uploadStatus, "Choose a .zip file first.", "is-error");
    return;
  }

  const body = new FormData();
  body.append("website", fileInput.files[0]);
  body.append("name", nameInput.value.trim());
  if (codeInput.value.trim()) body.append("accessCode", codeInput.value.trim());

  setStatus(uploadStatus, "Uploading, hosting, and generating access code…");
  try {
    const data = await fetch("/api/admin/upload", {
      method: "POST",
      headers: authHeaders(),
      body,
    }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Upload failed.");
      return payload;
    });

    setStatus(
      uploadStatus,
      `Hosted “${data.site.name}” on port ${data.site.port}. Client code: ${data.site.accessCode}`,
      "is-success"
    );
    uploadForm.reset();
    await refreshSites(data.site.id);
  } catch (error) {
    setStatus(uploadStatus, error.message, "is-error");
  }
});

siteList.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  if (button.dataset.preview) {
    selectSite(button.dataset.preview);
    return;
  }

  if (button.dataset.copy) {
    const site = sites.find((item) => item.id === button.dataset.copy);
    if (site) await copyText(site.accessCode);
    return;
  }

  if (button.dataset.stop) {
    const id = button.dataset.stop;
    try {
      await api(`/api/admin/sites/${id}`, { method: "DELETE" });
      if (selectedId === id) selectedId = "";
      await refreshSites();
      setStatus(uploadStatus, "Host stopped.", "is-success");
    } catch (error) {
      setStatus(uploadStatus, error.message, "is-error");
    }
  }
});

copyCodeBtn.addEventListener("click", async () => {
  const site = sites.find((item) => item.id === selectedId);
  if (site) await copyText(site.accessCode);
});

regenCodeBtn.addEventListener("click", async () => {
  if (!selectedId) return;
  try {
    const data = await api(`/api/admin/sites/${selectedId}/code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await refreshSites(data.site.id);
    setStatus(uploadStatus, `New access code: ${data.site.accessCode}`, "is-success");
  } catch (error) {
    setStatus(uploadStatus, error.message, "is-error");
  }
});

stopSiteBtn.addEventListener("click", async () => {
  if (!selectedId) return;
  try {
    await api(`/api/admin/sites/${selectedId}`, { method: "DELETE" });
    selectedId = "";
    await refreshSites();
    setStatus(uploadStatus, "Host stopped.", "is-success");
  } catch (error) {
    setStatus(uploadStatus, error.message, "is-error");
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    if (token) await api("/api/admin/logout", { method: "POST" });
  } catch (_error) {
    // Ignore logout failures and clear local session anyway.
  }
  showLoggedOut();
  setStatus(loginStatus, "Logged out.", "is-success");
});

ensureSession();
