// LUMEN — AI Lesson Assistant
// Section 12: SETTINGS

  function initSettings() {
    const apiInput = document.getElementById("apiBaseInput");
    if (apiInput && typeof state !== 'undefined') {
      apiInput.value = state.apiBase;
    }

    document.addEventListener("click", (e) => {
      
      // Save API Base URL
      if (e.target.closest("#saveApiBaseBtn")) {
        const val = document.getElementById("apiBaseInput").value.trim().replace(/\/+$/, "");
        if (!val) {
          if (typeof showToast === 'function') showToast("Enter a valid API base URL.", "error");
          return;
        }
        state.apiBase = val;
        localStorage.setItem("lumen_api_base", val);
        if (typeof showToast === 'function') showToast("API base URL saved.", "success");
        return;
      }

      // Check Connection
      if (e.target.closest("#checkHealthBtn")) {
        checkBackendHealth();
        return;
      }

      // Clear Current Lesson
      if (e.target.closest("#clearLessonBtn")) {
        state.lesson = null;
        state.sessionId = null;
        state.lastProcessedUrl = null;
        state.videoId = null;
        state.isDemo = false;
        state.chat.messages = [];
        
        const dLesson = document.getElementById("dashboardLessonState");
        const dEmpty = document.getElementById("dashboardEmptyState");
        const chip = document.getElementById("sidebarLessonChip");
        
        if (dLesson) dLesson.hidden = true;
        if (dEmpty) dEmpty.hidden = false;
        if (chip) chip.hidden = true;
        
        if (typeof resetUploadUI === 'function') resetUploadUI();
        if (typeof renderChatEmpty === 'function') renderChatEmpty();
        if (typeof enableChatInput === 'function') enableChatInput(false);
        
        ["transcript", "summary", "keypoints", "questions"].forEach(resetResultView);
        if (typeof showToast === 'function') showToast("Lesson data cleared.", "info");
        if (typeof setActiveView === 'function') setActiveView("dashboard");
      }
    });
  }

  function resetResultView(name) {
    const map = {
      transcript: ["transcriptEmpty", "transcriptContent", "transcriptSkeleton"],
      summary: ["summaryEmpty", "summaryContent", "summarySkeleton"],
      keypoints: ["keypointsEmpty", "keypointsGrid", "keypointsSkeleton"],
      questions: ["questionsEmpty", "questionsList", "questionsIntro", "questionsSkeleton"],
    };
    const ids = map[name] || [];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.hidden = !id.endsWith("Empty");
    });
  }

  async function checkBackendHealth() {
    const dot = document.getElementById("healthStatusDot");
    const text = document.getElementById("healthStatusText");
    if (!dot || !text) return;
    
    dot.className = "health-status__dot is-checking";
    text.textContent = "Checking…";
    try {
      const res = await fetch(`${state.apiBase}/health`, { method: "GET" });
      if (res.ok) {
        dot.className = "health-status__dot is-online";
        text.textContent = "Connected";
      } else {
        dot.className = "health-status__dot is-offline";
        text.textContent = `Server responded with ${res.status}`;
      }
    } catch (e) {
      dot.className = "health-status__dot is-offline";
      text.textContent = "Can't reach the server";
    }
  }

  // Global Exports
  window.initSettings = initSettings;
  window.resetResultView = resetResultView;
  window.checkBackendHealth = checkBackendHealth;