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
        
        if (typeof closeDropdowns === 'function') closeDropdowns();
        if (typeof setActiveView === 'function') setActiveView("dashboard");
        location.reload();
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
      
      // Call fetchHistory from the history module if it exists
      if (typeof window.fetchHistory === 'function') {
        window.fetchHistory();
      }
    } else {
      nameEls.forEach(el => el.textContent = "Guest Account");
      roleEls.forEach(el => el.textContent = "Log in to save history");
      avatarEls.forEach(el => el.textContent = "@");
      if (historyList) {
        historyList.innerHTML = `<li><button class="nav-item nav-item--history" disabled>Log in to save history</button></li>`;
      }
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

  window.checkAuthState = checkAuthState;
  document.addEventListener("DOMContentLoaded", initAuth);
})();