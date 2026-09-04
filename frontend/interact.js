/* =========================================================================
   LUMEN — AI LESSON ASSISTANT
   Table of contents:
   1. Icon system
   2. Config & state
   3. Utilities
   4. Toasts & notifications
   5. Navigation (sidebar / topbar / views)
   6. Dropdowns (notifications & profile)
   7. YouTube URL input — selection & validation
   8. Processing pipeline (steps + API call)
   9. Rendering results (overview, summary, key points, questions, transcript)
   10. Transcript search
   11. Ask AI (chat)
   12. Settings
   13. Demo lesson
   14. Init
   ========================================================================= */

(function () {
  "use strict";

  /* -----------------------------------------------------------------
     1. ICON SYSTEM
     Small hand-drawn line icon set (24x24, stroke-based) so the app
     has zero external icon dependencies. Placeholders of the form
     {{icon:name}} written in index.html are swapped for real markup
     the moment the script runs, before anything else touches the DOM.
  ----------------------------------------------------------------- */
  const ICONS = {
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4"/><path d="M7.5 8.5 12 4l4.5 4.5"/><path d="M4.5 15v3a2.5 2.5 0 0 0 2.5 2.5h10a2.5 2.5 0 0 0 2.5-2.5v-3"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3.5h8l4 4v13a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z"/><path d="M14 3.5v4h4"/><path d="M8.5 12.5h7M8.5 15.75h7M8.5 9.25h3"/></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5 3.5 8.25 12 13l8.5-4.75Z"/><path d="m3.5 12 8.5 4.75L20.5 12"/><path d="m3.5 15.75 8.5 4.75 8.5-4.75"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5 14.7 9l6.1.9-4.4 4.3 1 6.1L12 17.3 6.6 20.3l1-6.1L3.2 9.9l6.1-.9Z"/></svg>',
    question: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.3a2.5 2.5 0 0 1 4.9.7c0 1.7-2.4 2-2.4 3.7"/><circle cx="12" cy="16.7" r="0.15" fill="currentColor" stroke-width="1"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5h16v10.5H9l-3.5 3.5V16H4Z"/><path d="M8 9.5h8M8 12.5h5"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a1.7 1.7 0 0 0 .35 1.9l.05.05a2 2 0 1 1-2.85 2.85l-.06-.06a1.7 1.7 0 0 0-1.9-.34 1.7 1.7 0 0 0-1 1.55V19.6a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.9.34l-.06.06a2 2 0 1 1-2.85-2.85l.05-.05a1.7 1.7 0 0 0 .35-1.9 1.7 1.7 0 0 0-1.55-1H4.4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.55-1.1 1.7 1.7 0 0 0-.35-1.9l-.05-.06A2 2 0 1 1 8.5 4.24l.06.05a1.7 1.7 0 0 0 1.9.35H10.6A1.7 1.7 0 0 0 11.6 3v-.1a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.9-.35l.06-.05A2 2 0 1 1 21.4 6.9l-.05.06a1.7 1.7 0 0 0-.35 1.9v.1a1.7 1.7 0 0 0 1.55 1h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.55 1Z"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 10.5a6 6 0 1 1 12 0c0 4.2 1.4 5.7 1.4 5.7H4.6S6 14.7 6 10.5Z"/><path d="M10.2 19.5a1.9 1.9 0 0 0 3.6 0"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5h16M4 12h16M4 17.5h16"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5.5 5.5 13 13M18.5 5.5l-13 13"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="8.5" y="8.5" width="11.5" height="11.5" rx="1.5"/><path d="M15 8.5V5.5a1.5 1.5 0 0 0-1.5-1.5h-8A1.5 1.5 0 0 0 4 5.5v8A1.5 1.5 0 0 0 5.5 15H8.5"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m7 9.5 5 5 5-5"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 4 10.5 13.5"/><path d="M20 4 13.5 20l-3-6.5L4 10.5Z"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4.5 4.5L19 8"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 21.5 20.5H2.5Z"/><path d="M12 10v4.2"/><circle cx="12" cy="17.3" r="0.15" fill="currentColor" stroke-width="1"/></svg>',
    video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="6" width="12" height="12" rx="1.5"/><path d="M15.5 10.5 20.5 7v10l-5-3.5"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3.5" width="6" height="10.5" rx="3"/><path d="M6 11.5a6 6 0 0 0 12 0"/><path d="M12 17.5V20.5M9 20.5h6"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7.5h14"/><path d="M9.5 7.5V5.8a1.3 1.3 0 0 1 1.3-1.3h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7"/><path d="M7 7.5 7.8 19a1.5 1.5 0 0 0 1.5 1.4h5.4a1.5 1.5 0 0 0 1.5-1.4l0.8-11.5"/><path d="M10.3 11v6M13.7 11v6"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12a7.5 7.5 0 0 1 12.6-5.5M19.5 12a7.5 7.5 0 0 1-12.6 5.5"/><path d="M17.5 3.5v3.5H14M6.5 20.5V17H10"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4.5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h3"/><path d="M15 8l4.5 4-4.5 4"/><path d="M19 12H9"/></svg>',
    sparkle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v3M12 17v3M4 12h3M17 12h3"/><path d="m7 7 2 2M15 15l2 2M17 7l-2 2M9 15l-2 2"/></svg>',
    external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6H5.5A1.5 1.5 0 0 0 4 7.5v11A1.5 1.5 0 0 0 5.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15"/><path d="M14 4h6v6"/><path d="M20 4 11 13"/></svg>',
  };

  function inflateIcons() {
    document.body.innerHTML = document.body.innerHTML.replace(
      /\{\{icon:(\w+)\}\}/g,
      (match, name) => ICONS[name] || ""
    );
  }

  /* -----------------------------------------------------------------
     2. CONFIG & STATE
  ----------------------------------------------------------------- */
  const DEFAULT_API_BASE = "http://localhost:8000";
  // Matches youtube.com/watch?v=, youtu.be/, youtube.com/embed/, /shorts/, /live/
  const YOUTUBE_ID_REGEX = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const PROCESSING_STEPS = [
    "Fetching video",
    "Extracting audio",
    "Transcribing",
    "Generating summary",
    "Extracting key points",
    "Generating questions",
    "Preparing AI assistant",
  ];

  const state = {
    apiBase: localStorage.getItem("lumen_api_base") || DEFAULT_API_BASE,
    currentView: "dashboard",
    videoUrl: null,
    videoId: null, // extracted YouTube ID, used for the thumbnail preview
    sessionId: null, // returned by POST /process, required by POST /ask
    lastProcessedUrl: null, // lets repeat clicks (Summary -> Key Points -> ...) skip reprocessing
    pendingTargetView: null, // where to land once the in-flight processing call finishes
    isDemo: false,
    processing: {
      active: false,
      currentStep: 0, // 1-indexed, 0 = not started
      failed: false,
    },
    lesson: null, // { title, transcript, summary, keyPoints, questions, sourceUrl, videoId, wordCount, processedAt }
    chat: {
      messages: [], // { role: 'user'|'ai'|'error', text }
      busy: false,
    },
    notifications: [], // { text, time }
  };

  /* -----------------------------------------------------------------
     3. UTILITIES
  ----------------------------------------------------------------- */
  function $(selector, scope) {
    return (scope || document).querySelector(selector);
  }
  function $all(selector, scope) {
    return Array.from((scope || document).querySelectorAll(selector));
  }

  function extractYoutubeId(url) {
    const match = String(url || "").match(YOUTUBE_ID_REGEX);
    return match ? match[1] : null;
  }

  function validateYoutubeUrl(url) {
    const trimmed = (url || "").trim();
    if (!trimmed) return "Paste a YouTube link to get started.";
    if (!extractYoutubeId(trimmed)) {
      return "That doesn't look like a valid YouTube link. Try a youtube.com or youtu.be URL.";
    }
    return null;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function wordCount(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function relativeTime(date) {
    const diffMs = Date.now() - date.getTime();
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return date.toLocaleDateString();
  }

  /* -----------------------------------------------------------------
     4. TOASTS & NOTIFICATIONS
  ----------------------------------------------------------------- */
  function showToast(message, type = "info", duration = 4200) {
    const stack = $("#toastStack");
    const toast = document.createElement("div");
    toast.className = `toast toast--${type}`;
    const icon = type === "success" ? ICONS.check : type === "error" ? ICONS.alert : ICONS.sparkle;
    toast.innerHTML = `<span class="toast__icon">${icon}</span><span>${escapeHtml(message)}</span>`;
    stack.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = "opacity 200ms ease, transform 200ms ease";
      toast.style.opacity = "0";
      toast.style.transform = "translateX(16px)";
      setTimeout(() => toast.remove(), 220);
    }, duration);
  }

  function pushNotification(text) {
    state.notifications.unshift({ text, time: new Date() });
    renderNotifications();
  }

  function renderNotifications() {
    const list = $("#notifList");
    const badge = $("#notifBadge");
    if (state.notifications.length === 0) {
      list.innerHTML = `<li class="notif-empty">You're all caught up.</li>`;
      badge.hidden = true;
    } else {
      list.innerHTML = state.notifications
        .map(
          (n) => `<li class="notif-item">
            <span class="notif-item__icon">${ICONS.sparkle}</span>
            <div>
              <p class="notif-item__text">${escapeHtml(n.text)}</p>
              <p class="notif-item__time">${relativeTime(n.time)}</p>
            </div>
          </li>`
        )
        .join("");
      badge.hidden = false;
      badge.textContent = String(state.notifications.length);
    }
  }

  /* -----------------------------------------------------------------
     5. NAVIGATION
  ----------------------------------------------------------------- */
  const VIEW_TITLES = {
    dashboard: "Dashboard",
    upload: "Upload Lesson",
    transcript: "Transcript",
    summary: "Summary",
    keypoints: "Key Points",
    questions: "Questions",
    "ask-ai": "Ask AI",
    settings: "Settings",
  };

  function setActiveView(viewName) {
    if (!VIEW_TITLES[viewName]) return;
    state.currentView = viewName;

    $all(".view").forEach((v) => v.classList.toggle("is-active", v.dataset.view === viewName));
    $all(".nav-item[data-view]").forEach((btn) => {
      const active = btn.dataset.view === viewName;
      btn.classList.toggle("is-active", active);
      if (active) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
    $("#topbarTitle").textContent = VIEW_TITLES[viewName];
    closeSidebarMobile();
    closeDropdowns();
    $("#main-content").scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });

    if (viewName === "ask-ai") {
      $("#chatUnreadDot").hidden = true;
    }
  }

  function openSidebarMobile() {
    $("#sidebar").classList.add("is-open");
    const backdrop = $("#sidebarBackdrop");
    backdrop.hidden = false;
    backdrop.dataset.open = "true";
    $("#menuToggle").setAttribute("aria-expanded", "true");
  }
  function closeSidebarMobile() {
    $("#sidebar").classList.remove("is-open");
    const backdrop = $("#sidebarBackdrop");
    backdrop.hidden = true;
    backdrop.dataset.open = "false";
    $("#menuToggle").setAttribute("aria-expanded", "false");
  }

  function initNavigation() {
    $all("[data-view]").forEach((el) => {
      el.addEventListener("click", () => setActiveView(el.dataset.view));
    });
    $("#menuToggle").addEventListener("click", () => {
      const isOpen = $("#sidebar").classList.contains("is-open");
      isOpen ? closeSidebarMobile() : openSidebarMobile();
    });
    $("#sidebarBackdrop").addEventListener("click", closeSidebarMobile);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeSidebarMobile();
        closeDropdowns();
      }
    });
  }

  /* -----------------------------------------------------------------
     6. DROPDOWNS
  ----------------------------------------------------------------- */
  function toggleDropdown(btn, panel) {
    const isOpen = !panel.hidden;
    closeDropdowns();
    if (!isOpen) {
      panel.hidden = false;
      btn.setAttribute("aria-expanded", "true");
    }
  }
  function closeDropdowns() {
    ["#notifPanel", "#profilePanel"].forEach((sel) => {
      const panel = $(sel);
      panel.hidden = true;
    });
    ["#notifBtn", "#profileBtn"].forEach((sel) => $(sel).setAttribute("aria-expanded", "false"));
  }

  function initDropdowns() {
    $("#notifBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleDropdown($("#notifBtn"), $("#notifPanel"));
    });
    $("#profileBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleDropdown($("#profileBtn"), $("#profilePanel"));
    });
    $("#clearNotifsBtn").addEventListener("click", () => {
      state.notifications = [];
      renderNotifications();
    });
    $("#signOutBtn").addEventListener("click", () => {
      closeDropdowns();
      showToast("This is a demo account — sign out isn't wired up yet.", "info");
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".topbar__action-wrap")) closeDropdowns();
    });
    $("#searchBtn").addEventListener("click", () => {
      if (!state.lesson) {
        showToast("Upload a lesson first, then search its transcript.", "info");
        return;
      }
      setActiveView("transcript");
      setTimeout(() => $("#transcriptSearch").focus(), 50);
    });
  }

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
    const pct = Math.round(((stepNumber - 1) / PROCESSING_STEPS.length) * 100);
    $("#progressFill").style.width = `${pct}%`;
    $("#processingPercent").textContent = `${pct}%`;
  }

  function completeAllSteps() {
    PROCESSING_STEPS.forEach((_, i) => setStepState(i + 1, "is-done"));
    $("#progressFill").style.width = "100%";
    $("#processingPercent").textContent = "100%";
  }

  function failAtCurrentStep() {
    const step = state.processing.currentStep || 1;
    setStepState(step, "is-error");
  }

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
      showToast("Lesson processed successfully.", "success");

      await new Promise((r) => setTimeout(r, 450));
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
    chip.hidden = false;
    dot.className = "lesson-chip__dot" + (status === "ready" ? " is-ready" : status === "busy" ? " is-busy" : "");
    $("#sidebarLessonName").textContent = text;
  }

  /* -----------------------------------------------------------------
     9. RENDERING RESULTS
  ----------------------------------------------------------------- */
  function normalizeKeyPoint(item, index) {
    if (item && typeof item === "object") {
      const title = item.title || item.heading || item.name || `Key point ${index + 1}`;
      const desc = item.description || item.explanation || item.detail || item.summary || "";
      return { title, desc };
    }
    const str = String(item || "").trim();
    const splitMatch = str.match(/^(.{3,60}?)(?::| [-–] )\s*(.+)$/s);
    if (splitMatch) {
      return { title: splitMatch[1].trim(), desc: splitMatch[2].trim() };
    }
    return { title: `Key point ${index + 1}`, desc: str };
  }

  function normalizeQuestion(item) {
    if (item && typeof item === "object") {
      return item.question || item.text || item.q || JSON.stringify(item);
    }
    return String(item || "");
  }

  function normalizeTranscript(raw) {
    // Supports either a plain string or an array of { time, text } segments.
    if (Array.isArray(raw)) {
      return raw.map((seg) => ({
        time: seg.time || seg.timestamp || null,
        text: seg.text || seg.line || "",
      }));
    }
    const text = String(raw || "");
    return text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({ time: null, text: line }));
  }

  function applyLessonData(data, sourceUrl) {
    const transcriptSegments = normalizeTranscript(data.transcript);
    const fullTranscriptText = transcriptSegments.map((s) => s.text).join(" ");

    state.sessionId = data.session_id || null;
    state.lastProcessedUrl = sourceUrl;
    state.videoId = extractYoutubeId(sourceUrl);

    state.lesson = {
      title: data.title || "Untitled lesson",
      transcriptSegments,
      transcriptText: fullTranscriptText,
      summary: data.summary || "",
      keyPoints: (data.key_points || []).map(normalizeKeyPoint),
      questions: (data.questions || []).map(normalizeQuestion),
      sourceUrl,
      videoId: state.videoId,
      wordCount: wordCount(fullTranscriptText),
      processedAt: new Date(),
    };

    state.chat.messages = [];
    renderDashboardLesson();
    renderSummary();
    renderKeyPoints();
    renderQuestions();
    renderTranscript();
    renderChatEmpty();
    enableChatInput(true);
  }

  function renderDashboardLesson() {
    const lesson = state.lesson;
    if (!lesson) return;
    $("#dashboardEmptyState").hidden = true;
    $("#dashboardLessonState").hidden = false;

    $("#overviewTitle").textContent = lesson.title;
    $("#overviewThumb").src = lesson.videoId
      ? `https://img.youtube.com/vi/${lesson.videoId}/hqdefault.jpg`
      : "";
    $("#overviewThumb").alt = lesson.title;
    $("#overviewSourceLink").href = lesson.sourceUrl || "#";
    $("#overviewWordCount").textContent = lesson.wordCount.toLocaleString();
    $("#overviewKeypointCount").textContent = String(lesson.keyPoints.length);
    $("#overviewProcessedAt").textContent = lesson.processedAt.toLocaleString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    });

    $("#quicklinkKeypointsCount").textContent = `${lesson.keyPoints.length} idea${lesson.keyPoints.length === 1 ? "" : "s"} to review`;
    $("#quicklinkQuestionsCount").textContent = `${lesson.questions.length} question${lesson.questions.length === 1 ? "" : "s"} to explore`;
  }

  function renderSummary() {
    const lesson = state.lesson;
    $("#summaryEmpty").hidden = true;
    $("#summarySkeleton").hidden = true;
    $("#summaryContent").hidden = false;
    $("#summaryLessonTitle").textContent = lesson.title;
    $("#summaryText").textContent = lesson.summary || "No summary was returned for this lesson.";
    $("#summaryContent").classList.remove("is-expanded");
    $("#toggleSummaryBtn").setAttribute("aria-expanded", "false");
    $("#toggleSummaryBtn").innerHTML = `${ICONS.chevron} Expand`;
  }

  function renderKeyPoints() {
    const lesson = state.lesson;
    $("#keypointsEmpty").hidden = true;
    $("#keypointsSkeleton").hidden = true;
    const grid = $("#keypointsGrid");
    grid.hidden = false;

    if (lesson.keyPoints.length === 0) {
      grid.hidden = true;
      $("#keypointsEmpty").hidden = false;
      $("#keypointsEmpty").querySelector("h2").textContent = "No key points were returned";
      $("#keypointsEmpty").querySelector("p").textContent = "This lesson didn't produce any key points.";
      return;
    }

    grid.innerHTML = lesson.keyPoints
      .map(
        (kp, i) => `<article class="keypoint-card">
          <span class="keypoint-card__index">${String(i + 1).padStart(2, "0")}</span>
          <h3 class="keypoint-card__title">${escapeHtml(kp.title)}</h3>
          <p class="keypoint-card__desc">${escapeHtml(kp.desc)}</p>
        </article>`
      )
      .join("");
  }

  function renderQuestions() {
    const lesson = state.lesson;
    $("#questionsEmpty").hidden = true;
    $("#questionsSkeleton").hidden = true;

    if (lesson.questions.length === 0) {
      $("#questionsIntro").hidden = true;
      $("#questionsList").hidden = true;
      $("#questionsEmpty").hidden = false;
      $("#questionsEmpty").querySelector("h2").textContent = "No questions were returned";
      $("#questionsEmpty").querySelector("p").textContent = "This lesson didn't produce any important questions.";
      return;
    }

    $("#questionsIntro").hidden = false;
    const list = $("#questionsList");
    list.hidden = false;
    list.innerHTML = lesson.questions
      .map(
        (q) => `<li>
          <button class="question-item" data-question="${escapeHtml(q)}">
            <span class="question-item__icon">${ICONS.question}</span>
            <span class="question-item__text">${escapeHtml(q)}</span>
            <span class="question-item__go">${ICONS.chevron}</span>
          </button>
        </li>`
      )
      .join("");

    $all(".question-item", list).forEach((btn) => {
      btn.addEventListener("click", () => {
        setActiveView("ask-ai");
        setTimeout(() => sendChatMessage(btn.dataset.question), 150);
      });
    });
  }

  function renderTranscript() {
    const lesson = state.lesson;
    $("#transcriptEmpty").hidden = true;
    $("#transcriptSkeleton").hidden = true;
    $("#transcriptContent").hidden = false;
    $("#transcriptSearch").value = "";
    $("#transcriptMatchCount").textContent = "";
    paintTranscriptBody("");
  }

  function paintTranscriptBody(query) {
    const lesson = state.lesson;
    if (!lesson) return;
    const q = (query || "").trim().toLowerCase();
    let matchCount = 0;
    let firstMatchEl = null;

    const html = lesson.transcriptSegments
      .map((seg, idx) => {
        let text = escapeHtml(seg.text);
        if (q) {
          const escQ = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const re = new RegExp(`(${escQ})`, "ig");
          text = text.replace(re, (m) => {
            matchCount++;
            const isFirst = matchCount === 1;
            return `<mark${isFirst ? ' class="is-current" data-first-match="1"' : ""}>${m}</mark>`;
          });
        }
        const timeLabel = seg.time ? `<span class="transcript-line__time">${escapeHtml(String(seg.time))}</span>` : "";
        return `<div class="transcript-line">${timeLabel}<span class="transcript-line__text">${text}</span></div>`;
      })
      .join("");

    $("#transcriptBody").innerHTML = html || `<p style="color:var(--text-faint)">Transcript is empty.</p>`;
    $("#transcriptMatchCount").textContent = q ? `${matchCount} match${matchCount === 1 ? "" : "es"}` : "";

    if (q && matchCount > 0) {
      const el = $('mark[data-first-match="1"]', $("#transcriptBody"));
      if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

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

  /* -----------------------------------------------------------------
     11. ASK AI (CHAT)
  ----------------------------------------------------------------- */
  function enableChatInput(enabled) {
    $("#chatInput").disabled = !enabled;
    $("#chatSendBtn").disabled = !enabled;
  }

  function renderChatEmpty() {
    $("#chatMessages").innerHTML = "";
    const empty = document.createElement("div");
    empty.className = "chat-empty";
    empty.id = "chatEmptyState";
    empty.innerHTML = `<span class="chat-empty__icon">${ICONS.chat}</span>
      <p>Ask a question about "<strong>${escapeHtml(state.lesson ? state.lesson.title : "this lesson")}</strong>" and I'll answer using only the transcript.</p>`;
    $("#chatMessages").appendChild(empty);
  }

  function appendMessage(role, text) {
    const emptyState = $("#chatEmptyState");
    if (emptyState) emptyState.remove();

    const wrap = document.createElement("div");
    wrap.className = `message message--${role}`;

    const avatar =
      role === "user"
        ? `<span class="message__avatar">You</span>`
        : `<span class="message__avatar">${ICONS.sparkle}</span>`;

    const bodyId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    wrap.innerHTML = `
      ${avatar}
      <div class="message__body">
        <div class="message__bubble" id="${bodyId}"></div>
        ${role === "ai" ? `<div class="message__actions"><button class="message__copy-btn" data-target="${bodyId}">${ICONS.copy} Copy</button></div>` : ""}
      </div>`;
    // set text via textContent to avoid HTML injection, preserving line breaks via CSS white-space
    wrap.querySelector(`#${bodyId}`).textContent = text;

    $("#chatMessages").appendChild(wrap);
    $("#chatMessages").scrollTo({ top: $("#chatMessages").scrollHeight, behavior: "smooth" });

    if (role === "ai") {
      wrap.querySelector(".message__copy-btn").addEventListener("click", async (e) => {
        await copyToClipboard(text);
        showToast("Answer copied.", "success");
      });
    }
    return wrap;
  }

  function showTypingIndicator() {
    const wrap = document.createElement("div");
    wrap.className = "message message--ai";
    wrap.id = "typingIndicatorMsg";
    wrap.innerHTML = `<span class="message__avatar">${ICONS.sparkle}</span>
      <div class="message__body">
        <div class="typing-indicator"><span></span><span></span><span></span></div>
      </div>`;
    $("#chatMessages").appendChild(wrap);
    $("#chatMessages").scrollTo({ top: $("#chatMessages").scrollHeight, behavior: "smooth" });
  }
  function hideTypingIndicator() {
    const el = $("#typingIndicatorMsg");
    if (el) el.remove();
  }

  async function sendChatMessage(question) {
    const text = (question || "").trim();
    if (!text || state.chat.busy || !state.lesson) return;

    appendMessage("user", text);
    state.chat.busy = true;
    enableChatInput(false);
    $("#chatInput").value = "";
    autoResizeChatInput();
    showTypingIndicator();

    try {
      if (state.isDemo) {
        // No real backend session exists for the sample lesson -- keep the
        // interaction honest instead of pretending to answer from a transcript.
        await new Promise((r) => setTimeout(r, 650));
        hideTypingIndicator();
        appendMessage(
          "ai",
          `This is a sample lesson, so I can't generate a real answer to "${text}." Process an actual YouTube video and I'll answer using only that video's transcript.`
        );
      } else {
        const answer = await callAskAPI(text);
        hideTypingIndicator();
        appendMessage("ai", answer || "I couldn't find anything about that in the lesson transcript.");
      }
      if (state.currentView !== "ask-ai") $("#chatUnreadDot").hidden = false;
    } catch (err) {
      hideTypingIndicator();
      const message = (err && err.friendly) || "The assistant couldn't answer that. Try asking again.";
      const errWrap = appendMessage("error", message);
      errWrap.classList.add("message--error");
    } finally {
      state.chat.busy = false;
      enableChatInput(true);
      $("#chatInput").focus();
    }
  }

  async function callAskAPI(question) {
    if (!state.sessionId) {
      throw { friendly: "Process a video first, then ask questions about it." };
    }

    let response;
    try {
      response = await fetch(`${state.apiBase}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: state.sessionId, question }),
      });
    } catch (networkErr) {
      throw { friendly: "Can't reach the server right now. Check your connection and try again." };
    }

    if (response.status === 404) {
      throw { friendly: "This lesson's session has expired on the server. Process the video again." };
    }
    if (!response.ok) {
      throw { friendly: "The assistant couldn't answer that. Try asking again." };
    }

    let data;
    try {
      data = await response.json();
    } catch (e) {
      throw { friendly: "The assistant sent back something unexpected. Try asking again." };
    }
    return data.answer;
  }

  function autoResizeChatInput() {
    const el = $("#chatInput");
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }

  function initChat() {
    const form = $("#chatForm");
    const input = $("#chatInput");

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      sendChatMessage(input.value);
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage(input.value);
      }
    });
    input.addEventListener("input", autoResizeChatInput);

    $("#clearChatBtn").addEventListener("click", () => {
      state.chat.messages = [];
      renderChatEmpty();
      showToast("Chat cleared.", "info");
    });
  }

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

  /* -----------------------------------------------------------------
     13. DEMO LESSON
  ----------------------------------------------------------------- */
  function loadDemoLesson() {
    const demo = {
      title: "Introduction to Neural Networks",
      transcript:
        "Welcome back, everyone. Today we're starting a new unit on neural networks, which are one of the core ideas behind modern AI.\n" +
        "A neural network is a system of connected nodes, called neurons, organized in layers: an input layer, one or more hidden layers, and an output layer.\n" +
        "Each connection between neurons has a weight, and each neuron applies an activation function to decide how strongly it should fire.\n" +
        "Activation functions like ReLU and sigmoid introduce non-linearity, which is what allows a network to learn complex patterns instead of just straight lines.\n" +
        "Training a network means adjusting those weights so the network's predictions get closer to the correct answers over time.\n" +
        "This adjustment happens through a process called backpropagation, combined with an optimization method like gradient descent.\n" +
        "The key takeaway for today is that a neural network is really just a flexible function that learns its own parameters from examples.\n" +
        "Next class, we'll look at a simple network trained to recognize handwritten digits, so bring your laptops.",
      summary:
        "This lesson introduces neural networks as layered systems of connected neurons that transform an input into an output. It covers how weighted connections and activation functions like ReLU and sigmoid let a network model non-linear patterns, and explains that training adjusts those weights using backpropagation and gradient descent so predictions improve over time. The lesson frames a neural network as a flexible function that learns its own parameters from examples, setting up next class's hands-on digit-recognition exercise.",
      key_points: [
        { title: "Layered structure", description: "A neural network is organized into an input layer, hidden layers, and an output layer of connected neurons." },
        { title: "Weights and connections", description: "Every connection between neurons carries a weight that scales how much influence one neuron has on the next." },
        { title: "Activation functions", description: "Functions like ReLU and sigmoid add non-linearity, letting the network learn more than straight-line relationships." },
        { title: "Backpropagation and gradient descent", description: "Training adjusts weights by propagating errors backward and nudging them with gradient descent." },
      ],
      questions: [
        "What is a neural network, in simple terms?",
        "Why do activation functions need to be non-linear?",
        "How does backpropagation adjust a network's weights?",
        "What role does gradient descent play in training?",
      ],
    };

    const demoUrl = "https://www.youtube.com/watch?v=DKSZHN7jftI";
    state.isDemo = true;
    applyLessonData(
      { ...demo, key_points: demo.key_points, questions: demo.questions, session_id: null },
      demoUrl
    );
    updateSidebarChip("ready", demo.title + " (demo)");
    pushNotification(`"${demo.title}" sample lesson loaded.`);
    showToast("Sample lesson loaded — this is demo data, not a real video.", "info");
    setActiveView("dashboard");
  }

  function initDemo() {
    $("#heroDemoBtn").addEventListener("click", loadDemoLesson);
  }

  /* -----------------------------------------------------------------
     14. INIT
  ----------------------------------------------------------------- */
  function init() {
    inflateIcons();
    initNavigation();
    initDropdowns();
    initUpload();
    initTranscript();
    initChat();
    initSettings();
    initDemo();
    renderNotifications();
    setActiveView("dashboard");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();