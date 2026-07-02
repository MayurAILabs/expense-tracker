/**
 * Shared helper functions used across every page: toasts, confirm dialogs,
 * date range calculations, formatting and small DOM utilities.
 */

/* ---------------------------- Toast notifications --------------------------- */

function showToast(message, type = "info", duration = 3500) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const icons = {
    success: "fa-circle-check",
    error: "fa-circle-exclamation",
    warning: "fa-triangle-exclamation",
    info: "fa-circle-info"
  };

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast-out");
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

/* ---------------------------- Confirm dialog --------------------------- */

/**
 * Shows a reusable confirmation modal and resolves `true`/`false` based on
 * the user's choice. Expects a #confirm-modal overlay to exist in the DOM
 * (injected via dashboard.html).
 */
function confirmDialog({ title = "Are you sure?", message = "", confirmText = "Delete", danger = true } = {}) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("confirm-modal");
    if (!overlay) {
      resolve(window.confirm(message || title));
      return;
    }
    overlay.querySelector(".confirm-title").textContent = title;
    overlay.querySelector(".confirm-message").textContent = message;
    const confirmBtn = overlay.querySelector(".confirm-ok-btn");
    const cancelBtn = overlay.querySelector(".confirm-cancel-btn");
    confirmBtn.textContent = confirmText;
    confirmBtn.className = `btn ${danger ? "btn-danger" : "btn-primary"} confirm-ok-btn`;

    const cleanup = (result) => {
      overlay.classList.remove("active");
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
      resolve(result);
    };
    const onConfirm = () => cleanup(true);
    const onCancel = () => cleanup(false);

    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
    overlay.classList.add("active");
  });
}

/* ---------------------------- Formatting --------------------------- */

function formatCurrency(amount) {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(value);
}

function formatDate(date, opts = {}) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", ...opts });
}

function formatTime(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${m} ${period}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = String(str ?? "");
  return div.innerHTML;
}

function initials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/* ---------------------------- Date range helpers --------------------------- */

function startOfDay(d = new Date()) {
  const nd = new Date(d);
  nd.setHours(0, 0, 0, 0);
  return nd;
}
function endOfDay(d = new Date()) {
  const nd = new Date(d);
  nd.setHours(23, 59, 59, 999);
  return nd;
}
function startOfWeek(d = new Date()) {
  const nd = startOfDay(d);
  const day = nd.getDay(); // 0 = Sunday
  nd.setDate(nd.getDate() - day);
  return nd;
}
function endOfWeek(d = new Date()) {
  const nd = startOfWeek(d);
  nd.setDate(nd.getDate() + 6);
  return endOfDay(nd);
}
function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function endOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
function startOfYear(d = new Date()) {
  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
}
function endOfYear(d = new Date()) {
  return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
}

const DATE_RANGES = {
  today: () => ({ start: startOfDay(), end: endOfDay() }),
  yesterday: () => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return { start: startOfDay(y), end: endOfDay(y) };
  },
  week: () => ({ start: startOfWeek(), end: endOfWeek() }),
  month: () => ({ start: startOfMonth(), end: endOfMonth() }),
  year: () => ({ start: startOfYear(), end: endOfYear() })
};

/* ---------------------------- Modal open/close --------------------------- */

function openModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.add("active");
}

function closeModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.remove("active");
}

/* ---------------------------- Misc --------------------------- */

function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Converts a Firestore Timestamp, ISO string, or Date into a JS Date. */
function toJsDate(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  return new Date(value);
}

/** Downloads a string as a file (used for CSV export). */
function downloadFile(filename, content, mime = "text/csv;charset=utf-8;") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Converts an array of expense objects into a CSV string. */
function expensesToCsv(expenses) {
  const headers = ["Date", "Time", "Name", "Category", "Amount", "Payment Method", "Notes"];
  const rows = expenses.map((e) => [
    e.date,
    e.time || "",
    e.expenseName,
    e.category,
    e.amount,
    e.paymentMethod,
    (e.notes || "").replace(/[\r\n,]+/g, " ")
  ]);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  return csv;
}
