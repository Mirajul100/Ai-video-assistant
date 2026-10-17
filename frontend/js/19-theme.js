(function () {
  "use strict";

  const choices = ["system", "light", "dark"];

  function applyTheme(theme) {
    const selected = choices.includes(theme) ? theme : "system";
    document.documentElement.dataset.theme = selected;
    document.querySelectorAll("[data-theme-choice]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.themeChoice === selected));
    });
  }

  function initTheme() {
    let savedTheme = "system";
    try {
      savedTheme = localStorage.getItem("lumen_theme") || "system";
    } catch (error) {
      // Theme still works for this page when storage is unavailable.
    }
    applyTheme(savedTheme);

    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-theme-choice]");
      if (!button) return;

      const theme = button.dataset.themeChoice;
      applyTheme(theme);
      try {
        localStorage.setItem("lumen_theme", theme);
      } catch (error) {
        // Keep the chosen theme active for this page if storage is unavailable.
      }
    });
  }

  window.initTheme = initTheme;
})();
