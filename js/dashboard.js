/**
 * Dashboard orchestrator: wires up navigation, theme toggle, modals and
 * kicks off every data listener once auth.js confirms who's signed in.
 */

/* ---------------------------- Theme ---------------------------- */

function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  const icon = document.querySelector("#theme-toggle .knob i");
  if (icon) icon.className = theme === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon";
}

(function initTheme() {
  applyTheme(localStorage.getItem("theme") || "light");
})();

document.getElementById("theme-toggle").addEventListener("click", () => {
  const next = document.body.getAttribute("data-theme") === "dark" ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem("theme", next);
  // Rebuild charts so their text/grid colors match the new theme.
  updateAllCharts();
  if (isAdmin() && document.getElementById("section-admin")?.classList.contains("active")) renderAdminCharts();
});

/* ---------------------------- Navigation ---------------------------- */

const SECTION_TITLES = {
  dashboard: "Dashboard",
  expenses: "Expenses",
  categories: "Categories",
  budget: "Budget Tracking",
  reports: "Reports",
  admin: "Admin Panel"
};

function switchSection(name) {
  document.querySelectorAll(".nav-item[data-section]").forEach((el) => el.classList.toggle("active", el.dataset.section === name));
  document.querySelectorAll(".page-section").forEach((el) => el.classList.toggle("active", el.id === `section-${name}`));
  document.getElementById("page-title").textContent = SECTION_TITLES[name] || "Dashboard";
  closeSidebarMobile();

  if (name === "reports") renderReport();
  if (name === "admin" && isAdmin()) renderAdminAll();
}

document.querySelectorAll(".nav-item[data-section]").forEach((item) => {
  item.addEventListener("click", () => switchSection(item.dataset.section));
});

/* ---------------------------- Mobile sidebar ---------------------------- */

function openSidebarMobile() {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("sidebar-overlay").classList.add("active");
}
function closeSidebarMobile() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebar-overlay").classList.remove("active");
}
document.getElementById("hamburger-btn").addEventListener("click", openSidebarMobile);
document.getElementById("sidebar-overlay").addEventListener("click", closeSidebarMobile);

/* ---------------------------- Modals ---------------------------- */

document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => closeModal(btn.dataset.close));
});

document.querySelectorAll(".modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.remove("active");
  });
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".modal-overlay.active").forEach((el) => el.classList.remove("active"));
  }
});

document.getElementById("fab-add-expense").addEventListener("click", () => openExpenseModal());
document.getElementById("add-expense-btn-inline").addEventListener("click", () => openExpenseModal());

/* ---------------------------- Static select population ---------------------------- */

function populatePaymentSelects() {
  const selects = [document.getElementById("expense-payment"), document.getElementById("filter-payment")].filter(Boolean);
  selects.forEach((select) => {
    const isFilter = select.id === "filter-payment";
    select.innerHTML = isFilter ? '<option value="">All Payment Methods</option>' : "";
    PAYMENT_METHODS.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.label;
      select.appendChild(opt);
    });
  });
}

/* ---------------------------- Boot sequence ---------------------------- */

window.addEventListener("auth-ready", ({ detail }) => {
  populatePaymentSelects();
  startCategoriesListener();
  startExpensesListener();
  startBudgetListener();

  if (detail.admin) {
    initAdmin();
  }

  const loader = document.getElementById("page-loader");
  if (loader) {
    loader.classList.add("fade-out");
    setTimeout(() => loader.remove(), 350);
  }
});
