(function () {
  const SESSION_KEY = "triline_portal_access";
  const requiredId = document.body.dataset.clientId;
  const portalUrl = "../../portal.html";

  function redirectToPortal() {
    window.location.replace(portalUrl);
  }

  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) {
      redirectToPortal();
      return;
    }

    const access = JSON.parse(raw);
    if (!access || access.id !== requiredId) {
      redirectToPortal();
      return;
    }

    document.documentElement.classList.add("portal-unlocked");

    const exit = document.querySelector("[data-portal-exit]");
    if (exit) {
      exit.addEventListener("click", (event) => {
        event.preventDefault();
        sessionStorage.removeItem(SESSION_KEY);
        window.location.href = portalUrl;
      });
    }
  } catch (error) {
    redirectToPortal();
  }
})();
