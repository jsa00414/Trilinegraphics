const yearEl = document.querySelector("[data-year]");
if (yearEl) {
  yearEl.textContent = String(new Date().getFullYear());
}

const revealTargets = document.querySelectorAll(".work-item, .process-step");

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2, rootMargin: "0px 0px -8% 0px" }
  );

  revealTargets.forEach((el) => observer.observe(el));
} else {
  revealTargets.forEach((el) => el.classList.add("is-in"));
}

const form = document.querySelector(".contact-form");
const note = document.querySelector("[data-form-note]");

if (form && note) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    note.hidden = false;
    form.reset();
  });
}

const heroVisual = document.querySelector(".hero-visual");
const heroMark = document.querySelector(".hero-mark");

if (heroVisual && heroMark && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  window.addEventListener(
    "pointermove",
    (event) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 12;
      const y = (event.clientY / window.innerHeight - 0.5) * 8;
      heroMark.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    },
    { passive: true }
  );
}
