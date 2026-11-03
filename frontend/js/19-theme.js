(function () {
  "use strict";

  const choices = ["system", "light", "dark"];

  function updateTheme(theme) {
    const selected = choices.includes(theme) ? theme : "system";
    document.documentElement.dataset.theme = selected;
    document.querySelectorAll("[data-theme-choice]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.themeChoice === selected));
    });
  }

  function applyTheme(theme, animate = false, source = null, force = false) {
    const root = document.documentElement;
    const selected = choices.includes(theme) ? theme : "system";
    if (!animate || (selected === root.dataset.theme && !force)) {
      updateTheme(selected);
      return;
    }

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduceMotion) {
      updateTheme(selected);
      return;
    }

    const rect = source?.getBoundingClientRect?.();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    root.style.setProperty("--theme-origin-x", `${x}px`);
    root.style.setProperty("--theme-origin-y", `${y}px`);

    if (typeof document.startViewTransition === "function") {
      document.startViewTransition(() => updateTheme(selected));
      return;
    }

    root.classList.add("theme-transitioning");
    updateTheme(selected);
    window.setTimeout(() => root.classList.remove("theme-transitioning"), 520);
  }

  function initTheme() {
    const root = document.documentElement;
    let savedTheme = "system";
    try {
      savedTheme = localStorage.getItem("lumen_theme") || "system";
    } catch (error) {
      // Theme still works for this page when storage is unavailable.
    }
    applyTheme(savedTheme);

    document.addEventListener("click", (event) => {
      const button = event.target instanceof Element
        ? event.target.closest("[data-theme-choice]")
        : null;
      if (!button) return;

      const theme = button.dataset.themeChoice;
      applyTheme(theme, true, button);
      try {
        localStorage.setItem("lumen_theme", theme);
      } catch (error) {
        // Keep the chosen theme active for this page if storage is unavailable.
      }
    });

    const systemScheme = window.matchMedia?.("(prefers-color-scheme: dark)");
    systemScheme?.addEventListener?.("change", () => {
      if (root.dataset.theme === "system") applyTheme("system", true, null, true);
    });
  }

  window.initTheme = initTheme;
})();
