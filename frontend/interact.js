"use strict";

/* ==========================================================================
   VideoMind — frontend logic
   Talks only to the local FastAPI backend. No secrets, no fake data.
   ========================================================================== */

const API_BASE_URL = "http://127.0.0.1:8000";

/* ---------- element references ---------- */

const analyzeForm = document.getElementById("analyzeForm");
const videoUrlInput = document.getElementById("videoUrl");
const urlError = document.getElementById("urlError");
const languageSelect = document.getElementById("language");
const analyzeBtn = document.getElementById("analyzeBtn");

const emptyState = document.getElementById("emptyState");
const loadingState = document.getElementById("loadingState");
const loadingSubtitle = document.getElementById("loadingSubtitle");
const errorState = document.getElementById("errorState");
const errorMessage = document.getElementById("errorMessage");
const retryBtn = document.getElementById("retryBtn");
const dashboard = document.getElementById("dashboard");

const videoTitleEl = document.getElementById("videoTitle");
const summaryTextEl = document.getElementById("summaryText");
const insightKeyPoints = document.getElementById("insightKeyPoints");
const insightQuestions = document.getElementById("insightQuestions");
const insightTranscriptLength = document.getElementById("insightTranscriptLength");
const keyPointsList = document.getElementById("keyPointsList");
const questionsList = document.getElementById("questionsList");

const askCard = document.getElementById("askCard");
const askForm = document.getElementById("askForm");
const askInput = document.getElementById("askInput");
const askBtn = document.getElementById("askBtn");
const aiThinking = document.getElementById("aiThinking");
const answerCard = document.getElementById("answerCard");
const answerText = document.getElementById("answerText");

const transcriptToggle = document.getElementById("transcriptToggle");
const transcriptBody = document.getElementById("transcriptBody");
const transcriptText = document.getElementById("transcriptText");

const toastContainer = document.getElementById("toastContainer");
const heroWaveform = document.getElementById("heroWaveform");

/* ---------- state ---------- */

let currentSessionId = null;
let isProcessing = false;
let isAsking = false;

/* ==========================================================================
   Init
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  buildWaveform();
  analyzeForm.addEventListener("submit", handleAnalyzeSubmit);
  askForm.addEventListener("submit", handleAskSubmit);
  retryBtn.addEventListener("click", handleRetry);
  transcriptToggle.addEventListener("click", toggleTranscript);

  document.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-copy-target");
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        copyToClipboard(targetEl.textContent, btn);
      }
    });
  });
});

function buildWaveform() {
  if (!heroWaveform) return;
  const bars = 24;
  for (let i = 0; i < bars; i++) {
    const bar = document.createElement("span");
    const height = 20 + Math.round(Math.random() * 100);
    const delay = (Math.random() * 1.6).toFixed(2);
    bar.style.height = `${height}px`;
    bar.style.animationDelay = `${delay}s`;
    heroWaveform.appendChild(bar);
  }
}

/* ==========================================================================
   Validation
   ========================================================================== */

function validateYouTubeUrl(url) {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)[\w-]{6,}/i;
  return pattern.test(trimmed);
}

/* ==========================================================================
   Analyze flow
   ========================================================================== */

async function handleAnalyzeSubmit(event) {
  event.preventDefault();
  if (isProcessing) return;

  const url = videoUrlInput.value.trim();
  hideFieldError();

  if (!validateYouTubeUrl(url)) {
    showFieldError("Enter a valid YouTube video URL.");
    videoUrlInput.focus();
    return;
  }

  await processVideo(url, languageSelect.value);
}

async function processVideo(url, language) {
  isProcessing = true;
  setAnalyzeButtonLoading(true);
  showLoading();

  try {
    const response = await fetch(`${API_BASE_URL}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, language }),
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();

    if (!data || data.success !== true) {
      throw new Error("Backend reported a failed analysis.");
    }

    currentSessionId = data.session_id || null;
    displayResults(data);
    hideLoading();
    showToast("Video analyzed successfully.", "success");
    scrollToResults();
  } catch (error) {
    console.error("processVideo error:", error);
    hideLoading();
    showError("We couldn't process this video. Please check the URL and try again.");
  } finally {
    isProcessing = false;
    setAnalyzeButtonLoading(false);
  }
}

function handleRetry() {
  hideError();
  showEmpty();
  videoUrlInput.focus();
}

/* ==========================================================================
   Ask AI flow
   ========================================================================== */

async function handleAskSubmit(event) {
  event.preventDefault();
  await askQuestion(askInput.value.trim());
}

async function askQuestion(question) {
  if (isAsking) return;
  if (!question) {
    askInput.focus();
    return;
  }
  if (!currentSessionId) {
    showToast("Analyze a video before asking a question.", "error");
    return;
  }

  isAsking = true;
  askInput.value = question;
  setAskButtonLoading(true);
  answerCard.hidden = true;
  aiThinking.hidden = false;

  try {
    const response = await fetch(`${API_BASE_URL}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: currentSessionId, question }),
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();

    if (!data || data.success !== true) {
      throw new Error("Backend reported a failed answer.");
    }

    answerText.textContent = data.answer || "";
    answerCard.hidden = false;
  } catch (error) {
    console.error("askQuestion error:", error);
    showToast("Couldn't get an answer. Please try again.", "error");
  } finally {
    aiThinking.hidden = true;
    isAsking = false;
    setAskButtonLoading(false);
  }
}

/* ==========================================================================
   Rendering
   ========================================================================== */

function displayResults(data) {
  videoTitleEl.textContent = data.title || "Untitled video";
  summaryTextEl.textContent = data.summary || "";

  displayKeyPoints(data.key_points || []);
  displayQuestions(data.questions || []);
  displayTranscript(data.transcript || "");

  const keyPointsCount = Array.isArray(data.key_points) ? data.key_points.length : 0;
  const questionsCount = Array.isArray(data.questions) ? data.questions.length : 0;
  const transcriptLength = typeof data.transcript === "string" ? data.transcript.length : 0;

  insightKeyPoints.textContent = String(keyPointsCount);
  insightQuestions.textContent = String(questionsCount);
  insightTranscriptLength.textContent = `${transcriptLength.toLocaleString()} chars`;

  askCard.hidden = false;
  answerCard.hidden = true;
  askInput.value = "";

  emptyState.hidden = true;
  errorState.hidden = true;
  dashboard.hidden = false;
  dashboard.classList.remove("reveal");
  void dashboard.offsetWidth;
  dashboard.classList.add("reveal");
}

function displayKeyPoints(points) {
  keyPointsList.innerHTML = "";
  points.forEach((point, index) => {
    const li = document.createElement("li");

    const indexEl = document.createElement("span");
    indexEl.className = "key-point-index";
    indexEl.textContent = String(index + 1).padStart(2, "0");

    const textEl = document.createElement("span");
    textEl.className = "key-point-text";
    textEl.textContent = point;

    li.appendChild(indexEl);
    li.appendChild(textEl);
    keyPointsList.appendChild(li);
  });
}

function displayQuestions(questions) {
  questionsList.innerHTML = "";
  questions.forEach((question) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "question-item";

    const label = document.createElement("span");
    label.textContent = question;

    const arrow = document.createElement("span");
    arrow.className = "arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "↗";

    btn.appendChild(label);
    btn.appendChild(arrow);

    btn.addEventListener("click", () => {
      askInput.value = question;
      askInput.focus();
      askCard.scrollIntoView({ behavior: "smooth", block: "start" });
      askQuestion(question);
    });

    li.appendChild(btn);
    questionsList.appendChild(li);
  });
}

function displayTranscript(transcript) {
  transcriptText.textContent = transcript;
  transcriptBody.hidden = true;
  transcriptToggle.setAttribute("aria-expanded", "false");
  transcriptToggle.querySelector("span").textContent = "Show";
}

function toggleTranscript() {
  const isHidden = transcriptBody.hidden;
  transcriptBody.hidden = !isHidden;
  transcriptToggle.setAttribute("aria-expanded", String(isHidden));
  transcriptToggle.querySelector("span").textContent = isHidden ? "Hide" : "Show";
}

/* ==========================================================================
   UI state helpers
   ========================================================================== */

function showLoading() {
  emptyState.hidden = true;
  errorState.hidden = true;
  dashboard.hidden = true;
  loadingSubtitle.textContent = "This may take a few moments.";
  loadingState.hidden = false;
}

function hideLoading() {
  loadingState.hidden = true;
}

function showEmpty() {
  errorState.hidden = true;
  dashboard.hidden = true;
  emptyState.hidden = false;
}

function showError(message) {
  emptyState.hidden = true;
  dashboard.hidden = true;
  errorMessage.textContent = message || "We couldn't process this video. Please check the URL and try again.";
  errorState.hidden = false;
}

function hideError() {
  errorState.hidden = true;
}

function setAnalyzeButtonLoading(isLoading) {
  analyzeBtn.disabled = isLoading;
  analyzeBtn.classList.toggle("is-loading", isLoading);
}

function setAskButtonLoading(isLoading) {
  askBtn.disabled = isLoading;
  askBtn.classList.toggle("is-loading", isLoading);
}

function showFieldError(message) {
  urlError.textContent = message;
  urlError.hidden = false;
}

function hideFieldError() {
  urlError.textContent = "";
  urlError.hidden = true;
}

function scrollToResults() {
  document.getElementById("resultsArea").scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ==========================================================================
   Clipboard + toasts
   ========================================================================== */

async function copyToClipboard(text, triggerBtn) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied to clipboard.", "success");
    if (triggerBtn) {
      triggerBtn.classList.add("copied");
      setTimeout(() => triggerBtn.classList.remove("copied"), 1500);
    }
  } catch (error) {
    console.error("copyToClipboard error:", error);
    showToast("Couldn't copy to clipboard.", "error");
  }
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast-out");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
  }, 3200);
}