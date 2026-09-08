// LUMEN — AI Lesson Assistant
// Section 2: CONFIG & STATE

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