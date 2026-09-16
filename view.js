const SESSION_KEY = "triline_portal_access";
const params = new URLSearchParams(window.location.search);
const siteId = params.get("id");

const bar = document.getElementById("view-bar");
const label = document.getElementById("view-label");
const frame = document.getElementById("view-frame");
const status = document.getElementById("view-status");
const exitBtn = document.getElementById("view-exit");

function redirectToPortal() {
  window.location.replace("portal.html");
}

async function boot() {
  if (!siteId) {
    redirectToPortal();
    return;
  }

  try {
    const response = await fetch("/api/portal/session");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Portal access required.");

    const client = data.client;
    if (client.type !== "hosted" || client.id !== siteId) {
      throw new Error("This portal session does not match that website.");
    }

    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        id: client.id,
        name: client.name,
        type: client.type,
        unlockedAt: Date.now(),
      })
    );

    label.textContent = `Triline client preview — ${client.name}`;
    bar.hidden = false;
    frame.src = client.previewUrl;
    status.hidden = true;
  } catch (_error) {
    redirectToPortal();
  }
}

exitBtn.addEventListener("click", async (event) => {
  event.preventDefault();
  try {
    await fetch("/api/portal/logout", { method: "POST" });
  } catch (_error) {
    // Ignore and clear local session anyway.
  }
  sessionStorage.removeItem(SESSION_KEY);
  window.location.href = "portal.html";
});

boot();
