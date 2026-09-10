// LUMEN — AI Lesson Assistant
// Section 8: PROCESSING PIPELINE

(function () {
  'use strict';

  /* -----------------------------------------------------------------
     8. PROCESSING PIPELINE
  ----------------------------------------------------------------- */
  function resetSteps() {
    $all(".step").forEach((el) => el.classList.remove("is-active", "is-done", "is-error"));
    $("#progressFill").style.width = "0%";
    $("#processingPercent").textContent = "0%";
    state.processing = { active: false, currentStep: 0, failed: false };
  }

  function setStepState(stepNumber, mode) {
    const el = $(`.step[data-step="${stepNumber}"]`);
    if (!el) return;
    el.classList.remove("is-active", "is-done", "is-error");
    if (mode) el.classList.add(mode);
  }

  function advanceToStep(stepNumber) {
    for (let i = 1; i < stepNumber; i++) setStepState(i, "is-done");
    setStepState(stepNumber, "is-active");
    state.processing.currentStep = stepNumber;
    const pct = Math.round(((stepNumber - 1) / 7) * 100); // Assumes 7 steps max
    if ($("#progressFill")) $("#progressFill").style.width = `${pct}%`;
    if ($("#processingPercent")) $("#processingPercent").textContent = `${pct}%`;
  }

  function completeAllSteps() {
    $all(".step").forEach((_, i) => setStepState(i + 1, "is-done"));
    if ($("#progressFill")) $("#progressFill").style.width = "100%";
    if ($("#processingPercent")) $("#processingPercent").textContent = "100%";
  }

  function failAtCurrentStep() {
    const step = state.processing.currentStep || 1;
    setStepState(step, "is-error");
  }

  // Ensure this function is attached to the window so other files can call it
  window.resetSteps = resetSteps;
  window.advanceToStep = advanceToStep;
  window.completeAllSteps = completeAllSteps;
  window.failAtCurrentStep = failAtCurrentStep;
  window.updateSidebarChip = updateSidebarChip;

  async function beginProcessing(url) {
    resetSteps();
    $("#processingCard").hidden = false;
    $("#processingErrorCard").hidden = true;
    state.processing.active = true;
    state.isDemo = false;

    updateSidebarChip("busy", "Processing…");

    // The backend does the whole pipeline in one blocking request with no
    // progress callbacks, so this simulates step progression while it's in
    // flight purely so the UI never sits blank. Real completion always wins:
    // as soon as the response comes back we jump straight to "done".
    let simIndex = 0;
    advanceToStep(1);

    const simTimer = setInterval(() => {
      simIndex++;
      if (simIndex <= 5) {
        advanceToStep(simIndex + 1); // move to step 2..6
      } else {
        clearInterval(simTimer);
      }
    }, 1400);

    try {
      const data = await callProcessAPI(url);
      clearInterval(simTimer);
      advanceToStep(7);
      await new Promise((r) => setTimeout(r, 350));

      if (!data || !data.transcript || !data.transcript.trim()) {
        throw { friendly: "No speech was detected in this video. Try a different link." };
      }

      completeAllSteps();
      state.processing.active = false;

      applyLessonData(data, url);
      updateSidebarChip("ready", state.lesson.title);
      pushNotification(`"${state.lesson.title}" is ready to explore.`);

      await new Promise((r) => setTimeout(r, 450));
      $("#processingCard").hidden = true;
      setActiveView(state.pendingTargetView || "dashboard");
      state.pendingTargetView = null;
    } catch (err) {
      clearInterval(simTimer);
      state.processing.active = false;
      state.pendingTargetView = null;
      failAtCurrentStep();
      updateSidebarChip("error", "Processing failed");
      const message =
        (err && err.friendly) ||
        "Something went wrong while processing this video. Please try again.";
      
      // Safety check to ensure we hide the processing card on failure
      if ($("#processingCard")) $("#processingCard").hidden = true;
      
      $("#processingErrorMessage").textContent = message;
      $("#processingErrorCard").hidden = false;
      showToast(message, "error");
    }
  }

  async function callProcessAPI(url) {
    let response;
    try {
      response = await fetch(`${state.apiBase}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, language: "english" }),
      });
    } catch (networkErr) {
      throw { friendly: "Can't reach the server right now. Check your connection and try again." };
    }

    let data = null;
    try {
      data = await response.json();
    } catch (parseErr) {
      /* body wasn't JSON -- handled below via response.ok */
    }

    if (!response.ok) {
      // 4xx detail messages come from our own validation (e.g. "A video URL
      // is required.") and are safe to show as-is. 5xx details can include
      // raw exception text, so those fall back to a generic message instead.
      if (response.status >= 400 && response.status < 500 && data && data.detail) {
        throw { friendly: data.detail };
      }
      throw { friendly: "Something went wrong while processing this video. Please try again." };
    }

    if (!data) {
      throw { friendly: "The server sent back something unexpected. Please try again." };
    }

    return data;
  }

  function updateSidebarChip(status, text) {
    const chip = $("#sidebarLessonChip");
    const dot = $("#sidebarStatusDot");
    const nameLabel = $("#sidebarLessonName");
    
    // FIX: Safely exit if these elements don't exist in the HTML layout
    if (!chip || !dot || !nameLabel) return;
    
    chip.hidden = false;
    dot.className = "lesson-chip__dot" + (status === "ready" ? " is-ready" : status === "busy" ? " is-busy" : "");
    nameLabel.textContent = text;
  }
  
  window.beginProcessing = beginProcessing;

})();