function showAppBootSkeletons() {
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.add("is-boot-loading");
    const skeleton = document.createElement("div");
    skeleton.className = "boot-skeleton";
    skeleton.setAttribute("aria-hidden", "true");
    skeleton.innerHTML = `
      <span class="skeleton boot-skeleton__eyebrow"></span>
      <span class="skeleton boot-skeleton__title"></span>
      <span class="skeleton boot-skeleton__line"></span>
      <span class="skeleton boot-skeleton__line boot-skeleton__line--short"></span>
      <span class="skeleton boot-skeleton__panel"></span>`;
    view.prepend(skeleton);
  });

  const sidebar = document.getElementById("sidebar");
  if (sidebar) {
    sidebar.classList.add("is-boot-loading");
    const skeleton = document.createElement("div");
    skeleton.className = "sidebar-boot-skeleton";
    skeleton.setAttribute("aria-hidden", "true");
    skeleton.innerHTML = `
      <span class="skeleton sidebar-boot-skeleton__brand"></span>
      <span class="skeleton sidebar-boot-skeleton__line"></span>
      <span class="skeleton sidebar-boot-skeleton__line"></span>
      <span class="skeleton sidebar-boot-skeleton__line"></span>
      <span class="skeleton sidebar-boot-skeleton__line"></span>
      <span class="skeleton sidebar-boot-skeleton__line"></span>
      <span class="skeleton sidebar-boot-skeleton__history"></span>`;
    sidebar.prepend(skeleton);
  }

  const topbar = document.querySelector(".topbar");
  if (topbar) {
    topbar.classList.add("is-boot-loading");
    const skeleton = document.createElement("div");
    skeleton.className = "topbar-boot-skeleton";
    skeleton.setAttribute("aria-hidden", "true");
    skeleton.innerHTML = `
      <span class="skeleton topbar-boot-skeleton__title"></span>
      <span class="skeleton topbar-boot-skeleton__control"></span>
      <span class="skeleton topbar-boot-skeleton__control"></span>
      <span class="skeleton topbar-boot-skeleton__avatar"></span>`;
    topbar.append(skeleton);
  }
}

function hideAppBootSkeletons() {
  document.querySelectorAll(".view.is-boot-loading").forEach((view) => {
    view.classList.remove("is-boot-loading");
    const skeleton = view.querySelector(".boot-skeleton");
    if (skeleton) skeleton.remove();
  });

  document.querySelectorAll(".sidebar.is-boot-loading, .topbar.is-boot-loading").forEach((bar) => {
    bar.classList.remove("is-boot-loading");
    const skeleton = bar.querySelector(".sidebar-boot-skeleton, .topbar-boot-skeleton");
    if (skeleton) skeleton.remove();
  });
}

function init() {
  showAppBootSkeletons();
  const initFunctions = [
    'inflateIcons', 
    'initNavigation', 
    'initDropdowns', 
    'initUpload', 
    'initTranscript', 
    'initChat', 
    'initSettings', 
    'initTheme',
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

  window.setTimeout(hideAppBootSkeletons, 450);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
