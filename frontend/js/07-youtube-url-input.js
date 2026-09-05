// LUMEN — AI Lesson Assistant
// Section 7: YOUTUBE URL INPUT — SELECTION & VALIDATION

  /* -----------------------------------------------------------------
     7. YOUTUBE URL INPUT — SELECTION & VALIDATION
  ----------------------------------------------------------------- */
  function showUploadError(message) {
    $("#uploadErrorMessage").textContent = message;
    $("#uploadErrorBanner").hidden = false;
  }
  function hideUploadError() {
    $("#uploadErrorBanner").hidden = true;
  }

  // Live-updates the thumbnail preview and clear button as the person types
  // or pastes a link. Doesn't trigger processing by itself.
  function handleUrlInput() {
    const url = $("#youtubeUrlInput").value.trim();
    $("#clearUrlBtn").hidden = !url;

    const id = extractYoutubeId(url);
    if (id) {
      $("#videoThumbImg").src = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
      $("#videoThumbPreview").hidden = false;
    } else {
      $("#videoThumbPreview").hidden = true;
    }
  }

  function resetUploadUI() {
    $("#youtubeUrlInput").value = "";
    $("#clearUrlBtn").hidden = true;
    $("#videoThumbPreview").hidden = true;
    $("#processingCard").hidden = true;
    $("#processingErrorCard").hidden = true;
    hideUploadError();
    resetSteps();
  }

  // Any of the four action buttons (Summarize / Key Points / Questions / Ask AI)
  // can kick off processing -- they all just differ in which view they land on
  // once the single /process call returns everything. If this exact URL was
  // already processed, skip straight to the view instead of reprocessing.
  function handleActionButton(targetView) {
    const url = $("#youtubeUrlInput").value.trim();
    const error = validateYoutubeUrl(url);
    if (error) {
      showUploadError(error);
      return;
    }
    hideUploadError();

    if (state.lesson && state.lastProcessedUrl === url) {
      setActiveView(targetView);
      return;
    }

    if (state.processing.active) {
      // Already processing this link -- just redirect where we'll land once
      // it finishes instead of firing a second, duplicate request.
      state.pendingTargetView = targetView;
      return;
    }

    state.pendingTargetView = targetView;
    beginProcessing(url);
  }

  function initUpload() {
    const urlInput = $("#youtubeUrlInput");

    urlInput.addEventListener("input", handleUrlInput);
    urlInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleActionButton("summary");
      }
    });

    $("#clearUrlBtn").addEventListener("click", () => {
      urlInput.value = "";
      urlInput.focus();
      handleUrlInput();
    });

    $all("[data-target-view]").forEach((btn) => {
      btn.addEventListener("click", () => handleActionButton(btn.dataset.targetView));
    });

    $("#dismissUploadError").addEventListener("click", hideUploadError);

    // Dashboard hero shortcut jumps to the Add Video view and focuses the input
    $("#heroAddVideoBtn").addEventListener("click", () => {
      setActiveView("upload");
      setTimeout(() => urlInput.focus(), 60);
    });
    $("#newLessonBtn").addEventListener("click", () => {
      setActiveView("upload");
      resetUploadUI();
    });

    $("#retryProcessingBtn").addEventListener("click", () => {
      $("#processingErrorCard").hidden = true;
      beginProcessing(urlInput.value.trim());
    });
    $("#cancelProcessingBtn").addEventListener("click", resetUploadUI);
  }
