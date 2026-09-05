// LUMEN — AI Lesson Assistant
// Section 11: ASK AI (CHAT)

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

    const bodyId = `msg-${Date.now()}-${Math.random().toString(300).slice(2, 7)}`;
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
