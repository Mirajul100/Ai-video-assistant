function init() {
  const initFunctions = [
    'inflateIcons', 
    'initNavigation', 
    'initDropdowns', 
    'initUpload', 
    'initTranscript', 
    'initChat', 
    'initSettings', 
    'initDemo', 
    'initOverviewSourceLink', 
    'renderNotifications'
  ];
  
  initFunctions.forEach(fnName => {
    try {
      if (typeof window[fnName] === 'function') {
        window[fnName]();
      } else if (typeof globalThis !== 'undefined' && typeof globalThis[fnName] === 'function') {
        globalThis[fnName]();
      }
    } catch (e) {
      console.error(`Error initializing ${fnName}:`, e);
    }
  });
  
  try {
    if (typeof window.setActiveView === 'function') {
      window.setActiveView("dashboard");
    }
  } catch (e) {
    console.error("Error setting initial view:", e);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}