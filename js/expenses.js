/**
 * Expense CRUD + real-time sync + list rendering + filtering/sorting +
 * dashboard summary card calculations. Every query here is scoped to the
 * signed-in user's own uid, matching the Firestore security rules.
 */

let allExpenses = []; // Raw list for the current user, newest first.
let expensesUnsubscribe = null;

function expensesCollection() {
  return db.collection(COLLECTIONS.expenses);
}

/** Real-time listener: keeps allExpenses in sync with Firestore. */
function startExpensesListener() {
  if (expensesUnsubscribe) expensesUnsubscribe();
  expensesUnsubscribe = expensesCollection()
    .where("uid", "==", currentUser.uid)
    .onSnapshot(
      (snapshot) => {
        allExpenses = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        allExpenses.sort((a, b) => `${b.date}T${b.time || "00:00"}`.localeCompare(`${a.date}T${a.time || "00:00"}`));
        onExpensesChanged();
      },
      (err) => {
        console.error("Expenses listener error:", err);
        showToast("Could not load expenses", "error");
      }
    );
}

/** Called whenever the expense list changes, refreshes every dependent view. */
function onExpensesChanged() {
  populateMonthYearFilters();
  renderDashboardSummary();
  renderRecentTransactions();
  renderFullExpenseList();
  window.dispatchEvent(new CustomEvent("expenses-updated"));
}

/* ---------------------------- CRUD ---------------------------- */

function openExpenseModal(expense = null) {
  document.getElementById("expense-modal-title").textContent = expense ? "Edit Expense" : "Add Expense";
  document.getElementById("expense-id").value = expense ? expense.id : "";
  document.getElementById("expense-name").value = expense ? expense.expenseName : "";
  document.getElementById("expense-amount").value = expense ? expense.amount : "";
  document.getElementById("expense-payment").value = expense ? expense.paymentMethod : "";
  document.getElementById("expense-notes").value = expense ? expense.notes || "" : "";

  const categorySelect = document.getElementById("expense-category");
  if (expense) {
    // If this expense's category isn't in our own list (e.g. an admin editing
    // another user's custom category), inject a temporary option so we don't
    // silently reassign it to a different category on save.
    if (![...categorySelect.options].some((o) => o.value === expense.category)) {
      const opt = document.createElement("option");
      opt.value = expense.category;
      opt.textContent = expense.categoryLabel || expense.category;
      opt.dataset.temp = "true";
      categorySelect.appendChild(opt);
    }
    categorySelect.value = expense.category;
  }

  const now = new Date();
  document.getElementById("expense-date").value = expense ? expense.date : now.toISOString().slice(0, 10);
  document.getElementById("expense-time").value = expense ? expense.time : now.toTimeString().slice(0, 5);

  openModal("expense-modal");
}

async function saveExpenseFromForm(e) {
  e.preventDefault();
  const id = document.getElementById("expense-id").value;
  const categoryId = document.getElementById("expense-category").value;
  const categoryMeta = getCategoryMeta(categoryId);

  const payload = {
    expenseName: document.getElementById("expense-name").value.trim(),
    amount: parseFloat(document.getElementById("expense-amount").value) || 0,
    category: categoryId,
    categoryLabel: categoryMeta.label,
    paymentMethod: document.getElementById("expense-payment").value,
    date: document.getElementById("expense-date").value,
    time: document.getElementById("expense-time").value,
    notes: document.getElementById("expense-notes").value.trim(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    if (id) {
      // Ownership fields (uid/userEmail/userName) are intentionally left
      // untouched on update, even when an admin edits another user's expense.
      await expensesCollection().doc(id).update(payload);
      showToast("Expense updated", "success");
    } else {
      payload.uid = currentUser.uid;
      payload.userEmail = currentUser.email;
      payload.userName = currentUser.displayName || currentUser.email;
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      payload.timestamp = firebase.firestore.FieldValue.serverTimestamp();
      await expensesCollection().add(payload);
      showToast("Expense added", "success");
    }
    closeModal("expense-modal");
    e.target.reset();
    document.querySelectorAll('#expense-category option[data-temp="true"]').forEach((o) => o.remove());
  } catch (err) {
    console.error("Failed to save expense:", err);
    showToast("Could not save expense", "error");
  } finally {
    submitBtn.disabled = false;
  }
}

async function deleteExpense(id) {
  const ok = await confirmDialog({
    title: "Delete expense?",
    message: "This action cannot be undone.",
    confirmText: "Delete"
  });
  if (!ok) return;
  try {
    await expensesCollection().doc(id).delete();
    showToast("Expense deleted", "success");
  } catch (err) {
    console.error("Failed to delete expense:", err);
    showToast("Could not delete expense", "error");
  }
}

document.getElementById("expense-form").addEventListener("submit", saveExpenseFromForm);

/* ---------------------------- Filtering & sorting ---------------------------- */

function getFilterValues() {
  return {
    search: (document.getElementById("expense-search")?.value || "").trim().toLowerCase(),
    category: document.getElementById("filter-category")?.value || "",
    payment: document.getElementById("filter-payment")?.value || "",
    month: document.getElementById("filter-month")?.value || "",
    year: document.getElementById("filter-year")?.value || "",
    minAmount: parseFloat(document.getElementById("filter-min-amount")?.value) || null,
    maxAmount: parseFloat(document.getElementById("filter-max-amount")?.value) || null,
    sort: document.getElementById("sort-expenses")?.value || "latest"
  };
}

function getFilteredExpenses(source = allExpenses) {
  const f = getFilterValues();
  let result = source.filter((exp) => {
    if (f.search) {
      const haystack = `${exp.expenseName} ${exp.categoryLabel || ""}`.toLowerCase();
      if (!haystack.includes(f.search)) return false;
    }
    if (f.category && exp.category !== f.category) return false;
    if (f.payment && exp.paymentMethod !== f.payment) return false;
    if (f.month && exp.date && exp.date.slice(5, 7) !== f.month) return false;
    if (f.year && exp.date && exp.date.slice(0, 4) !== f.year) return false;
    if (f.minAmount !== null && exp.amount < f.minAmount) return false;
    if (f.maxAmount !== null && exp.amount > f.maxAmount) return false;
    return true;
  });

  const key = (exp) => `${exp.date}T${exp.time || "00:00"}`;
  switch (f.sort) {
    case "oldest":
      result.sort((a, b) => key(a).localeCompare(key(b)));
      break;
    case "highest":
      result.sort((a, b) => b.amount - a.amount);
      break;
    case "lowest":
      result.sort((a, b) => a.amount - b.amount);
      break;
    default:
      result.sort((a, b) => key(b).localeCompare(key(a)));
  }
  return result;
}

function populateMonthYearFilters() {
  const monthSelect = document.getElementById("filter-month");
  if (monthSelect && monthSelect.options.length <= 1) {
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    months.forEach((m, i) => {
      const opt = document.createElement("option");
      opt.value = String(i + 1).padStart(2, "0");
      opt.textContent = m;
      monthSelect.appendChild(opt);
    });
  }

  const yearSelect = document.getElementById("filter-year");
  if (yearSelect) {
    const years = new Set(allExpenses.map((e) => e.date?.slice(0, 4)).filter(Boolean));
    years.add(String(new Date().getFullYear()));
    const sorted = [...years].sort((a, b) => b.localeCompare(a));
    const previousValue = yearSelect.value;
    yearSelect.innerHTML = '<option value="">All Years</option>';
    sorted.forEach((y) => {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = y;
      yearSelect.appendChild(opt);
    });
    if (sorted.includes(previousValue)) yearSelect.value = previousValue;
  }
}

/* ---------------------------- Rendering ---------------------------- */

function buildExpenseRowHtml(exp) {
  const cat = getCategoryMeta(exp.category);
  const payment = PAYMENT_METHODS.find((p) => p.id === exp.paymentMethod) || { label: exp.paymentMethod };
  return `
    <div class="expense-row fade-in" data-id="${exp.id}">
      <div class="cat-icon" style="background:${cat.color}"><i class="fa-solid ${cat.icon}"></i></div>
      <div>
        <div class="exp-name">${escapeHtml(exp.expenseName)}</div>
        <div class="exp-meta">${formatDate(exp.date)} &middot; ${formatTime(exp.time)}${exp.notes ? " &middot; " + escapeHtml(exp.notes.slice(0, 40)) : ""}</div>
      </div>
      <div class="exp-meta col-category">${escapeHtml(cat.label)}</div>
      <div class="exp-meta col-payment exp-payment">${escapeHtml(payment.label)}</div>
      <div class="exp-amount">${formatCurrency(exp.amount)}</div>
      <div class="row-actions">
        <button class="btn-icon edit-exp-btn" title="Edit"><i class="fa-solid fa-pen"></i></button>
        <button class="btn-icon delete-exp-btn" title="Delete"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`;
}

function emptyStateHtml(message = "No expenses yet", sub = "Add your first expense to get started.") {
  return `
    <div class="empty-state">
      <i class="fa-solid fa-receipt"></i>
      <h4>${escapeHtml(message)}</h4>
      <p>${escapeHtml(sub)}</p>
    </div>`;
}

function attachRowHandlers(container) {
  container.querySelectorAll(".edit-exp-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      const id = btn.closest(".expense-row").dataset.id;
      const exp = allExpenses.find((e) => e.id === id);
      if (exp) openExpenseModal(exp);
    })
  );
  container.querySelectorAll(".delete-exp-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      const id = btn.closest(".expense-row").dataset.id;
      deleteExpense(id);
    })
  );
}

function renderRecentTransactions() {
  const container = document.getElementById("recent-transactions");
  if (!container) return;
  const recent = [...allExpenses].slice(0, 6);
  container.innerHTML = recent.length ? recent.map(buildExpenseRowHtml).join("") : emptyStateHtml();
  attachRowHandlers(container);
}

function renderFullExpenseList() {
  const container = document.getElementById("full-expense-list");
  if (!container) return;
  const filtered = getFilteredExpenses();
  container.innerHTML = filtered.length
    ? filtered.map(buildExpenseRowHtml).join("")
    : emptyStateHtml("No matching expenses", "Try adjusting your search or filters.");
  attachRowHandlers(container);
}

["expense-search"].forEach((id) => {
  document.getElementById(id)?.addEventListener("input", debounce(renderFullExpenseList, 250));
});
["filter-category", "filter-payment", "filter-month", "filter-year", "sort-expenses"].forEach((id) => {
  document.getElementById(id)?.addEventListener("change", renderFullExpenseList);
});
["filter-min-amount", "filter-max-amount"].forEach((id) => {
  document.getElementById(id)?.addEventListener("input", debounce(renderFullExpenseList, 300));
});

document.getElementById("clear-filters-btn")?.addEventListener("click", () => {
  document.getElementById("expense-search").value = "";
  document.getElementById("filter-category").value = "";
  document.getElementById("filter-payment").value = "";
  document.getElementById("filter-month").value = "";
  document.getElementById("filter-year").value = "";
  document.getElementById("filter-min-amount").value = "";
  document.getElementById("filter-max-amount").value = "";
  document.getElementById("sort-expenses").value = "latest";
  renderFullExpenseList();
});

/* ---------------------------- Summary card calculations ---------------------------- */

function sumExpenses(list) {
  return list.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
}

function expensesInRange(start, end) {
  return allExpenses.filter((e) => {
    const d = new Date(`${e.date}T${e.time || "00:00"}`);
    return d >= start && d <= end;
  });
}

function computeSummary() {
  const todayList = expensesInRange(startOfDay(), endOfDay());
  const weekList = expensesInRange(startOfWeek(), endOfWeek());
  const monthList = expensesInRange(startOfMonth(), endOfMonth());
  const yearList = expensesInRange(startOfYear(), endOfYear());
  const total = sumExpenses(allExpenses);

  // Highest expense category (by total amount, across all time).
  const byCategory = {};
  allExpenses.forEach((e) => {
    byCategory[e.category] = (byCategory[e.category] || 0) + (Number(e.amount) || 0);
  });
  let topCategory = null;
  let topCategoryAmount = 0;
  Object.entries(byCategory).forEach(([cat, amt]) => {
    if (amt > topCategoryAmount) {
      topCategory = cat;
      topCategoryAmount = amt;
    }
  });

  // Average daily expense = total / number of distinct days with expenses.
  const distinctDays = new Set(allExpenses.map((e) => e.date)).size || 1;

  return {
    today: sumExpenses(todayList),
    week: sumExpenses(weekList),
    month: sumExpenses(monthList),
    year: sumExpenses(yearList),
    total,
    topCategory: topCategory ? getCategoryMeta(topCategory).label : "—",
    topCategoryAmount,
    avgDaily: total / distinctDays,
    transactionCount: allExpenses.length
  };
}

function renderDashboardSummary() {
  const container = document.getElementById("summary-cards");
  if (!container) return;
  const s = computeSummary();

  const cards = [
    { cls: "sc-1", icon: "fa-calendar-day", label: "Today's Expense", value: formatCurrency(s.today) },
    { cls: "sc-2", icon: "fa-calendar-week", label: "This Week's Expense", value: formatCurrency(s.week) },
    { cls: "sc-3", icon: "fa-calendar", label: "This Month's Expense", value: formatCurrency(s.month) },
    { cls: "sc-4", icon: "fa-calendar-days", label: "This Year's Expense", value: formatCurrency(s.year) },
    { cls: "sc-5", icon: "fa-wallet", label: "Total Expenses", value: formatCurrency(s.total) },
    { cls: "sc-6", icon: "fa-crown", label: "Highest Category", value: s.topCategory, sub: formatCurrency(s.topCategoryAmount) },
    { cls: "sc-7", icon: "fa-chart-simple", label: "Avg. Daily Expense", value: formatCurrency(s.avgDaily) },
    { cls: "sc-8", icon: "fa-receipt", label: "Total Transactions", value: s.transactionCount }
  ];

  container.innerHTML = cards
    .map(
      (c) => `
    <div class="summary-card ${c.cls} fade-in">
      <div class="icon-badge"><i class="fa-solid ${c.icon}"></i></div>
      <div class="label">${c.label}</div>
      <div class="value">${c.value}</div>
      ${c.sub ? `<div class="sub">${c.sub}</div>` : ""}
    </div>`
    )
    .join("");
}
