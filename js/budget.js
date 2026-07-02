/**
 * Monthly budget tracking: overall + per-category budgets stored at
 * budgets/{uid}. Renders progress cards and fires a one-time warning toast
 * when a budget is exceeded.
 */

let currentBudget = { overall: 0, categories: {} };
let budgetUnsubscribe = null;
const warnedBudgets = new Set();

function budgetDocRef() {
  return db.collection(COLLECTIONS.budgets).doc(currentUser.uid);
}

function startBudgetListener() {
  if (budgetUnsubscribe) budgetUnsubscribe();
  budgetUnsubscribe = budgetDocRef().onSnapshot(
    (doc) => {
      currentBudget = doc.exists ? { overall: 0, categories: {}, ...doc.data() } : { overall: 0, categories: {} };
      renderBudgetGrid();
    },
    (err) => console.error("Budget listener error:", err)
  );
}

function monthSpendTotal() {
  return sumExpenses(expensesInRange(startOfMonth(), endOfMonth()));
}

function monthSpendByCategory(categoryId) {
  return sumExpenses(expensesInRange(startOfMonth(), endOfMonth()).filter((e) => e.category === categoryId));
}

function budgetCardHtml(key, label, spent, budget) {
  const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const overPct = budget > 0 ? (spent / budget) * 100 : 0;
  const fillClass = overPct >= 100 ? "danger" : overPct >= 80 ? "warning" : "";
  const remaining = budget - spent;

  if (overPct >= 100 && !warnedBudgets.has(key)) {
    warnedBudgets.add(key);
    showToast(`Budget exceeded for ${label}!`, "warning", 5000);
  }

  return `
    <div class="budget-card fade-in">
      <div class="flex-between">
        <strong>${escapeHtml(label)}</strong>
        <span class="badge ${overPct >= 100 ? "badge-danger" : overPct >= 80 ? "badge-warning" : "badge-success"}">
          ${overPct >= 100 ? "Exceeded" : overPct >= 80 ? "Near Limit" : "On Track"}
        </span>
      </div>
      <div class="budget-progress-track"><div class="budget-progress-fill ${fillClass}" style="width:${pct}%"></div></div>
      <div class="budget-meta">
        <span>${formatCurrency(spent)} spent</span>
        <span>${formatCurrency(budget)} budget</span>
      </div>
      <div class="budget-meta" style="margin-top:6px;">
        <span>${remaining >= 0 ? "Savings" : "Over by"}</span>
        <span style="color:${remaining >= 0 ? "var(--color-success)" : "var(--color-danger)"}; font-weight:700;">
          ${formatCurrency(Math.abs(remaining))}
        </span>
      </div>
    </div>`;
}

function renderBudgetGrid() {
  const grid = document.getElementById("budget-grid");
  if (!grid) return;

  const hasOverall = currentBudget.overall > 0;
  const categoryBudgets = Object.entries(currentBudget.categories || {}).filter(([, amt]) => amt > 0);

  if (!hasOverall && categoryBudgets.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <i class="fa-solid fa-piggy-bank"></i>
        <h4>No budgets set</h4>
        <p>Set a monthly budget to track your spending and get alerts when you're close to the limit.</p>
      </div>`;
    return;
  }

  let html = "";
  if (hasOverall) {
    html += budgetCardHtml("overall", "Overall Monthly Budget", monthSpendTotal(), currentBudget.overall);
  }
  categoryBudgets.forEach(([catId, amount]) => {
    const label = getCategoryMeta(catId).label;
    html += budgetCardHtml(`cat-${catId}`, label, monthSpendByCategory(catId), amount);
  });
  grid.innerHTML = html;
}

document.getElementById("set-budget-btn")?.addEventListener("click", () => {
  document.getElementById("budget-overall").value = currentBudget.overall || "";
  document.getElementById("budget-category-amount").value = "";
  openModal("budget-modal");
});

document.getElementById("budget-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const overall = parseFloat(document.getElementById("budget-overall").value) || 0;
  const categoryId = document.getElementById("budget-category").value;
  const categoryAmount = parseFloat(document.getElementById("budget-category-amount").value) || 0;

  const update = {
    overall,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (categoryId && categoryAmount > 0) {
    update[`categories.${categoryId}`] = categoryAmount;
  }

  try {
    await budgetDocRef().set(update, { merge: true });
    showToast("Budget saved", "success");
    closeModal("budget-modal");
  } catch (err) {
    console.error("Failed to save budget:", err);
    showToast("Could not save budget", "error");
  }
});

window.addEventListener("expenses-updated", renderBudgetGrid);
