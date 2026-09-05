// LUMEN — AI Lesson Assistant
// Section 5: NAVIGATION

  /* -----------------------------------------------------------------
     5. NAVIGATION
  ----------------------------------------------------------------- */
  const VIEW_TITLES = {
    dashboard: "Dashboard",
    upload: "Add Video",
    transcript: "Transcript",
    summary: "Summary",
    keypoints: "Key Points",
    questions: "Questions",
    "ask-ai": "Ask AI",
    settings: "Settings",
  };

  function setActiveView(viewName) {
    if (!VIEW_TITLES[viewName]) return;
    state.currentView = viewName;

    $all(".view").forEach((v) => v.classList.toggle("is-active", v.dataset.view === viewName));
    $all(".nav-item[data-view]").forEach((btn) => {
      const active = btn.dataset.view === viewName;
      btn.classList.toggle("is-active", active);
      if (active) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
    $("#topbarTitle").textContent = VIEW_TITLES[viewName];
    closeSidebarMobile();
    closeDropdowns();
    $("#main-content").scrollTo({ top: 0 });

    if (viewName === "ask-ai") {
      $("#chatUnreadDot").hidden = true;
    }
  }

  function openSidebarMobile() {
    $("#sidebar").classList.add("is-open");
    const backdrop = $("#sidebarBackdrop");
    backdrop.hidden = false;
    backdrop.dataset.open = "true";
    $("#menuToggle").setAttribute("aria-expanded", "true");
  }
  function closeSidebarMobile() {
    $("#sidebar").classList.remove("is-open");
    const backdrop = $("#sidebarBackdrop");
    backdrop.hidden = true;
    backdrop.dataset.open = "false";
    $("#menuToggle").setAttribute("aria-expanded", "false");
  }

  function initNavigation() {
    $all("[data-view]").forEach((el) => {
      el.addEventListener("click", () => setActiveView(el.dataset.view));
    });
    $("#menuToggle").addEventListener("click", () => {
      const isOpen = $("#sidebar").classList.contains("is-open");
      isOpen ? closeSidebarMobile() : openSidebarMobile();
    });
    $("#sidebarBackdrop").addEventListener("click", closeSidebarMobile);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeSidebarMobile();
        closeDropdowns();
      }
    });
  }
