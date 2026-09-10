let selectedFile = null;
let isUploadInitialized = false;

function initDocumentUpload() {
  if (isUploadInitialized) return;
  isUploadInitialized = true;

  document.addEventListener("click", (e) => {
    // Mode Switchers
    if (e.target.closest("#tabYoutube")) {
      const tabYoutube = document.getElementById("tabYoutube");
      const tabDocument = document.getElementById("tabDocument");
      const panelYoutube = document.getElementById("panelYoutube");
      const panelDocument = document.getElementById("panelDocument");
      if (tabYoutube) { tabYoutube.classList.add("is-active"); tabYoutube.setAttribute("aria-selected", "true"); }
      if (tabDocument) { tabDocument.classList.remove("is-active"); tabDocument.setAttribute("aria-selected", "false"); }
      if (panelYoutube) { panelYoutube.hidden = false; panelYoutube.style.display = ""; }
      if (panelDocument) { panelDocument.hidden = true; panelDocument.style.display = "none"; }
      return;
    }

    if (e.target.closest("#tabDocument")) {
      const tabYoutube = document.getElementById("tabYoutube");
      const tabDocument = document.getElementById("tabDocument");
      const panelYoutube = document.getElementById("panelYoutube");
      const panelDocument = document.getElementById("panelDocument");
      if (tabDocument) { tabDocument.classList.add("is-active"); tabDocument.setAttribute("aria-selected", "true"); }
      if (tabYoutube) { tabYoutube.classList.remove("is-active"); tabYoutube.setAttribute("aria-selected", "false"); }
      if (panelDocument) { panelDocument.hidden = false; panelDocument.style.display = ""; }
      if (panelYoutube) { panelYoutube.hidden = true; panelYoutube.style.display = "none"; }
      return;
    }

    // Remove File
    if (e.target.closest("#removeDocFileBtn")) {
      e.preventDefault();
      clearFileSelection();
      return;
    }

    // Process Document
    if (e.target.closest("#processDocBtn")) {
      e.preventDefault();
      const processBtn = document.getElementById("processDocBtn");
      if (processBtn && !processBtn.disabled && selectedFile) {
        processBtn.disabled = true; // Prevent double click
        beginDocumentProcessing(selectedFile);
      }
      return;
    }

    // Dropzone Click
    const dropzone = e.target.closest("#documentDropzone");
    if (dropzone && !e.target.closest("#removeDocFileBtn")) {
      const fileInput = document.getElementById("documentFileInput");
      if (fileInput) fileInput.click();
    }
  });

  // Drag and Drop Events
  document.addEventListener("dragenter", (e) => {
    const dropzone = e.target.closest("#documentDropzone");
    if (dropzone) { e.preventDefault(); dropzone.classList.add("is-dragover"); }
  });

  document.addEventListener("dragover", (e) => {
    const dropzone = e.target.closest("#documentDropzone");
    if (dropzone) { e.preventDefault(); dropzone.classList.add("is-dragover"); }
  });

  document.addEventListener("dragleave", (e) => {
    const dropzone = e.target.closest("#documentDropzone");
    if (dropzone) { e.preventDefault(); dropzone.classList.remove("is-dragover"); }
  });

  document.addEventListener("drop", (e) => {
    const dropzone = e.target.closest("#documentDropzone");
    if (dropzone) {
      e.preventDefault();
      dropzone.classList.remove("is-dragover");
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelection(e.dataTransfer.files[0]);
      }
    }
  });

  // File Input Change
  document.addEventListener("change", (e) => {
    if (e.target && e.target.id === "documentFileInput") {
      if (e.target.files && e.target.files.length > 0) {
        handleFileSelection(e.target.files[0]);
      }
    }
  });
}

function handleFileSelection(file) {
  const validExtensions = ['.pdf', '.docx', '.doc', '.txt', '.pptx', '.epub', '.md'];
  const fileName = file.name.toLowerCase();
  const isValid = validExtensions.some(ext => fileName.endsWith(ext));

  if (!isValid) {
    if (typeof showUploadError === 'function') showUploadError("Unsupported file type. Please upload a valid document.");
    return;
  }
  
  if (file.size > 50 * 1024 * 1024) {
    if (typeof showUploadError === 'function') showUploadError("File size exceeds the 50MB limit.");
    return;
  }

  selectedFile = file;
  
  const docFileName = document.getElementById("docFileName");
  const docFileSize = document.getElementById("docFileSize");
  const dropzonePrompt = document.getElementById("dropzonePrompt");
  const dropzoneSelected = document.getElementById("dropzoneSelected");
  const processDocBtn = document.getElementById("processDocBtn");

  if (docFileName) docFileName.textContent = file.name;
  if (docFileSize) docFileSize.textContent = (file.size / (1024 * 1024)).toFixed(2) + " MB";
  if (dropzonePrompt) { dropzonePrompt.hidden = true; dropzonePrompt.style.display = 'none'; }
  if (dropzoneSelected) { dropzoneSelected.hidden = false; dropzoneSelected.style.display = ''; }
  if (processDocBtn) processDocBtn.disabled = false;
  
  if (typeof hideUploadError === 'function') hideUploadError();
}

function clearFileSelection() {
  selectedFile = null;
  const documentFileInput = document.getElementById("documentFileInput");
  const dropzonePrompt = document.getElementById("dropzonePrompt");
  const dropzoneSelected = document.getElementById("dropzoneSelected");
  const processDocBtn = document.getElementById("processDocBtn");

  if (documentFileInput) documentFileInput.value = "";
  if (dropzonePrompt) { dropzonePrompt.hidden = false; dropzonePrompt.style.display = ''; }
  if (dropzoneSelected) { dropzoneSelected.hidden = true; dropzoneSelected.style.display = 'none'; }
  if (processDocBtn) processDocBtn.disabled = true;
}

// GUARANTEED UI RESET FUNCTION
function forceHideProcessingUI() {
  // 1. Unconditionally hide the processing and error cards
  const processingCard = document.getElementById("processingCard");
  const processingErrorCard = document.getElementById("processingErrorCard");
  const uploadIdleState = document.getElementById("uploadIdleState");
  
  if (processingCard) {
    processingCard.hidden = true;
    processingCard.style.setProperty("display", "none", "important");
  }
  if (processingErrorCard) {
    processingErrorCard.hidden = true;
    processingErrorCard.style.setProperty("display", "none", "important");
  }
  if (uploadIdleState) {
    uploadIdleState.hidden = false;
    uploadIdleState.style.display = "";
  }

  // 2. Clear out the file selection so the UI returns to normal
  clearFileSelection();

  // 3. Reset state
  if (typeof state !== 'undefined' && state.processing) {
    state.processing.active = false;
  }
}

async function beginDocumentProcessing(file) {
  if (typeof resetSteps === 'function') resetSteps(); 
  
  // Set UI to loading state
  const uploadIdleState = document.getElementById("uploadIdleState");
  const processingCard = document.getElementById("processingCard");
  const processingErrorCard = document.getElementById("processingErrorCard");
  
  if (uploadIdleState) { uploadIdleState.hidden = true; uploadIdleState.style.display = "none"; }
  if (processingErrorCard) { processingErrorCard.hidden = true; processingErrorCard.style.display = "none"; }
  if (processingCard) { processingCard.hidden = false; processingCard.style.display = "block"; }
  
  if (typeof state !== 'undefined') {
    state.processing.active = true;
    state.isDemo = false;
  }

  const step1Label = document.getElementById("step1Label");
  const step2Label = document.getElementById("step2Label");
  const step3Label = document.getElementById("step3Label");
  if (step1Label) step1Label.textContent = "Uploading document";
  if (step2Label) step2Label.textContent = "Extracting text";
  if (step3Label) step3Label.textContent = "Parsing content";

  if (typeof updateSidebarChip === 'function') updateSidebarChip("busy", "Processing document…");

  let simIndex = 0;
  if (typeof advanceToStep === 'function') advanceToStep(1); 

  const simTimer = setInterval(() => {
    simIndex++;
    if (simIndex <= 5) {
      if (typeof advanceToStep === 'function') advanceToStep(simIndex + 1);
    } else {
      clearInterval(simTimer);
    }
  }, 1200);

  try {
    const formData = new FormData();
    formData.append("file", file);

    const apiBaseUrl = (typeof state !== 'undefined' && state.apiBase) ? state.apiBase : 'http://localhost:8000';
    const response = await fetch(`${apiBaseUrl}/process-document`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "Failed to process the document.");
    }

    const data = await response.json();
    clearInterval(simTimer);
    if (typeof advanceToStep === 'function') advanceToStep(7);
    await new Promise((r) => setTimeout(r, 350));
    if (typeof completeAllSteps === 'function') completeAllSteps(); 

    // VERY IMPORTANT: We force hide the UI *before* triggering the other scripts
    forceHideProcessingUI();

    // Safely attempt to apply the lesson data. 
    // If loading a recent lesson previously broke this, this try/catch prevents it from breaking the upload UI.
    try {
      if (typeof applyLessonData === 'function') applyLessonData(data, file.name);
      if (typeof updateSidebarChip === 'function' && typeof state !== 'undefined' && state.lesson) {
        updateSidebarChip("ready", state.lesson.title);
      }
      if (typeof pushNotification === 'function' && typeof state !== 'undefined' && state.lesson) {
        pushNotification(`"${state.lesson.title}" is ready to explore.`);
      }
      if (typeof setActiveView === 'function') setActiveView("summary");
    } catch (renderError) {
      console.error("Error rendering document data:", renderError);
      if (typeof showToast === 'function') showToast("Document processed, but couldn't load view.", "error");
    }

  } catch (err) {
    clearInterval(simTimer);
    forceHideProcessingUI(); // Ensure loading UI is hidden
    
    if (typeof failAtCurrentStep === 'function') failAtCurrentStep(); 
    if (typeof updateSidebarChip === 'function') updateSidebarChip("error", "Processing failed");
    
    const message = err.message || "Something went wrong while processing this document.";
    
    // Show error card manually
    const currentErrorCard = document.getElementById("processingErrorCard");
    const errorMsgEl = document.getElementById("processingErrorMessage");
    const currentIdleState = document.getElementById("uploadIdleState");
    
    if (currentIdleState) { currentIdleState.hidden = true; currentIdleState.style.display = "none"; }
    if (errorMsgEl) errorMsgEl.textContent = message;
    if (currentErrorCard) {
      currentErrorCard.hidden = false;
      currentErrorCard.style.display = "block";
    }
    
    if (typeof showToast === 'function') showToast(message, "error");
  }
}

// Initialize on load
document.addEventListener("DOMContentLoaded", initDocumentUpload);
// Also initialize immediately in case DOM is already loaded
initDocumentUpload();