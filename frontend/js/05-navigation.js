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
  try {
    if (!VIEW_TITLES[viewName]) return;
    
    if (typeof state !== 'undefined') {
      state.currentView = viewName;
    }

    const allViews = document.querySelectorAll(".view");
    allViews.forEach((v) => {
      if (v) v.classList.toggle("is-active", v.dataset.view === viewName);
    });
    
    const allNavBtns = document.querySelectorAll(".nav-item[data-view], .quicklink-card[data-view]");
    allNavBtns.forEach((btn) => {
      if (!btn) return;
      const active = btn.dataset.view === viewName;
      btn.classList.toggle("is-active", active);
      if (active) {
        btn.setAttribute("aria-current", "page");
      } else {
        btn.removeAttribute("aria-current");
      }
    });
    
    const titleEl = document.querySelector("#topbarTitle");
    if (titleEl) titleEl.textContent = VIEW_TITLES[viewName];
    
    if (typeof closeSidebarMobile === 'function') closeSidebarMobile();
    if (typeof closeDropdowns === 'function') closeDropdowns();
    
    const mainContent = document.querySelector("#main-content");
    if (mainContent && typeof mainContent.scrollTo === 'function') {
      mainContent.scrollTo({ top: 0 });
    }

    if (viewName === "ask-ai") {
      const dot = document.querySelector("#chatUnreadDot");
      if (dot) dot.hidden = true;
    }
  } catch (err) {
    console.error(err);
  }
}

function openSidebarMobile() {
  const sidebar = document.querySelector("#sidebar");
  const backdrop = document.querySelector("#sidebarBackdrop");
  const menuToggle = document.querySelector("#menuToggle");
  
  if (sidebar) sidebar.classList.add("is-open");
  if (backdrop) {
    backdrop.hidden = false;
    backdrop.dataset.open = "true";
  }
  if (menuToggle) menuToggle.setAttribute("aria-expanded", "true");
}

function closeSidebarMobile() {
  const sidebar = document.querySelector("#sidebar");
  const backdrop = document.querySelector("#sidebarBackdrop");
  const menuToggle = document.querySelector("#menuToggle");
  
  if (sidebar) sidebar.classList.remove("is-open");
  if (backdrop) {
    backdrop.hidden = true;
    backdrop.dataset.open = "false";
  }
  if (menuToggle) menuToggle.setAttribute("aria-expanded", "false");
}

function initNavigation() {
  document.addEventListener("click", (e) => {
    const navBtn = e.target.closest("[data-view]");
    if (navBtn) {
      setActiveView(navBtn.dataset.view);
      return;
    }

    const menuBtn = e.target.closest("#menuToggle");
    if (menuBtn) {
      const sidebar = document.querySelector("#sidebar");
      if (sidebar) {
        const isOpen = sidebar.classList.contains("is-open");
        isOpen ? closeSidebarMobile() : openSidebarMobile();
      }
      return;
    }

    const backdrop = e.target.closest("#sidebarBackdrop");
    if (backdrop) {
      closeSidebarMobile();
      return;
    }
  });
  
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeSidebarMobile();
      if (typeof closeDropdowns === 'function') closeDropdowns();
    }
  });
}

window.setActiveView = setActiveView;
window.openSidebarMobile = openSidebarMobile;
window.closeSidebarMobile = closeSidebarMobile;
window.initNavigation = initNavigation;