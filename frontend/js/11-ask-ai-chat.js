function enableChatInput(enabled) {
  const input = document.getElementById("chatInput");
  const btn = document.getElementById("chatSendBtn");
  if (input) input.disabled = !enabled;
  if (btn) btn.disabled = !enabled;
}

function renderChatEmpty() {
  const container = document.getElementById("chatMessages");
  if (!container) return;
  container.innerHTML = "";
  
  const empty = document.createElement("div");
  empty.className = "chat-empty";
  empty.id = "chatEmptyState";
  
  const chatIcon = (typeof ICONS !== 'undefined' && ICONS.chat) ? ICONS.chat : '💬';
  const titleText = (typeof state !== 'undefined' && state.lesson) ? state.lesson.title : "this lesson";
  
  empty.innerHTML = `<span class="chat-empty__icon">${chatIcon}</span>
    <p>Ask a question about "<strong>${typeof escapeHtml === 'function' ? escapeHtml(titleText) : titleText}</strong>" and I'll answer using only the transcript.</p>`;
  container.appendChild(empty);
}

function appendMessage(role, text) {
  const emptyState = document.getElementById("chatEmptyState");
  if (emptyState) emptyState.remove();

  const wrap = document.createElement("div");
  wrap.className = `message message--${role}`;

  const sparkleIcon = (typeof ICONS !== 'undefined' && ICONS.sparkle) ? ICONS.sparkle : '✨';
  const copyIcon = (typeof ICONS !== 'undefined' && ICONS.copy) ? ICONS.copy : '📋';

  const avatar = role === "user" 
    ? `<span class="message__avatar">You</span>` 
    : `<span class="message__avatar">${sparkleIcon}</span>`;

  const bodyId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  
  wrap.innerHTML = `
    ${avatar}
    <div class="message__body">
      <div class="message__bubble" id="${bodyId}"></div>
      ${role === "ai" ? `<div class="message__actions"><button type="button" class="message__copy-btn" data-target="${bodyId}">${copyIcon} Copy</button></div>` : ""}
    </div>`;
    
  // Set textContent (safely escapes HTML natively).
  wrap.querySelector(`#${bodyId}`).textContent = text;
  
  const chatMessages = document.getElementById("chatMessages");
  chatMessages.appendChild(wrap);
  chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: "smooth" });

  // Copy button is only for AI messages
  if (role === "ai") {
    wrap.querySelector(".message__copy-btn").addEventListener("click", async (e) => {
      e.preventDefault();
      if (typeof copyToClipboard === 'function') await copyToClipboard(text);
      if (typeof showToast === 'function') showToast("Answer copied.", "success");
    });
  }

  // ==========================================
  // MathJax Trigger: Now applies to BOTH AI and User messages
  // ==========================================
  if (window.MathJax) {
     setTimeout(() => {
       window.MathJax.typesetClear();
       const msgElement = document.getElementById(bodyId);
       if (msgElement) {
         window.MathJax.typesetPromise([msgElement]).catch(function (err) {
           console.error('MathJax error:', err.message);
         });
       }
     }, 10); // Small delay allows the browser to paint the text before parsing math
  }

  return wrap;
}

function showTypingIndicator() {
  const wrap = document.createElement("div");
  wrap.className = "message message--ai";
  wrap.id = "typingIndicatorMsg";
  const sparkleIcon = (typeof ICONS !== 'undefined' && ICONS.sparkle) ? ICONS.sparkle : '✨';
  wrap.innerHTML = `<span class="message__avatar">${sparkleIcon}</span>
    <div class="message__body">
      <div class="typing-indicator"><span></span><span></span><span></span></div>
    </div>`;
  const chatMessages = document.getElementById("chatMessages");
  chatMessages.appendChild(wrap);
  chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: "smooth" });
}

function hideTypingIndicator() {
  const el = document.getElementById("typingIndicatorMsg");
  if (el) el.remove();
}

async function sendChatMessage(question) {
  const text = (question || "").trim();
  if (!text || (typeof state !== 'undefined' && (state.chat.busy || !state.lesson))) return;

  appendMessage("user", text);
  if (typeof state !== 'undefined') state.chat.busy = true;
  enableChatInput(false);
  
  const input = document.getElementById("chatInput");
  if (input) input.value = "";
  autoResizeChatInput();
  showTypingIndicator();

  try {
    if (typeof state !== 'undefined' && state.isDemo) {
      await new Promise((r) => setTimeout(r, 650));
      hideTypingIndicator();
      appendMessage("ai", `This is a sample lesson, so I can't generate a real answer to "${text}." Process an actual YouTube video and I'll answer using only that video's transcript.`);
    } else {
      const answer = await callAskAPI(text);
      hideTypingIndicator();
      appendMessage("ai", answer || "I couldn't find anything about that in the lesson transcript.");
    }
    
    const unreadDot = document.getElementById("chatUnreadDot");
    if (typeof state !== 'undefined' && state.currentView !== "ask-ai" && unreadDot) unreadDot.hidden = false;
  } catch (err) {
    hideTypingIndicator();
    const message = (err && err.friendly) || "The assistant couldn't answer that. Try asking again.";
    const errWrap = appendMessage("error", message);
    errWrap.classList.add("message--error");
  } finally {
    if (typeof state !== 'undefined') state.chat.busy = false;
    enableChatInput(true);
    const focusInput = document.getElementById("chatInput");
    if (focusInput) focusInput.focus();
  }
}

async function callAskAPI(question) {
  if (typeof state === 'undefined' || !state.sessionId) {
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
  const el = document.getElementById("chatInput");
  if (!el) return;
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 140) + "px";
}

function initChat() {
  document.addEventListener("submit", (e) => {
    if (e.target && e.target.id === "chatForm") {
      e.preventDefault();
      const input = document.getElementById("chatInput");
      if (input) sendChatMessage(input.value);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.target && e.target.id === "chatInput") {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage(e.target.value);
      }
    }
  });

  document.addEventListener("input", (e) => {
    if (e.target && e.target.id === "chatInput") {
      autoResizeChatInput();
    }
  });

  document.addEventListener("click", (e) => {
    // 1. Clear Chat Button
    if (e.target.closest("#clearChatBtn")) {
      if (typeof state !== 'undefined' && state.chat) state.chat.messages = [];
      renderChatEmpty();
      if (typeof showToast === 'function') showToast("Chat cleared.", "info");
      return;
    }

    // 2. Question Item Click (Event Delegation)
    const qBtn = e.target.closest(".question-item");
    if (qBtn) {
      e.preventDefault();
      if (typeof window.setActiveView === 'function') {
        window.setActiveView("ask-ai");
      }
      
      const idx = qBtn.dataset.index;
      if (typeof state !== 'undefined' && state.lesson && state.lesson.questions) {
        const questionText = state.lesson.questions[idx];
        if (questionText) {
          setTimeout(() => {
            sendChatMessage(questionText);
          }, 150);
        }
      }
    }
  });
}

// Global Exports
window.enableChatInput = enableChatInput;
window.renderChatEmpty = renderChatEmpty;
window.appendMessage = appendMessage;
window.sendChatMessage = sendChatMessage;
window.initChat = initChat;