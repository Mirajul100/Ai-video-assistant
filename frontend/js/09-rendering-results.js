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
  state.videoId = typeof extractYoutubeId === 'function' ? extractYoutubeId(sourceUrl) : null;

  state.lesson = {
    title: data.title || "Untitled lesson",
    transcriptSegments,
    transcriptText: fullTranscriptText,
    summary: data.summary || "",
    keyPoints: (data.key_points || []).map(normalizeKeyPoint),
    questions: (data.questions || []).map(normalizeQuestion),
    sourceUrl,
    videoId: state.videoId,
    wordCount: typeof wordCount === 'function' ? wordCount(fullTranscriptText) : 0,
    processedAt: new Date(),
  };

  state.chat.messages = [];
  renderDashboardLesson();
  renderSummary();
  renderKeyPoints();
  renderQuestions();
  renderTranscript();
  
  if (typeof window.renderChatEmpty === 'function') window.renderChatEmpty();
  if (typeof window.enableChatInput === 'function') window.enableChatInput(true);
  
  // প্রসেসিং শেষ হওয়ার সাথে সাথে নতুন ডাটা সাইডবারে অ্যাড করে দেবে
  if (typeof window.fetchHistory === 'function') window.fetchHistory();
}

function renderDashboardLesson() {
  const lesson = state.lesson;
  if (!lesson) return;
  const emptyState = document.getElementById("dashboardEmptyState");
  const lessonState = document.getElementById("dashboardLessonState");
  
  if (emptyState) emptyState.hidden = true;
  if (lessonState) lessonState.hidden = false;

  const titleEl = document.getElementById("overviewTitle");
  if (titleEl) titleEl.textContent = lesson.title;
  
  const thumbEl = document.getElementById("overviewThumb");
  if (thumbEl) {
    if (lesson.videoId) {
      thumbEl.hidden = false;
      thumbEl.src = `https://img.youtube.com/vi/${lesson.videoId}/hqdefault.jpg`;
      thumbEl.alt = lesson.title;
    } else {
      thumbEl.hidden = true;
      thumbEl.removeAttribute("src");
    }
  }

  const srcLink = document.getElementById("overviewSourceLink");
  const srcLabel = document.getElementById("overviewSourceLabel");
  if (srcLink) srcLink.href = lesson.sourceUrl || "#";
  if (srcLabel) srcLabel.textContent = lesson.sourceUrl ? "Watch on YouTube" : "Saved Lesson";
  
  const wCount = document.getElementById("overviewWordCount");
  if (wCount) wCount.textContent = lesson.wordCount.toLocaleString();
  
  const kpCount = document.getElementById("overviewKeypointCount");
  if (kpCount) kpCount.textContent = String(lesson.keyPoints.length);
  
  const pAt = document.getElementById("overviewProcessedAt");
  if (pAt) {
    pAt.textContent = lesson.processedAt.toLocaleString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    });
  }

  const qkKp = document.getElementById("quicklinkKeypointsCount");
  if (qkKp) qkKp.textContent = `${lesson.keyPoints.length} idea${lesson.keyPoints.length === 1 ? "" : "s"} to review`;
  
  const qkQ = document.getElementById("quicklinkQuestionsCount");
  if (qkQ) qkQ.textContent = `${lesson.questions.length} question${lesson.questions.length === 1 ? "" : "s"} to explore`;
}

function renderSummary() {
  const lesson = state.lesson;
  const empty = document.getElementById("summaryEmpty");
  const skeleton = document.getElementById("summarySkeleton");
  const content = document.getElementById("summaryContent");
  
  if (empty) empty.hidden = true;
  if (skeleton) skeleton.hidden = true;
  if (content) {
    content.hidden = false;
    content.classList.remove("is-expanded");
  }

  const title = document.getElementById("summaryLessonTitle");
  const text = document.getElementById("summaryText");
  const toggleBtn = document.getElementById("toggleSummaryBtn");
  
  if (title) title.textContent = lesson.title;
  if (text) text.textContent = lesson.summary || "No summary was returned for this lesson.";
  
  if (toggleBtn) {
    toggleBtn.setAttribute("aria-expanded", "false");
    const chevronIcon = (typeof ICONS !== 'undefined' && ICONS.chevron) ? ICONS.chevron : '';
    toggleBtn.innerHTML = `${chevronIcon} Expand`;
  }
}

function renderKeyPoints() {
  const lesson = state.lesson;
  const empty = document.getElementById("keypointsEmpty");
  const skeleton = document.getElementById("keypointsSkeleton");
  const grid = document.getElementById("keypointsGrid");
  
  if (empty) empty.hidden = true;
  if (skeleton) skeleton.hidden = true;
  if (grid) grid.hidden = false;

  if (lesson.keyPoints.length === 0) {
    if (grid) grid.hidden = true;
    if (empty) {
      empty.hidden = false;
      const h2 = empty.querySelector("h2");
      const p = empty.querySelector("p");
      if (h2) h2.textContent = "No key points were returned";
      if (p) p.textContent = "This lesson didn't produce any key points.";
    }
    return;
  }

  if (grid) {
    grid.innerHTML = lesson.keyPoints
      .map(
        (kp, i) => `<article class="keypoint-card">
          <span class="keypoint-card__index">${String(i + 1).padStart(2, "0")}</span>
          <h3 class="keypoint-card__title">${typeof escapeHtml === 'function' ? escapeHtml(kp.title) : kp.title}</h3>
          <p class="keypoint-card__desc">${typeof escapeHtml === 'function' ? escapeHtml(kp.desc) : kp.desc}</p>
        </article>`
      )
      .join("");
  }
}

function renderQuestions() {
  const lesson = state.lesson;
  const empty = document.getElementById("questionsEmpty");
  const skeleton = document.getElementById("questionsSkeleton");
  const intro = document.getElementById("questionsIntro");
  const list = document.getElementById("questionsList");
  
  if (empty) empty.hidden = true;
  if (skeleton) skeleton.hidden = true;

  if (lesson.questions.length === 0) {
    if (intro) intro.hidden = true;
    if (list) list.hidden = true;
    if (empty) {
      empty.hidden = false;
      const h2 = empty.querySelector("h2");
      const p = empty.querySelector("p");
      if (h2) h2.textContent = "No questions were returned";
      if (p) p.textContent = "This lesson didn't produce any important questions.";
    }
    return;
  }

  if (intro) intro.hidden = false;
  if (list) {
    list.hidden = false;
    const qIcon = (typeof ICONS !== 'undefined' && ICONS.question) ? ICONS.question : '?';
    const cIcon = (typeof ICONS !== 'undefined' && ICONS.chevron) ? ICONS.chevron : '>';
    
    list.innerHTML = lesson.questions
      .map(
        (q, idx) => `<li>
          <button type="button" class="question-item" data-index="${idx}">
            <span class="question-item__icon">${qIcon}</span>
            <span class="question-item__text">${typeof escapeHtml === 'function' ? escapeHtml(q) : q}</span>
            <span class="question-item__go">${cIcon}</span>
          </button>
        </li>`
      )
      .join("");

    list.querySelectorAll(".question-item").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault(); 
        if (typeof window.setActiveView === 'function') {
           window.setActiveView("ask-ai");
        }
        const questionText = lesson.questions[btn.dataset.index];
        if (typeof window.sendChatMessage === 'function') {
          setTimeout(() => window.sendChatMessage(questionText), 150);
        }
      });
    });
  }
}

function renderTranscript() {
  const empty = document.getElementById("transcriptEmpty");
  const skeleton = document.getElementById("transcriptSkeleton");
  const content = document.getElementById("transcriptContent");
  const search = document.getElementById("transcriptSearch");
  const matchCount = document.getElementById("transcriptMatchCount");
  
  if (empty) empty.hidden = true;
  if (skeleton) skeleton.hidden = true;
  if (content) content.hidden = false;
  if (search) search.value = "";
  if (matchCount) matchCount.textContent = "";
  
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
      let text = typeof escapeHtml === 'function' ? escapeHtml(seg.text) : seg.text;
      if (q) {
        const escQ = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const re = new RegExp(`(${escQ})`, "ig");
        text = text.replace(re, (m) => {
          matchCount++;
          const isFirst = matchCount === 1;
          return `<mark${isFirst ? ' class="is-current" data-first-match="1"' : ""}>${m}</mark>`;
        });
      }
      const timeLabel = seg.time ? `<span class="transcript-line__time">${typeof escapeHtml === 'function' ? escapeHtml(String(seg.time)) : seg.time}</span>` : "";
      return `<div class="transcript-line">${timeLabel}<span class="transcript-line__text">${text}</span></div>`;
    })
    .join("");

  const body = document.getElementById("transcriptBody");
  if (body) {
    body.innerHTML = html || `<p style="color:var(--text-faint)">Transcript is empty.</p>`;
    
    if (q && matchCount > 0) {
      const el = body.querySelector('mark[data-first-match="1"]');
      if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }
  
  const mCount = document.getElementById("transcriptMatchCount");
  if (mCount) {
    mCount.textContent = q ? `${matchCount} match${matchCount === 1 ? "" : "es"}` : "";
  }
}

window.applyLessonData = applyLessonData;
window.renderDashboardLesson = renderDashboardLesson;
window.renderSummary = renderSummary;
window.renderKeyPoints = renderKeyPoints;
window.renderQuestions = renderQuestions;
window.renderTranscript = renderTranscript;
window.paintTranscriptBody = paintTranscriptBody;