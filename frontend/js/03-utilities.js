// LUMEN — AI Lesson Assistant
// Section 3: UTILITIES

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