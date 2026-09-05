// LUMEN — AI Lesson Assistant
// Section 6: DROPDOWNS

  /* -----------------------------------------------------------------
     6. DROPDOWNS
  ----------------------------------------------------------------- */
  function toggleDropdown(btn, panel) {
    const isOpen = !panel.hidden;
    closeDropdowns();
    if (!isOpen) {
      panel.hidden = false;
      btn.setAttribute("aria-expanded", "true");
    }
  }
  function closeDropdowns() {
    ["#notifPanel", "#profilePanel"].forEach((sel) => {
      const panel = $(sel);
      panel.hidden = true;
    });
    ["#notifBtn", "#profileBtn"].forEach((sel) => $(sel).setAttribute("aria-expanded", "false"));
  }

  function initDropdowns() {
    $("#notifBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleDropdown($("#notifBtn"), $("#notifPanel"));
    });
    $("#profileBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleDropdown($("#profileBtn"), $("#profilePanel"));
    });
    $("#clearNotifsBtn").addEventListener("click", () => {
      state.notifications = [];
      renderNotifications();
    });
    $("#signOutBtn").addEventListener("click", () => {
      closeDropdowns();
      showToast("This is a demo account — sign out isn't wired up yet.", "info");
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".topbar__action-wrap")) closeDropdowns();
    });
    $("#searchBtn").addEventListener("click", () => {
      if (!state.lesson) {
        showToast("Upload a lesson first, then search its transcript.", "info");
        return;
      }
      setActiveView("transcript");
      setTimeout(() => $("#transcriptSearch").focus(), 50);
    });
  }
