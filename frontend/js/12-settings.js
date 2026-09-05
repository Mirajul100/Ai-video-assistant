// LUMEN — AI Lesson Assistant
// Section 12: SETTINGS

  /* -----------------------------------------------------------------
     12. SETTINGS
  ----------------------------------------------------------------- */
  function initSettings() {
    $("#apiBaseInput").value = state.apiBase;

    $("#saveApiBaseBtn").addEventListener("click", () => {
      const val = $("#apiBaseInput").value.trim().replace(/\/+$/, "");
      if (!val) {
        showToast("Enter a valid API base URL.", "error");
        return;
      }
      state.apiBase = val;
      localStorage.setItem("lumen_api_base", val);
      showToast("API base URL saved.", "success");
    });

    $("#checkHealthBtn").addEventListener("click", checkBackendHealth);

    $("#clearLessonBtn").addEventListener("click", () => {
      state.lesson = null;
      state.sessionId = null;
      state.lastProcessedUrl = null;
      state.videoId = null;
      state.isDemo = false;
      state.chat.messages = [];
      $("#dashboardLessonState").hidden = true;
      $("#dashboardEmptyState").hidden = false;
      $("#sidebarLessonChip").hidden = true;
      resetUploadUI();
      renderChatEmpty();
      enableChatInput(false);
      ["transcript", "summary", "keypoints", "questions"].forEach(resetResultView);
      showToast("Lesson data cleared.", "info");
      setActiveView("dashboard");
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
      el.hidden = id.endsWith("Empty") ? false : true;
    });
  }

  async function checkBackendHealth() {
    const dot = $("#healthStatusDot");
    const text = $("#healthStatusText");
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
