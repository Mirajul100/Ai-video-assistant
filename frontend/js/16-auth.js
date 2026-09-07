// LUMEN — AI Lesson Assistant
// Section 16: AUTHENTICATION & HISTORY

(function () {
  'use strict';

  let currentMode = 'login'; 

  function initAuth() {
    const modal = $("#authModal");
    const closeBtn = $("#closeAuthBtn");
    const form = $("#authForm");
    
    $("#profileBtn").addEventListener("click", () => {
      if (!localStorage.getItem("lumen_token")) {
        modal.hidden = false;
        if (typeof closeDropdowns === 'function') closeDropdowns(); 
      }
    });

    closeBtn.addEventListener("click", () => modal.hidden = true);
    $("#tabLogin").addEventListener("click", () => switchMode('login'));
    $("#tabRegister").addEventListener("click", () => switchMode('register'));
    form.addEventListener("submit", handleEmailAuth);

    const oldSignOut = $("#signOutBtn");
    const newSignOut = oldSignOut.cloneNode(true);
    oldSignOut.parentNode.replaceChild(newSignOut, oldSignOut);

    newSignOut.addEventListener("click", () => {
      localStorage.removeItem("lumen_token");
      localStorage.removeItem("lumen_user");
      checkAuthState();
      showToast("Logged out", "info");
      if (typeof closeDropdowns === 'function') closeDropdowns();
    });

    checkAuthState();
    initGoogleAuth();
  }

  function initGoogleAuth() {
    const checkGoogle = setInterval(() => {
      if (window.google && window.google.accounts) {
        clearInterval(checkGoogle);
        google.accounts.id.initialize({
          client_id: "116809433079-fnqab7j5nu6t5q4t3mm5fm3oc9dcrid5.apps.googleusercontent.com", 
          callback: handleGoogleResponse
        });
        google.accounts.id.renderButton(
          document.getElementById("googleButtonContainer"),
          { theme: "outline", size: "large", width: "300" }
        );
      }
    }, 100); 
  }

  function switchMode(mode) {
    currentMode = mode;
    $("#tabLogin").classList.toggle("is-active", mode === 'login');
    $("#tabRegister").classList.toggle("is-active", mode === 'register');
    $("#nameField").hidden = mode === 'login';
    $("#authTitle").textContent = mode === 'login' ? 'Welcome Back' : 'Create Account';
    $("#authSubmit").textContent = mode === 'login' ? 'Log In' : 'Register';
    $("#authError").hidden = true;
  }

  async function handleEmailAuth(e) {
    e.preventDefault();
    const endpoint = currentMode === 'login' ? '/auth/login' : '/auth/register';
    
    const payload = {
      email: $("#authEmail").value,
      password: $("#authPassword").value,
      name: currentMode === 'register' ? $("#authName").value : undefined
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
      $("#authError").textContent = err.message;
      $("#authError").hidden = false;
    }
  }

  async function handleGoogleResponse(response) {
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
      $("#authError").textContent = err.message;
      $("#authError").hidden = false;
    }
  }

  function completeLogin(data) {
    localStorage.setItem("lumen_token", data.token);
    localStorage.setItem("lumen_user", JSON.stringify({ name: data.name, email: data.email }));
    $("#authModal").hidden = true;
    $("#authForm").reset();
    showToast("Logged in successfully", "success");
    checkAuthState();
  }

  function checkAuthState() {
    const token = localStorage.getItem("lumen_token");
    const userStr = localStorage.getItem("lumen_user");
    
    if (token && userStr) {
      const user = JSON.parse(userStr);
      $(".dropdown-panel__name").textContent = user.name || user.email;
      $(".dropdown-panel__role").textContent = "Logged in";
      $(".avatar").textContent = user.name ? user.name.charAt(0).toUpperCase() : "@";
      fetchHistory();
    } else {
      $(".dropdown-panel__name").textContent = "Guest Account";
      $(".dropdown-panel__role").textContent = "Log in to save history";
      $(".avatar").textContent = "@";
      $("#sidebarHistoryList").innerHTML = `<li><button class="nav-item nav-item--history" disabled>Log in to save history</button></li>`;
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
        showToast("Session expired. Please log in again.", "error");
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
    const list = $("#sidebarHistoryList");
    if (historyItems.length === 0) {
      list.innerHTML = `<li><button class="nav-item nav-item--history" disabled>No recent lessons</button></li>`;
      return;
    }

    list.innerHTML = historyItems.map(item => `
      <li>
        <button class="nav-item nav-item--history" data-session="${item.session_id}">
          <span class="nav-item__icon">{{icon:doc}}</span>
          <span class="nav-item__label">${escapeHtml(item.title)}</span>
        </button>
      </li>
    `).join("");
    
    if (typeof inflateIcons === 'function') inflateIcons();
  }

  const originalFetch = window.fetch;
  window.fetch = async function(url, options = {}) {
    const token = localStorage.getItem("lumen_token");
    
    if (token && typeof state !== 'undefined' && String(url).startsWith(state.apiBase)) {
      options.headers = new Headers(options.headers || {});
      options.headers.set("Authorization", `Bearer ${token}`);
    }
    
    return originalFetch(url, options);
  };

  document.addEventListener("DOMContentLoaded", initAuth);
})();