// LUMEN — AI Lesson Assistant
// Section 15: DOCUMENT PROCESSING (Vanilla JS)

(function () {
  'use strict';

  let selectedFile = null;

  function initDocumentUpload() {
    // 1. DOM Elements
    const tabYoutube = $("#tabYoutube");
    const tabDocument = $("#tabDocument");
    const panelYoutube = $("#panelYoutube");
    const panelDocument = $("#panelDocument");
    
    const dropzone = $("#documentDropzone");
    const fileInput = $("#documentFileInput");
    const processDocBtn = $("#processDocBtn");
    const removeDocFileBtn = $("#removeDocFileBtn");

    if (!tabYoutube || !tabDocument || !dropzone) return;

    // 2. Tab Switching Logic
    tabYoutube.addEventListener("click", () => {
      tabYoutube.classList.add("is-active");
      tabYoutube.setAttribute("aria-selected", "true");
      tabDocument.classList.remove("is-active");
      tabDocument.setAttribute("aria-selected", "false");
      
      panelYoutube.hidden = false;
      panelDocument.hidden = true;
    });

    tabDocument.addEventListener("click", () => {
      tabDocument.classList.add("is-active");
      tabDocument.setAttribute("aria-selected", "true");
      tabYoutube.classList.remove("is-active");
      tabYoutube.setAttribute("aria-selected", "false");
      
      panelDocument.hidden = false;
      panelYoutube.hidden = true;
    });

    // 3. Drag and Drop Events
    dropzone.addEventListener("click", (e) => {
      // Prevent opening the file dialog if clicking the remove button
      if (!e.target.closest("#removeDocFileBtn")) {
        fileInput.click();
      }
    });

    ['dragenter', 'dragover'].forEach(evt => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.add("is-dragover");
      });
    });

    ['dragleave', 'drop'].forEach(evt => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.remove("is-dragover");
      });
    });

    dropzone.addEventListener("drop", (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelection(e.dataTransfer.files[0]);
      }
    });

    // 4. Input Change Event (Browse)
    fileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFileSelection(e.target.files[0]);
      }
    });

    // 5. Remove Selected File
    removeDocFileBtn.addEventListener("click", (e) => {
      e.stopPropagation(); // Stop the click from bubbling up to the dropzone
      clearFileSelection();
    });

    // 6. Process Button
    processDocBtn.addEventListener("click", () => {
      if (selectedFile) {
        beginDocumentProcessing(selectedFile);
      }
    });
  }

  // File Validation & UI Update
  function handleFileSelection(file) {
    const validExtensions = ['.pdf', '.docx', '.doc', '.txt', '.pptx', '.epub', '.md'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValid) {
      showUploadError("Unsupported file type. Please upload a PDF, Word, PPTX, EPUB, or Text document.");
      return;
    }
    
    // 50MB Size Limit Check
    if (file.size > 50 * 1024 * 1024) {
      showUploadError("File size exceeds the 50MB limit.");
      return;
    }

    selectedFile = file;
    
    // Update UI with file details
    $("#docFileName").textContent = file.name;
    $("#docFileSize").textContent = (file.size / (1024 * 1024)).toFixed(2) + " MB";

    // Switch Dropzone state
    $("#dropzonePrompt").hidden = true;
    $("#dropzoneSelected").hidden = false;
    $("#processDocBtn").disabled = false;
    
    hideUploadError();
  }

  function clearFileSelection() {
    selectedFile = null;
    $("#documentFileInput").value = ""; // Reset input
    
    // Revert Dropzone state
    $("#dropzonePrompt").hidden = false;
    $("#dropzoneSelected").hidden = true;
    $("#processDocBtn").disabled = true;
  }

  // API Call & Processing Pipeline
  async function beginDocumentProcessing(file) {
    resetSteps(); 
    $("#uploadIdleState").hidden = true;
    $("#processingCard").hidden = false;
    $("#processingErrorCard").hidden = true;
    
    state.processing.active = true;
    state.isDemo = false;

    // Repurpose the existing video step labels for documents
    $("#step1Label").textContent = "Uploading document";
    $("#step2Label").textContent = "Extracting text";
    $("#step3Label").textContent = "Parsing content";

    updateSidebarChip("busy", "Processing document…");

    // Simulate progress in the UI
    let simIndex = 0;
    advanceToStep(1); 

    const simTimer = setInterval(() => {
      simIndex++;
      if (simIndex <= 5) {
        advanceToStep(simIndex + 1);
      } else {
        clearInterval(simTimer);
      }
    }, 1200);

    try {
      // Prepare FormData for the file upload
      const formData = new FormData();
      formData.append("file", file);

      // Call the FastAPI backend
      const response = await fetch(`${state.apiBase}/process-document`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw { friendly: errorData.detail || "Failed to process the document." };
      }

      const data = await response.json();
      
      // Fast-forward progress upon success
      clearInterval(simTimer);
      advanceToStep(7);
      await new Promise((r) => setTimeout(r, 350));

      completeAllSteps(); 
      state.processing.active = false;

      // Feed data into the existing rendering engine
      applyLessonData(data, file.name);
      
      updateSidebarChip("ready", state.lesson.title);
      pushNotification(`"${state.lesson.title}" is ready to explore.`);
      showToast("Document processed successfully.", "success");

      // Hide processing screen and jump to the summary
      await new Promise((r) => setTimeout(r, 450));
      $("#processingCard").hidden = true;
      $("#uploadIdleState").hidden = false;
      
      clearFileSelection();
      setActiveView("summary");

    } catch (err) {
      // Handle failures
      clearInterval(simTimer);
      state.processing.active = false;
      failAtCurrentStep(); 
      updateSidebarChip("error", "Processing failed");
      
      const message = err.friendly || "Something went wrong while processing this document. Please try again.";
      
      // Hide the processing card so the error card can show up
      $("#processingCard").hidden = true;
      
      $("#processingErrorMessage").textContent = message;
      $("#processingErrorCard").hidden = false;
      showToast(message, "error");
    }
  }

  // Initialize once the DOM is fully loaded
  document.addEventListener("DOMContentLoaded", initDocumentUpload);
})();