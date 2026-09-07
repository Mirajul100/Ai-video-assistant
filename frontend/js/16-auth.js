// LUMEN — AI Lesson Assistant
// Section 16: AUTHENTICATION & HISTORY

(function () {
  'use strict';

  let currentMode = 'login'; 
  let googleInitialized = false;

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
    
    // Initialize Google Auth with proper error handling
    initGoogleAuth();
  }

  function initGoogleAuth() {
    // Don't initialize multiple times
    if (googleInitialized) return;
    
    // Check if Google library is loaded
    if (!window.google || !window.google.accounts) {
      console.warn('Google Sign-In library not loaded yet, retrying...');
      setTimeout(initGoogleAuth, 500);
      return;
    }

    try {
      // Get the current origin to verify
      const currentOrigin = window.location.origin;
      console.log('Current Origin:', currentOrigin);
      console.log('Expected origins: http://127.0.0.1:8000, http://localhost:8000');
      
      // CRITICAL: Make sure this matches your Google Cloud Console configuration
      const clientId = "116809433079-fnqab7j5nu6t5q4t3mm5fm3oc9dcrid5.apps.googleusercontent.com";
      
      // Initialize Google Sign-In
      google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleResponse,
        cancel_on_tap_outside: false,
        // Force popup mode for local development
        ux_mode: 'popup',
        // Add context for better UX
        context: 'signin',
        // Disable auto prompt to avoid issues
        auto_select: false,
        // For debugging
        itp_support: true
      });

      // Render the button
      const container = document.getElementById("googleButtonContainer");
      if (container) {
        google.accounts.id.renderButton(
          container,
          { 
            theme: "outline", 
            size: "large", 
            width: 300,
            type: 'standard',
            shape: 'rectangular',
            text: 'signin_with',
            logo_alignment: 'left'
          }
        );
        googleInitialized = true;
        console.log('Google Sign-In initialized successfully');
      } else {
        console.error('Google button container not found');
      }
    } catch (error) {
      console.error('Failed to initialize Google Sign-In:', error);
    }
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
      console.log('Google response received:', response);
      
      // Validate the response
      if (!response || !response.credential) {
        throw new Error('Invalid Google response');
      }

      const res = await fetch(`${state.apiBase}/auth/google`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ token: response.credential })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || "Google authentication failed");
      }
      
      completeLogin(data);
    } catch (err) {
      console.error('Google login error:', err);
      $("#authError").textContent = err.message || "Google authentication failed. Please try again.";
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
      try {
        const user = JSON.parse(userStr);
        $(".dropdown-panel__name").textContent = user.name || user.email;
        $(".dropdown-panel__role").textContent = "Logged in";
        $(".avatar").textContent = user.name ? user.name.charAt(0).toUpperCase() : "@";
        fetchHistory();
      } catch (e) {
        console.error('Error parsing user data:', e);
        // Clear invalid data
        localStorage.removeItem("lumen_token");
        localStorage.removeItem("lumen_user");
        checkAuthState();
      }
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
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
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
        if (data && data.history) {
          renderHistory(data.history);
        }
      }
    } catch (e) {
      console.error("Failed to fetch history:", e);
    }
  }

  function renderHistory(historyItems) {
    const list = $("#sidebarHistoryList");
    if (!historyItems || historyItems.length === 0) {
      list.innerHTML = `<li><button class="nav-item nav-item--history" disabled>No recent lessons</button></li>`;
      return;
    }

    list.innerHTML = historyItems.map(item => `
      <li>
        <button class="nav-item nav-item--history" data-session="${item.session_id || item.id}">
          <span class="nav-item__icon">{{icon:doc}}</span>
          <span class="nav-item__label">${escapeHtml(item.title || 'Untitled Lesson')}</span>
        </button>
      </li>
    `).join("");
    
    if (typeof inflateIcons === 'function') inflateIcons();
  }

  $("#sidebarHistoryList").addEventListener("click", async (e) => {
    const btn = e.target.closest(".nav-item--history");
    if (!btn || btn.disabled) return;
    
    const sessionId = btn.dataset.session;
    if (sessionId) {
      await loadSavedLesson(sessionId);
    }
  });

  async function loadSavedLesson(sessionId) {
    if (typeof updateSidebarChip === 'function') updateSidebarChip("busy", "Loading lesson...");
    
    try {
      const token = localStorage.getItem("lumen_token");
      if (!token) {
        showToast("Please log in to view saved lessons", "error");
        return;
      }

      const res = await fetch(`${state.apiBase}/lesson/${sessionId}`, {
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Could not load lesson data");
      }
      
      const data = await res.json();
      
      if (typeof applyLessonData === 'function') {
        applyLessonData(data, data.title || "Saved Lesson");
      }
      
      if (typeof updateSidebarChip === 'function') updateSidebarChip("ready", data.title || "Lesson loaded");
      if (typeof setActiveView === 'function') setActiveView("dashboard");
      
      showToast("Lesson loaded successfully", "success");
      
    } catch (err) {
      console.error('Error loading lesson:', err);
      showToast(err.message || "Failed to load the selected lesson.", "error");
      if (typeof updateSidebarChip === 'function') updateSidebarChip("error", "Load failed");
    }
  }

  // Patch fetch to include auth token
  if (!window.__isFetchPatched) {
    const originalFetch = window.fetch;
    window.fetch = async function(url, options = {}) {
      const token = localStorage.getItem("lumen_token");
      
      // Only add token for API calls
      if (token && typeof state !== 'undefined' && state.apiBase && String(url).startsWith(state.apiBase)) {
        options.headers = new Headers(options.headers || {});
        if (!options.headers.has('Authorization')) {
          options.headers.set("Authorization", `Bearer ${token}`);
        }
      }
      
      return originalFetch(url, options);
    };
    window.__isFetchPatched = true;
  }

  // Retry Google initialization if it fails
  let retryCount = 0;
  const maxRetries = 5;
  
  function retryGoogleInit() {
    if (!googleInitialized && retryCount < maxRetries) {
      retryCount++;
      console.log(`Retrying Google initialization (attempt ${retryCount}/${maxRetries})...`);
      setTimeout(initGoogleAuth, 1000 * retryCount);
    }
  }

  // Listen for Google library load
  window.addEventListener('load', function() {
    // If not initialized after 2 seconds, retry
    setTimeout(() => {
      if (!googleInitialized) {
        retryGoogleInit();
      }
    }, 2000);
  });

  document.addEventListener("DOMContentLoaded", initAuth);
  
  // Export for debugging
  window.__authHelpers = {
    initGoogleAuth,
    retryGoogleInit,
    googleInitialized: () => googleInitialized
  };
})();