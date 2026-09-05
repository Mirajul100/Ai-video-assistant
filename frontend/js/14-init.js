// LUMEN — AI Lesson Assistant
// Section 14: INIT

  /* -----------------------------------------------------------------
     14. INIT
  ----------------------------------------------------------------- */
  function init() {
    inflateIcons();
    initNavigation();
    initDropdowns();
    initUpload();
    initTranscript();
    initChat();
    initSettings();
    initDemo();
    initOverviewSourceLink();
    renderNotifications();
    setActiveView("dashboard");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
