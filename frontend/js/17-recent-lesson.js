(function () {
  'use strict';

  function initHistory() {
    if (window.__lumenHistoryInitialized) return;
    window.__lumenHistoryInitialized = true;

    document.addEventListener("click", (e) => {
      const historyBtn = e.target.closest(".nav-item--history");

      if (historyBtn && !historyBtn.disabled) {
        const sessionId = historyBtn.dataset.session;

        if (sessionId) {
          loadSavedLesson(sessionId);
        }
      }
    });
  }

  async function fetchHistory() {
    const token = localStorage.getItem("lumen_token");
    if (!token) return;

    try {
      const res = await fetch(`${state.apiBase}/history`, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.status === 401) {
        localStorage.removeItem("lumen_token");
        localStorage.removeItem("lumen_user");
        if (typeof checkAuthState === 'function') checkAuthState();
        if (typeof showToast === 'function') showToast("Session expired. Please log in again.", "error");
        return;
      }

      if (res.ok) {
        const data = await res.json();
        renderHistory(data.history);
      }
    } catch (e) {
      console.error("Failed to fetch history");
    }
  }

  function renderHistory(historyItems) {
    const list = document.getElementById("sidebarHistoryList");
    if (!list) return;
    
    if (!historyItems || historyItems.length === 0) {
      list.innerHTML = `<li><button class="nav-item nav-item--history" disabled>No recent lessons</button></li>`;
      return;
    }

    const docIcon = (typeof ICONS !== 'undefined' && ICONS.doc) ? ICONS.doc : ICONS.doc;

    list.innerHTML = historyItems.map(item => `
      <li>
        <button class="nav-item nav-item--history" data-session="${item.session_id}">
          <span class="nav-item__icon">${docIcon}</span>
          <span class="nav-item__label">${typeof escapeHtml === 'function' ? escapeHtml(item.title) : item.title}</span>
        </button>
      </li>
    `).join("");
    
    if (typeof inflateIcons === 'function') inflateIcons();
  }

  async function loadSavedLesson(sessionId) {
    if (typeof updateSidebarChip === 'function') updateSidebarChip("busy", "Loading lesson...");
    
    try {
      const token = localStorage.getItem("lumen_token");
      const res = await fetch(`${state.apiBase}/lesson/${sessionId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Could not load lesson data");
      }
      
      let data = await res.json();
      
      if (typeof data.key_points === 'string') {
        try { data.key_points = JSON.parse(data.key_points); } catch(e) { data.key_points = [data.key_points]; }
      }
      if (typeof data.questions === 'string') {
        try { data.questions = JSON.parse(data.questions); } catch(e) { data.questions = [data.questions]; }
      }
      if (!data.session_id) {
        data.session_id = sessionId;
      }
      
      if (typeof window.applyLessonData === 'function') {
        window.applyLessonData(data, "Saved Lesson");
      }
      
      if (typeof updateSidebarChip === 'function') updateSidebarChip("ready", data.title || "Lesson");
      if (typeof setActiveView === 'function') setActiveView("dashboard");

      if (window.MathJax) {
        // Add a slight delay to ensure the browser has finished painting the new HTML content
        setTimeout(() => {
          window.MathJax.typesetClear();
          // We target "main-content" so it renders formulas in summary, key points, and transcript
          window.MathJax.typesetPromise([document.getElementById("main-content")]).catch(function (err) {
            console.error('MathJax error:', err.message);
          });
        }, 50);
      }

    } catch (err) {
      console.error("Load Lesson Error:", err);
      if (typeof showToast === 'function') showToast(err.message || "Failed to load the selected lesson.", "error");
      if (typeof updateSidebarChip === 'function') updateSidebarChip("error", "Load failed");
    }
  }
  
  window.fetchHistory = fetchHistory;
  window.loadSavedLesson = loadSavedLesson;

  document.addEventListener("DOMContentLoaded", initHistory);
})();