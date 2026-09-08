function showUploadError(message) {
  const msgEl = document.getElementById("uploadErrorMessage");
  const banner = document.getElementById("uploadErrorBanner");
  if (msgEl) msgEl.textContent = message;
  if (banner) banner.hidden = false;
}

function hideUploadError() {
  const banner = document.getElementById("uploadErrorBanner");
  if (banner) banner.hidden = true;
}

function handleUrlInput() {
  const input = document.getElementById("youtubeUrlInput");
  if (!input) return;
  const url = input.value.trim();
  
  const clearBtn = document.getElementById("clearUrlBtn");
  if (clearBtn) clearBtn.hidden = !url;

  const id = typeof extractYoutubeId === 'function' ? extractYoutubeId(url) : null;
  const thumbPreview = document.getElementById("videoThumbPreview");
  const thumbImg = document.getElementById("videoThumbImg");
  
  if (id) {
    if (thumbImg) thumbImg.src = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    if (thumbPreview) thumbPreview.hidden = false;
  } else {
    if (thumbPreview) thumbPreview.hidden = true;
  }
}

function resetUploadUI() {
  const urlInput = document.getElementById("youtubeUrlInput");
  if (urlInput) urlInput.value = "";
  
  const clearBtn = document.getElementById("clearUrlBtn");
  if (clearBtn) clearBtn.hidden = true;
  
  const thumbPreview = document.getElementById("videoThumbPreview");
  if (thumbPreview) thumbPreview.hidden = true;
  
  hideUploadError();

  if (typeof clearFileSelection === "function") clearFileSelection();

  const idleState = document.getElementById("uploadIdleState");
  if (idleState) idleState.hidden = false;
  
  const processingCard = document.getElementById("processingCard");
  if (processingCard) processingCard.hidden = true;
  
  const processingErrorCard = document.getElementById("processingErrorCard");
  if (processingErrorCard) processingErrorCard.hidden = true;

  if (typeof resetSteps === 'function') resetSteps();
}

function handleActionButton(targetView) {
  const input = document.getElementById("youtubeUrlInput");
  if (!input) return;
  const url = input.value.trim();
  
  const error = typeof validateYoutubeUrl === 'function' ? validateYoutubeUrl(url) : null;
  if (error) {
    showUploadError(error);
    return;
  }
  hideUploadError();

  if (typeof state !== 'undefined' && state.lesson && state.lastProcessedUrl === url) {
    if (typeof setActiveView === 'function') setActiveView(targetView);
    return;
  }

  if (typeof state !== 'undefined' && state.processing && state.processing.active) {
    state.pendingTargetView = targetView;
    return;
  }

  if (typeof state !== 'undefined') state.pendingTargetView = targetView;
  if (typeof beginProcessing === 'function') beginProcessing(url);
}

function initUpload() {
  document.addEventListener("input", (e) => {
    if (e.target && e.target.id === "youtubeUrlInput") {
      handleUrlInput();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.target && e.target.id === "youtubeUrlInput") {
      if (e.key === "Enter") {
        e.preventDefault();
        handleActionButton("summary");
      }
    }
  });

  document.addEventListener("click", (e) => {
    if (e.target.closest("#clearUrlBtn")) {
      const urlInput = document.getElementById("youtubeUrlInput");
      if (urlInput) {
        urlInput.value = "";
        urlInput.focus();
      }
      handleUrlInput();
      return;
    }

    const actionBtn = e.target.closest("[data-target-view]");
    if (actionBtn) {
      handleActionButton(actionBtn.dataset.targetView);
      return;
    }

    if (e.target.closest("#dismissUploadError")) {
      hideUploadError();
      return;
    }

    if (e.target.closest("#heroAddVideoBtn")) {
      if (typeof setActiveView === 'function') setActiveView("upload");
      setTimeout(() => {
        const input = document.getElementById("youtubeUrlInput");
        if (input) input.focus();
      }, 60);
      return;
    }

    if (e.target.closest("#newLessonBtn")) {
      if (typeof setActiveView === 'function') setActiveView("upload");
      resetUploadUI();
      return;
    }

    if (e.target.closest("#retryProcessingBtn")) {
      const errCard = document.getElementById("processingErrorCard");
      if (errCard) errCard.hidden = true;
      const input = document.getElementById("youtubeUrlInput");
      if (input && typeof beginProcessing === 'function') {
        beginProcessing(input.value.trim());
      }
      return;
    }

    if (e.target.closest("#cancelProcessingBtn")) {
      resetUploadUI();
      return;
    }
  });
}

window.resetUploadUI = resetUploadUI;
window.showUploadError = showUploadError;
window.hideUploadError = hideUploadError;
window.initUpload = initUpload;