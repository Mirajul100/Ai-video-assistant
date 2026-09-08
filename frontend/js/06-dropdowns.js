// LUMEN — AI Lesson Assistant
// Section 6: DROPDOWNS & TOPBAR ACTIONS

  function closeDropdowns() {
    const notifPanel = document.getElementById("notifPanel");
    const profilePanel = document.getElementById("profilePanel");
    const notifBtn = document.getElementById("notifBtn");
    const profileBtn = document.getElementById("profileBtn");

    if (notifPanel) notifPanel.hidden = true;
    if (profilePanel) profilePanel.hidden = true;
    if (notifBtn) notifBtn.setAttribute("aria-expanded", "false");
    if (profileBtn) profileBtn.setAttribute("aria-expanded", "false");
  }

  function initDropdowns() {
    document.addEventListener("click", (e) => {
      
      if (e.target.closest("#searchBtn")) {
        if (typeof setActiveView === 'function') setActiveView("transcript");
        setTimeout(() => {
          const searchInput = document.getElementById("transcriptSearch");
          if (searchInput) {
            searchInput.focus();
            searchInput.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 150);
        return;
      }

      const notifBtnClick = e.target.closest("#notifBtn");
      if (notifBtnClick) {
        const panel = document.getElementById("notifPanel");
        if (!panel) return;
        
        const isHidden = panel.hidden;
        closeDropdowns(); 
        
        panel.hidden = !isHidden;
        notifBtnClick.setAttribute("aria-expanded", String(isHidden));
        
        const badge = document.getElementById("notifBadge");
        if (isHidden && badge) {
          badge.hidden = true;
          badge.textContent = "0";
        }
        e.stopPropagation();
        return;
      }

      const profileBtnClick = e.target.closest("#profileBtn");
      if (profileBtnClick) {

        const token = localStorage.getItem("lumen_token");
        if (token) {
          const panel = document.getElementById("profilePanel");
          if (!panel) return;
          
          const isHidden = panel.hidden;
          closeDropdowns();
          
          panel.hidden = !isHidden;
          profileBtnClick.setAttribute("aria-expanded", String(isHidden));
        }
        e.stopPropagation();
        return;
      }

      if (e.target.closest("#clearNotifsBtn")) {
        // FIX: previously this only rewrote the list HTML by hand and left
        // state.notifications untouched, which also meant the unread badge
        // (count/visibility) could get out of sync with the now-empty list.
        // Clearing state and routing through renderNotifications() keeps the
        // list and badge consistent, same as every other place that mutates
        // state.notifications.
        if (typeof state !== 'undefined' && state.notifications) {
          state.notifications = [];
        }
        if (typeof renderNotifications === 'function') {
          renderNotifications();
        } else {
          const list = document.getElementById("notifList");
          if (list) list.innerHTML = `<li class="notif-empty">You're all caught up.</li>`;
        }
        return;
      }

      const isInsidePanel = e.target.closest(".dropdown-panel");
      if (!isInsidePanel && !e.target.closest(".topbar__action-wrap")) {
        closeDropdowns();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeDropdowns();
      }
    });
  }

  window.closeDropdowns = closeDropdowns;
  window.initDropdowns = initDropdowns;