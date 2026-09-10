// LUMEN — AI Lesson Assistant
// Section 10: TRANSCRIPT — copy & search wiring

  /* -----------------------------------------------------------------
     10. TRANSCRIPT — copy & search wiring
  ----------------------------------------------------------------- */
  function initTranscript() {
    
    const handleSearch = debounce((val) => {
      if (typeof window.paintTranscriptBody === 'function') {
        window.paintTranscriptBody(val);
      }
    }, 150);

    document.addEventListener("input", (e) => {
      if (e.target && e.target.id === "transcriptSearch") {
        handleSearch(e.target.value);
      }
    });

    document.addEventListener("click", async (e) => {
      
      // Copy Transcript Button
      if (e.target.closest("#copyTranscriptBtn")) {
        if (!state.lesson) return;
        await copyToClipboard(state.lesson.transcriptText);
        if (typeof showToast === 'function') showToast("Transcript copied to clipboard.", "success");
        return;
      }

      if (e.target.closest("#copySummaryBtn")) {
        if (!state.lesson) return;
        await copyToClipboard(state.lesson.summary);
        if (typeof showToast === 'function') showToast("Summary copied to clipboard.", "success");
        return;
      }

      const toggleBtn = e.target.closest("#toggleSummaryBtn");
      if (toggleBtn) {
        const card = document.querySelector("#summaryContent");
        if (card) {
          const expanded = card.classList.toggle("is-expanded");
          toggleBtn.setAttribute("aria-expanded", String(expanded));
          
          const chevronIcon = (typeof ICONS !== 'undefined' && ICONS.chevron) ? ICONS.chevron : '';
          toggleBtn.innerHTML = expanded ? `${chevronIcon} Collapse` : `${chevronIcon} Expand`;
        }
        return;
      }
      
    });
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text || "");
    } catch (e) {
      // Fallback for older browsers / non-secure contexts.
      const ta = document.createElement("textarea");
      ta.value = text || "";
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch (_) {
        /* no-op */
      }
      document.body.removeChild(ta);
    }
  }

  window.initTranscript = initTranscript;
  window.copyToClipboard = copyToClipboard;