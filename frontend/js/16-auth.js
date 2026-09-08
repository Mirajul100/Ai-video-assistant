(function () {
  'use strict';

  let currentMode = 'login'; 

  function initAuth() {
    const form = document.getElementById("authForm");
    if (form) {
      form.addEventListener("submit", handleEmailAuth);
    }

    checkAuthState();
    initGoogleAuth();
    
    document.addEventListener("click", (e) => {
      if (e.target.closest("#profileBtn")) {
        if (!localStorage.getItem("lumen_token")) {
          const modal = document.getElementById("authModal");
          if (modal) modal.hidden = false;
          if (typeof closeDropdowns === 'function') closeDropdowns();
        }
        return;
      }

      if (e.target.closest("#signOutBtn")) {
        localStorage.removeItem("lumen_token");
        localStorage.removeItem("lumen_user");
        checkAuthState();
        
        if (typeof showToast === 'function') showToast("Logged out", "info");
        if (typeof closeDropdowns === 'function') closeDropdowns();
        if (typeof setActiveView === 'function') setActiveView("dashboard");
        return;
      }

      if (e.target.closest("#closeAuthBtn")) {
        const modal = document.getElementById("authModal");
        if (modal) modal.hidden = true;
        return;
      }

      if (e.target.closest("#tabLogin")) {
        switchMode('login');
        return;
      }
      if (e.target.closest("#tabRegister")) {
        switchMode('register');
        return;
      }
      
      const historyBtn = e.target.closest(".nav-item--history");
      if (historyBtn && !historyBtn.disabled) {
        const sessionId = historyBtn.dataset.session;
        if (sessionId) {
          loadSavedLesson(sessionId);
        }
      }
    });
  }

  function initGoogleAuth() {
    const checkGoogle = setInterval(() => {
      if (window.google && window.google.accounts) {
        clearInterval(checkGoogle);
        google.accounts.id.initialize({
          client_id: "116809433079-fnqab7j5nu6t5q4t3mm5fm3oc9dcrid5.apps.googleusercontent.com", 
          callback: handleGoogleResponse
        });
        const btnContainer = document.getElementById("googleButtonContainer");
        if (btnContainer) {
          google.accounts.id.renderButton(
            btnContainer,
            { theme: "outline", size: "large", width: 300 } 
          );
        }
      }
    }, 100); 
  }

  function switchMode(mode) {
    currentMode = mode;
    const tabLogin = document.getElementById("tabLogin");
    const tabRegister = document.getElementById("tabRegister");
    const nameField = document.getElementById("nameField");
    const authTitle = document.getElementById("authTitle");
    const authSubmit = document.getElementById("authSubmit");
    const authError = document.getElementById("authError");

    if (tabLogin) tabLogin.classList.toggle("is-active", mode === 'login');
    if (tabRegister) tabRegister.classList.toggle("is-active", mode === 'register');
    if (nameField) nameField.hidden = mode === 'login';
    if (authTitle) authTitle.textContent = mode === 'login' ? 'Welcome Back' : 'Create Account';
    if (authSubmit) authSubmit.textContent = mode === 'login' ? 'Log In' : 'Register';
    if (authError) authError.hidden = true;
  }

  async function handleEmailAuth(e) {
    e.preventDefault();
    const endpoint = currentMode === 'login' ? '/auth/login' : '/auth/register';
    
    const emailEl = document.getElementById("authEmail");
    const passEl = document.getElementById("authPassword");
    const nameEl = document.getElementById("authName");
    const errorEl = document.getElementById("authError");
    
    const payload = {
      email: emailEl ? emailEl.value : "",
      password: passEl ? passEl.value : "",
      name: (currentMode === 'register' && nameEl) ? nameEl.value : undefined
    };

    try {
      const res = await fetch(`${state.apiBase}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Authentication failed");
      
      completeLogin(data);
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
      }
    }
  }

  async function handleGoogleResponse(response) {
    const errorEl = document.getElementById("authError");
    try {
      const res = await fetch(`${state.apiBase}/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: response.credential })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error("Google authentication failed");
      
      completeLogin(data);
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
      }
    }
  }

  function completeLogin(data) {
    localStorage.setItem("lumen_token", data.token);
    localStorage.setItem("lumen_user", JSON.stringify({ name: data.name, email: data.email }));
    
    const modal = document.getElementById("authModal");
    const form = document.getElementById("authForm");
    if (modal) modal.hidden = true;
    if (typeof showToast === 'function') showToast("Logged in successfully", "success");
    if (form) form.reset();
    checkAuthState();
  }

  function checkAuthState() {
    const token = localStorage.getItem("lumen_token");
    const userStr = localStorage.getItem("lumen_user");
    
    const nameEls = document.querySelectorAll(".dropdown-panel__name");
    const roleEls = document.querySelectorAll(".dropdown-panel__role");
    const avatarEls = document.querySelectorAll(".avatar");
    const historyList = document.getElementById("sidebarHistoryList");
    
    if (token && userStr) {
      const user = JSON.parse(userStr);
      nameEls.forEach(el => el.textContent = user.name || user.email);
      roleEls.forEach(el => el.textContent = "Logged in");
      avatarEls.forEach(el => el.textContent = user.name ? user.name.charAt(0).toUpperCase() : "@");
      fetchHistory();
    } else {
      nameEls.forEach(el => el.textContent = "Guest Account");
      roleEls.forEach(el => el.textContent = "Log in to save history");
      avatarEls.forEach(el => el.textContent = "@");
      if (historyList) {
        historyList.innerHTML = `<li><button class="nav-item nav-item--history" disabled>Log in to save history</button></li>`;
      }
    }
  }

  async function fetchHistory() {
    const token = localStorage.getItem("lumen_token");
    if (!token) return;

    try {
      const res = await fetch(`${state.apiBase}/history`, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (res.status === 401) {
        localStorage.removeItem("lumen_token");
        localStorage.removeItem("lumen_user");
        checkAuthState();
        if (typeof showToast === 'function') showToast("Session expired. Please log in again.", "error");
        return;
      }

      if (res.ok) {
        const data = await res.json();
        renderHistory(data.history);
      }
    } catch (e) {
      console.error("Failed to fetch history");
    }
  }

  function renderHistory(historyItems) {
    const list = document.getElementById("sidebarHistoryList");
    if (!list) return;
    
    if (!historyItems || historyItems.length === 0) {
      list.innerHTML = `<li><button class="nav-item nav-item--history" disabled>No recent lessons</button></li>`;
      return;
    }

    const docIcon = (typeof ICONS !== 'undefined' && ICONS.doc) ? ICONS.doc : '📄';

    list.innerHTML = historyItems.map(item => `
      <li>
        <button class="nav-item nav-item--history" data-session="${item.session_id}">
          <span class="nav-item__icon">${docIcon}</span>
          <span class="nav-item__label">${typeof escapeHtml === 'function' ? escapeHtml(item.title) : item.title}</span>
        </button>
      </li>
    `).join("");
    
    if (typeof inflateIcons === 'function') inflateIcons();
  }

  async function loadSavedLesson(sessionId) {
    if (typeof updateSidebarChip === 'function') updateSidebarChip("busy", "Loading lesson...");
    
    try {
      const token = localStorage.getItem("lumen_token");
      const res = await fetch(`${state.apiBase}/lesson/${sessionId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Could not load lesson data");
      }
      
      let data = await res.json();
      
      if (typeof data.key_points === 'string') {
        try { data.key_points = JSON.parse(data.key_points); } catch(e) { data.key_points = [data.key_points]; }
      }
      if (typeof data.questions === 'string') {
        try { data.questions = JSON.parse(data.questions); } catch(e) { data.questions = [data.questions]; }
      }
      if (!data.session_id) {
        data.session_id = sessionId;
      }
      
      if (typeof window.applyLessonData === 'function') {
        window.applyLessonData(data, "Saved Lesson");
      }
      
      if (typeof updateSidebarChip === 'function') updateSidebarChip("ready", data.title || "Lesson");
      if (typeof setActiveView === 'function') setActiveView("dashboard");
      if (typeof showToast === 'function') showToast("Lesson loaded successfully", "success");
      
    } catch (err) {
      console.error("Load Lesson Error:", err);
      if (typeof showToast === 'function') showToast(err.message || "Failed to load the selected lesson.", "error");
      if (typeof updateSidebarChip === 'function') updateSidebarChip("error", "Load failed");
    }
  }

  if (!window.__isFetchPatched) {
    const originalFetch = window.fetch;
    window.fetch = async function(url, options = {}) {
      const token = localStorage.getItem("lumen_token");
      
      if (token && typeof state !== 'undefined' && String(url).startsWith(state.apiBase)) {
        options.headers = new Headers(options.headers || {});
        options.headers.set("Authorization", `Bearer ${token}`);
      }
      
      return originalFetch(url, options);
    };
    window.__isFetchPatched = true;
  }

  window.fetchHistory = fetchHistory;
  document.addEventListener("DOMContentLoaded", initAuth);
})();