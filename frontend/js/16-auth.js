(function () {
  'use strict';

  let currentMode = 'login';

  function authErrorElement() {
    return document.getElementById("authError");
  }

  function showAuthError(message) {
    const error = authErrorElement();
    if (!error) return;
    error.textContent = message;
    error.hidden = false;
  }

  function clearAuthError() {
    const error = authErrorElement();
    if (!error) return;
    error.textContent = "";
    error.hidden = true;
  }

  function getResponseMessage(data, fallback) {
    if (typeof data?.detail === "string") return data.detail;
    if (Array.isArray(data?.detail)) {
      return data.detail
        .map((item) => item?.msg)
        .filter(Boolean)
        .join(" ");
    }
    return fallback;
  }

  function apiUrl(path) {
    const base = typeof state !== "undefined" && state.apiBase
      ? state.apiBase
      : window.location.origin;
    return `${base.replace(/\/+$/, "")}${path}`;
  }

  function clearAuthSession(showMessage = false) {
    localStorage.removeItem("lumen_token");
    localStorage.removeItem("lumen_user");
    checkAuthState();
    if (showMessage) {
      const modal = document.getElementById("authModal");
      if (modal) modal.hidden = false;
      if (typeof showToast === "function") {
        showToast("Your session expired. Please log in again.", "error");
      }
    }
  }

  async function authenticatedFetch(url, options = {}) {
    const token = localStorage.getItem("lumen_token");
    if (!token) {
      const modal = document.getElementById("authModal");
      if (modal) modal.hidden = false;
      const error = new Error("Please log in to continue.");
      error.friendly = error.message;
      throw error;
    }
    const headers = new Headers(options.headers || {});
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) clearAuthSession(true);
    return response;
  }

  function initAuth() {
    const form = document.getElementById("authForm");
    if (form) form.addEventListener("submit", handleEmailAuth);

    const passwordInput = document.getElementById("authPassword");
    const passwordToggle = document.getElementById("toggleAuthPassword");
    const eyeIcon = document.getElementById("passwordEyeIcon");
    const eyeOffIcon = document.getElementById("passwordEyeOffIcon");
    if (passwordInput && passwordToggle) {
      passwordToggle.addEventListener("click", () => {
        const showPassword = passwordInput.type === "password";
        passwordInput.type = showPassword ? "text" : "password";
        passwordToggle.setAttribute("aria-label", showPassword ? "Hide password" : "Show password");
        passwordToggle.setAttribute("aria-pressed", String(showPassword));
        if (eyeIcon) eyeIcon.hidden = showPassword;
        if (eyeOffIcon) eyeOffIcon.hidden = !showPassword;
        passwordInput.focus();
      });
    }

    checkAuthState();
    switchMode(currentMode);
    initGoogleAuth();

    document.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      if (target.closest("#profileBtn")) {
        if (!localStorage.getItem("lumen_token")) {
          const modal = document.getElementById("authModal");
          if (modal) modal.hidden = false;
          if (typeof closeDropdowns === "function") closeDropdowns();
        }
        return;
      }

      if (target.closest("#signOutBtn")) {
        clearAuthSession();
        if (typeof closeDropdowns === "function") closeDropdowns();
        if (typeof setActiveView === "function") setActiveView("dashboard");
        location.reload();
        return;
      }

      if (target.closest("#closeAuthBtn")) {
        const modal = document.getElementById("authModal");
        if (modal) modal.hidden = true;
        const passwordInput = document.getElementById("authPassword");
        const passwordToggle = document.getElementById("toggleAuthPassword");
        const eyeIcon = document.getElementById("passwordEyeIcon");
        const eyeOffIcon = document.getElementById("passwordEyeOffIcon");
        if (passwordInput) passwordInput.type = "password";
        if (passwordToggle) {
          passwordToggle.setAttribute("aria-label", "Show password");
          passwordToggle.setAttribute("aria-pressed", "false");
        }
        if (eyeIcon) eyeIcon.hidden = false;
        if (eyeOffIcon) eyeOffIcon.hidden = true;
        return;
      }

      if (target.closest("#tabLogin")) {
        switchMode("login");
        return;
      }

      if (target.closest("#tabRegister")) switchMode("register");
    });
  }

  async function waitForGoogleIdentity(timeoutMs = 10000) {
    const startedAt = Date.now();
    while (!(window.google && window.google.accounts && window.google.accounts.id)) {
      if (Date.now() - startedAt >= timeoutMs) {
        throw new Error("Google sign-in could not load. Check your connection and try again.");
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return window.google.accounts.id;
  }

  async function initGoogleAuth() {
    const container = document.getElementById("googleButtonContainer");
    const status = document.getElementById("googleAuthStatus");
    if (!container) return;

    try {
      const response = await fetch(apiUrl("/auth/config"));
      const config = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(getResponseMessage(config, "Could not load Google sign-in settings."));
      }
      if (!config.google_client_id) {
        throw new Error("Google sign-in is not configured on the server.");
      }

      const googleIdentity = await waitForGoogleIdentity();
      googleIdentity.initialize({
        client_id: config.google_client_id,
        callback: handleGoogleResponse
      });
      googleIdentity.renderButton(container, {
        theme: "outline",
        size: "large",
        width: 300
      });
      if (status) status.hidden = true;
    } catch (error) {
      if (status) {
        status.textContent = error.message || "Google sign-in is unavailable.";
        status.hidden = false;
      }
      console.error("Google sign-in initialization failed:", error);
    }
  }

  function switchMode(mode) {
    currentMode = mode === "register" ? "register" : "login";
    const isRegister = currentMode === "register";
    const tabLogin = document.getElementById("tabLogin");
    const tabRegister = document.getElementById("tabRegister");
    const nameField = document.getElementById("nameField");
    const nameInput = document.getElementById("authName");
    const passwordInput = document.getElementById("authPassword");
    const authTitle = document.getElementById("authTitle");
    const authSubmit = document.getElementById("authSubmit");
    const authSubmitLabel = document.getElementById("authSubmitLabel");
    const authLoginIcon = document.getElementById("authLoginIcon");
    const authRegisterIcon = document.getElementById("authRegisterIcon");

    if (tabLogin) tabLogin.classList.toggle("is-active", !isRegister);
    if (tabRegister) tabRegister.classList.toggle("is-active", isRegister);
    if (nameField) nameField.hidden = !isRegister;
    if (nameInput) nameInput.required = isRegister;
    if (passwordInput) {
      passwordInput.minLength = isRegister ? 8 : 1;
      passwordInput.maxLength = 72;
      passwordInput.autocomplete = isRegister ? "new-password" : "current-password";
    }
    if (authTitle) authTitle.textContent = isRegister ? "Create Account" : "Welcome Back";
    if (authSubmitLabel) authSubmitLabel.textContent = isRegister ? "Register" : "Log In";
    if (authSubmit) authSubmit.setAttribute("aria-label", isRegister ? "Register" : "Log in");
    if (authLoginIcon) authLoginIcon.hidden = isRegister;
    if (authRegisterIcon) authRegisterIcon.hidden = !isRegister;
    clearAuthError();
  }

  async function readJson(response) {
    return response.json().catch(() => ({}));
  }

  async function handleEmailAuth(event) {
    event.preventDefault();
    clearAuthError();

    const form = document.getElementById("authForm");
    const submit = document.getElementById("authSubmit");
    const submitLabel = document.getElementById("authSubmitLabel");
    const emailInput = document.getElementById("authEmail");
    const passwordInput = document.getElementById("authPassword");
    const nameInput = document.getElementById("authName");
    if (!form || !emailInput || !passwordInput) return;

    if (!form.reportValidity()) return;
    const isRegister = currentMode === "register";
    const endpoint = isRegister ? "/auth/register" : "/auth/login";
    const payload = {
      email: emailInput.value.trim(),
      password: passwordInput.value
    };
    if (isRegister && nameInput) payload.name = nameInput.value.trim();

    if (submit) {
      submit.disabled = true;
      if (submitLabel) submitLabel.textContent = isRegister ? "Creating account…" : "Signing in…";
    }
    try {
      const response = await fetch(apiUrl(endpoint), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await readJson(response);
      if (!response.ok) {
        throw new Error(getResponseMessage(data, "Authentication failed. Please try again."));
      }
      completeLogin(data);
    } catch (error) {
      showAuthError(error.message || "Could not reach the server. Check your connection.");
    } finally {
      if (submit) {
        submit.disabled = false;
        if (submitLabel) submitLabel.textContent = currentMode === "register" ? "Register" : "Log In";
      }
    }
  }

  async function handleGoogleResponse(response) {
    clearAuthError();
    if (!response?.credential) {
      showAuthError("Google did not return a sign-in credential. Please try again.");
      return;
    }
    try {
      const result = await fetch(apiUrl("/auth/google"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: response.credential })
      });
      const data = await readJson(result);
      if (!result.ok) {
        throw new Error(getResponseMessage(data, "Google sign-in failed. Please try again."));
      }
      completeLogin(data);
    } catch (error) {
      showAuthError(error.message || "Could not reach the server. Check your connection.");
    }
  }

  function completeLogin(data) {
    if (!data || typeof data.token !== "string" || !data.token || !data.email) {
      showAuthError("The server returned an incomplete sign-in response.");
      return;
    }

    try {
      localStorage.setItem("lumen_token", data.token);
      localStorage.setItem("lumen_user", JSON.stringify({
        name: data.name || "",
        email: data.email
      }));
    } catch (error) {
      showAuthError("Could not save your sign-in. Check your browser storage settings.");
      return;
    }

    const modal = document.getElementById("authModal");
    const form = document.getElementById("authForm");
    if (modal) modal.hidden = true;
    if (form) form.reset();
    switchMode("login");
    checkAuthState();
  }

  function checkAuthState() {
    const token = localStorage.getItem("lumen_token");
    const userString = localStorage.getItem("lumen_user");
    let user = null;

    if (token && userString) {
      try {
        user = JSON.parse(userString);
      } catch (error) {
        clearAuthSession();
        return;
      }
      if (!user || typeof user.email !== "string") {
        clearAuthSession();
        return;
      }
    } else if (token || userString) {
      clearAuthSession();
      return;
    }

    const nameEls = document.querySelectorAll(".dropdown-panel__name");
    const roleEls = document.querySelectorAll(".dropdown-panel__role");
    const avatarEls = document.querySelectorAll(".avatar");
    const historyList = document.getElementById("sidebarHistoryList");

    if (user) {
      const displayName = user.name || user.email;
      nameEls.forEach((element) => { element.textContent = displayName; });
      roleEls.forEach((element) => { element.textContent = "Logged in"; });
      avatarEls.forEach((element) => {
        element.textContent = user.name ? user.name.charAt(0).toUpperCase() : "@";
      });
      if (typeof window.fetchHistory === "function") window.fetchHistory();
    } else {
      nameEls.forEach((element) => { element.textContent = "Guest Account"; });
      roleEls.forEach((element) => { element.textContent = "Log in to save history"; });
      avatarEls.forEach((element) => { element.textContent = "@"; });
      if (historyList) {
        historyList.textContent = "";
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.className = "nav-item nav-item--history";
        button.disabled = true;
        button.textContent = "Log in to save history";
        item.append(button);
        historyList.append(item);
      }
    }
  }

  window.authenticatedFetch = authenticatedFetch;
  window.clearAuthSession = clearAuthSession;
  window.checkAuthState = checkAuthState;
  document.addEventListener("DOMContentLoaded", initAuth);
})();
