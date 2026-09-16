const CLIENTS = {
  "4fc58b4efe97aacc7ac3dbc2d3066c4355db8576b8269ad28fda551549a7f4da": {
    id: "northbound",
    name: "Northbound Coffee",
    path: "clients/northbound/index.html",
  },
  "43db78b7cb347a58d4688b6dcee90cb19659d39c3400d14560e2da3eee9462d3": {
    id: "fieldnote",
    name: "Fieldnote Atlas",
    path: "clients/fieldnote/index.html",
  },
  "fa77a8d5f934c42aa65ea9ddcbbbe4663c1e4937f95f867682f11fde3b3c815e": {
    id: "orbit",
    name: "Orbit Labs",
    path: "clients/orbit/index.html",
  },
};

const SESSION_KEY = "triline_portal_access";

async function hashCode(value) {
  const normalized = value.trim().toUpperCase();
  const data = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function saveAccess(client) {
  const payload = {
    id: client.id,
    name: client.name,
    unlockedAt: Date.now(),
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
}

const form = document.getElementById("portal-form");
const input = document.getElementById("access-code");
const status = document.getElementById("portal-status");

if (form && input && status) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.textContent = "";
    status.classList.remove("is-error", "is-success");

    const code = input.value;
    if (!code.trim()) {
      status.textContent = "Enter the access code from your project handoff.";
      status.classList.add("is-error");
      input.focus();
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const hash = await hashCode(code);
      const client = CLIENTS[hash];

      if (!client) {
        status.textContent = "That code wasn’t recognized. Check the spelling and try again.";
        status.classList.add("is-error");
        input.select();
        return;
      }

      saveAccess(client);
      status.textContent = `Opening ${client.name}…`;
      status.classList.add("is-success");
      window.location.href = client.path;
    } catch (error) {
      status.textContent = "Something went wrong unlocking the portal. Please try again.";
      status.classList.add("is-error");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}
