// LUMEN — AI Lesson Assistant
// Section 4: TOASTS & NOTIFICATIONS

function showToast(message, type = "info", duration = 3000) {
  const stack = $("#toastStack");

  if (!stack) return;

  const existingToast = [...stack.querySelectorAll(".toast")]
    .find(toast => toast.dataset.message === message);

  if (existingToast) return;

  const toast = document.createElement("div");

  toast.className = `toast toast--${type}`;
  toast.dataset.message = message;

  const icon =
    type === "success"
      ? ICONS.check
      : type === "error"
        ? ICONS.alert
        : ICONS.sparkle;

  toast.innerHTML = `
    <span class="toast__icon">${icon}</span>
    <span>${escapeHtml(message)}</span>
  `;

  stack.appendChild(toast);

  setTimeout(() => {
    toast.style.transition =
      "opacity 200ms ease, transform 200ms ease";
    toast.style.opacity = "0";
    toast.style.transform = "translateX(16px)";

    setTimeout(() => toast.remove(), 220);
  }, duration);
}

function pushNotification(text) {
  state.notifications.unshift({
    text,
    time: new Date()
  });

  renderNotifications();
}

function renderNotifications() {
  const list = $("#notifList");
  const badge = $("#notifBadge");

  if (!list || !badge) return;

  if (state.notifications.length === 0) {
    list.innerHTML = `
      <li class="notif-empty">
        You're all caught up.
      </li>
    `;

    badge.hidden = true;
    return;
  }

  list.innerHTML = state.notifications
    .map(
      (n) => `
        <li class="notif-item">
          <span class="notif-item__icon">
            ${ICONS.sparkle}
          </span>

          <div>
            <p class="notif-item__text">
              ${escapeHtml(n.text)}
            </p>

            <p class="notif-item__time">
              ${relativeTime(n.time)}
            </p>
          </div>
        </li>
      `
    )
    .join("");

  badge.hidden = false;
  badge.textContent = String(
    state.notifications.length
  );
}