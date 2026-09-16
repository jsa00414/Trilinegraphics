const SESSION_KEY = "triline_portal_access";

const form = document.getElementById("portal-form");
const input = document.getElementById("access-code");
const status = document.getElementById("portal-status");

function saveAccess(client) {
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      id: client.id,
      name: client.name,
      type: client.type,
      unlockedAt: Date.now(),
    })
  );
}

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
      const response = await fetch("/api/portal/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "That code wasn’t recognized.");
      }

      saveAccess(data.client);
      status.textContent = `Opening ${data.client.name}…`;
      status.classList.add("is-success");
      window.location.href = data.client.path;
    } catch (error) {
      status.textContent = error.message || "Something went wrong unlocking the portal.";
      status.classList.add("is-error");
      input.select();
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}
