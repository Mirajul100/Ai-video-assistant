// LUMEN — AI Lesson Assistant
// Section 10: TRANSCRIPT — copy & search wiring

  /* -----------------------------------------------------------------
     10. TRANSCRIPT — copy & search wiring
  ----------------------------------------------------------------- */
  function initTranscript() {
    const searchInput = $("#transcriptSearch");
    searchInput.addEventListener(
      "input",
      debounce((e) => paintTranscriptBody(e.target.value), 150)
    );

    $("#copyTranscriptBtn").addEventListener("click", async () => {
      if (!state.lesson) return;
      await copyToClipboard(state.lesson.transcriptText);
      showToast("Transcript copied to clipboard.", "success");
    });

    $("#copySummaryBtn").addEventListener("click", async () => {
      if (!state.lesson) return;
      await copyToClipboard(state.lesson.summary);
      showToast("Summary copied to clipboard.", "success");
    });

    $("#toggleSummaryBtn").addEventListener("click", () => {
      const card = $("#summaryContent");
      const expanded = card.classList.toggle("is-expanded");
      $("#toggleSummaryBtn").setAttribute("aria-expanded", String(expanded));
      $("#toggleSummaryBtn").innerHTML = expanded ? `${ICONS.chevron} Collapse` : `${ICONS.chevron} Expand`;
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
