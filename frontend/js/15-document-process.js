let selectedFile = null;

function initDocumentUpload() {
  document.addEventListener("click", (e) => {
    if (e.target.closest("#tabYoutube")) {
      const tabYoutube = document.getElementById("tabYoutube");
      const tabDocument = document.getElementById("tabDocument");
      const panelYoutube = document.getElementById("panelYoutube");
      const panelDocument = document.getElementById("panelDocument");
      
      if (tabYoutube) {
        tabYoutube.classList.add("is-active");
        tabYoutube.setAttribute("aria-selected", "true");
      }
      if (tabDocument) {
        tabDocument.classList.remove("is-active");
        tabDocument.setAttribute("aria-selected", "false");
      }
      if (panelYoutube) panelYoutube.hidden = false;
      if (panelDocument) panelDocument.hidden = true;
      return;
    }

    if (e.target.closest("#tabDocument")) {
      const tabYoutube = document.getElementById("tabYoutube");
      const tabDocument = document.getElementById("tabDocument");
      const panelYoutube = document.getElementById("panelYoutube");
      const panelDocument = document.getElementById("panelDocument");
      
      if (tabDocument) {
        tabDocument.classList.add("is-active");
        tabDocument.setAttribute("aria-selected", "true");
      }
      if (tabYoutube) {
        tabYoutube.classList.remove("is-active");
        tabYoutube.setAttribute("aria-selected", "false");
      }
      if (panelDocument) panelDocument.hidden = false;
      if (panelYoutube) panelYoutube.hidden = true;
      return;
    }

    if (e.target.closest("#removeDocFileBtn")) {
      e.preventDefault();
      clearFileSelection();
      return;
    }

    if (e.target.closest("#processDocBtn")) {
      e.preventDefault();
      const processBtn = document.getElementById("processDocBtn");
      if (processBtn && !processBtn.disabled && selectedFile) {
        beginDocumentProcessing(selectedFile);
      }
      return;
    }

    const dropzone = e.target.closest("#documentDropzone");
    if (dropzone && !e.target.closest("#removeDocFileBtn")) {
      const fileInput = document.getElementById("documentFileInput");
      if (fileInput) fileInput.click();
    }
  });

  document.addEventListener("dragenter", (e) => {
    const dropzone = e.target.closest("#documentDropzone");
    if (dropzone) {
      e.preventDefault();
      dropzone.classList.add("is-dragover");
    }
  });

  document.addEventListener("dragover", (e) => {
    const dropzone = e.target.closest("#documentDropzone");
    if (dropzone) {
      e.preventDefault();
      dropzone.classList.add("is-dragover");
    }
  });

  document.addEventListener("dragleave", (e) => {
    const dropzone = e.target.closest("#documentDropzone");
    if (dropzone) {
      e.preventDefault();
      dropzone.classList.remove("is-dragover");
    }
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
    if (typeof showUploadError === 'function') showUploadError("Unsupported file type. Please upload a PDF, Word, PPTX, EPUB, or Text document.");
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
  if (dropzonePrompt) dropzonePrompt.hidden = true;
  if (dropzoneSelected) dropzoneSelected.hidden = false;
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
  if (dropzonePrompt) dropzonePrompt.hidden = false;
  if (dropzoneSelected) dropzoneSelected.hidden = true;
  if (processDocBtn) processDocBtn.disabled = true;
}

// FIX: this file used to also define its own `resetUploadUI()`, identically
// named to the one in 07-youtube-url-input.js. Since both scripts share the
// same global scope, this copy (loaded later) was silently overwriting the
// other one — so buttons that call resetUploadUI() from the YouTube tab
// (Cancel, New Lesson) stopped clearing the YouTube URL field, thumbnail,
// and error banner. The two versions now live as one combined function in
// 07-youtube-url-input.js, which also handles clearing the document
// selection (via clearFileSelection, still defined here) and showing the
// shared idle state. No replacement definition is needed in this file.

async function beginDocumentProcessing(file) {
  if (typeof resetSteps === 'function') resetSteps(); 
  
  const uploadIdleState = document.getElementById("uploadIdleState");
  const processingCard = document.getElementById("processingCard");
  const processingErrorCard = document.getElementById("processingErrorCard");
  
  if (uploadIdleState) uploadIdleState.hidden = true;
  if (processingCard) processingCard.hidden = false;
  if (processingErrorCard) processingErrorCard.hidden = true;
  
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

    const response = await fetch(`${state.apiBase}/process-document`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw { friendly: errorData.detail || "Failed to process the document." };
    }

    const data = await response.json();
    
    clearInterval(simTimer);
    if (typeof advanceToStep === 'function') advanceToStep(7);
    await new Promise((r) => setTimeout(r, 350));

    if (typeof completeAllSteps === 'function') completeAllSteps(); 
    if (typeof state !== 'undefined') state.processing.active = false;

    if (typeof applyLessonData === 'function') applyLessonData(data, file.name);
    
    if (typeof updateSidebarChip === 'function' && typeof state !== 'undefined' && state.lesson) {
      updateSidebarChip("ready", state.lesson.title);
    }
    if (typeof pushNotification === 'function' && typeof state !== 'undefined' && state.lesson) {
      pushNotification(`"${state.lesson.title}" is ready to explore.`);
    }
    if (typeof showToast === 'function') showToast("Document processed successfully.", "success");

    await new Promise((r) => setTimeout(r, 450));
    if (processingCard) processingCard.hidden = true;
    if (uploadIdleState) uploadIdleState.hidden = false;
    
    clearFileSelection();
    if (typeof setActiveView === 'function') setActiveView("summary");

  } catch (err) {
    clearInterval(simTimer);
    if (typeof state !== 'undefined') state.processing.active = false;
    if (typeof failAtCurrentStep === 'function') failAtCurrentStep(); 
    if (typeof updateSidebarChip === 'function') updateSidebarChip("error", "Processing failed");
    
    const message = err.friendly || "Something went wrong while processing this document. Please try again.";
    
    if (processingCard) processingCard.hidden = true;
    const errorMsgEl = document.getElementById("processingErrorMessage");
    if (errorMsgEl) errorMsgEl.textContent = message;
    if (processingErrorCard) processingErrorCard.hidden = false;
    if (typeof showToast === 'function') showToast(message, "error");
  }
}

window.initDocumentUpload = initDocumentUpload;
document.addEventListener("DOMContentLoaded", initDocumentUpload);