(function () {
  'use strict';

  function initHistory() {
    if (window.__lumenHistoryInitialized) return;
    window.__lumenHistoryInitialized = true;

    document.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const historyButton = target && target.closest(".nav-item--history");
      const sessionId = historyButton?.dataset.session;
      if (sessionId && !historyButton.disabled) loadSavedLesson(sessionId);
    });
  }

  async function fetchHistory() {
    if (!localStorage.getItem("lumen_token")) return;

    try {
      const response = await window.authenticatedFetch(`${state.apiBase}/history`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || `Could not load lesson history (${response.status}).`);
      }
      renderHistory(Array.isArray(data.history) ? data.history : []);
    } catch (error) {
      console.error("Failed to fetch history:", error);
    }
  }

  function renderHistory(historyItems) {
    const list = document.getElementById("sidebarHistoryList");
    if (!list) return;

    list.textContent = "";
    if (!historyItems.length) {
      const row = document.createElement("li");
      const button = document.createElement("button");
      button.className = "nav-item nav-item--history";
      button.disabled = true;
      button.textContent = "No recent lessons";
      row.append(button);
      list.append(row);
      return;
    }

    historyItems.forEach((item) => {
      const row = document.createElement("li");
      const button = document.createElement("button");
      const icon = document.createElement("span");
      const label = document.createElement("span");

      button.className = "nav-item nav-item--history";
      button.dataset.session = String(item.session_id || "");
      icon.className = "nav-item__icon";
      icon.innerHTML = typeof ICONS !== "undefined" ? ICONS.doc : "";
      label.className = "nav-item__label";
      label.textContent = String(item.title || "Untitled lesson");
      button.append(icon, label);
      row.append(button);
      list.append(row);
    });

    if (typeof inflateIcons === "function") inflateIcons();
  }

  async function loadSavedLesson(sessionId) {
    if (typeof updateSidebarChip === "function") {
      updateSidebarChip("busy", "Loading lesson...");
    }

    try {
      const response = await window.authenticatedFetch(
        `${state.apiBase}/lesson/${encodeURIComponent(sessionId)}`
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || "Could not load lesson data.");
      }

      if (typeof data.key_points === "string") {
        try {
          data.key_points = JSON.parse(data.key_points);
        } catch (error) {
          data.key_points = [data.key_points];
        }
      }
      if (typeof data.questions === "string") {
        try {
          data.questions = JSON.parse(data.questions);
        } catch (error) {
          data.questions = [data.questions];
        }
      }
      if (!data.session_id) data.session_id = sessionId;

      if (typeof window.applyLessonData === "function") {
        window.applyLessonData(data, "Saved Lesson");
      }
      if (typeof updateSidebarChip === "function") {
        updateSidebarChip("ready", data.title || "Lesson");
      }
      if (typeof setActiveView === "function") setActiveView("dashboard");

      if (window.MathJax) {
        setTimeout(() => {
          window.MathJax.typesetClear();
          window.MathJax.typesetPromise([
            document.getElementById("main-content")
          ]).catch((error) => {
            console.error("MathJax error:", error.message);
          });
        }, 50);
      }
    } catch (error) {
      console.error("Load lesson failed:", error);
      if (typeof showToast === "function") {
        showToast(error.message || "Failed to load the selected lesson.", "error");
      }
      if (typeof updateSidebarChip === "function") updateSidebarChip("error", "Load failed");
    }
  }

  window.fetchHistory = fetchHistory;
  window.loadSavedLesson = loadSavedLesson;
  document.addEventListener("DOMContentLoaded", initHistory);
})();
