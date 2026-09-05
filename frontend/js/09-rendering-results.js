// LUMEN — AI Lesson Assistant
// Section 9: RENDERING RESULTS

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
    const thumbEl = $("#overviewThumb");
    if (lesson.videoId) {
      thumbEl.hidden = false;
      thumbEl.src = `https://img.youtube.com/vi/${lesson.videoId}/hqdefault.jpg`;
      thumbEl.alt = lesson.title;
    } else {
      thumbEl.hidden = true;
      thumbEl.removeAttribute("src");
    }
    $("#overviewSourceLink").href = lesson.sourceUrl || "#";
    $("#overviewSourceLabel").textContent = lesson.sourceUrl ? "Watch on YouTube" : "Sample lesson (demo)";
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
