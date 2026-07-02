/**
 * Admin dashboard: only initialized for the ADMIN_EMAIL account. Reads
 * every user's profile and every expense (permitted by firestore.rules for
 * the admin), and lets the admin filter, edit, delete and export any data.
 * Normal users never load this module's listeners since initAdmin() is only
 * called after isAdmin() is confirmed true (see dashboard.js).
 */

let allUsers = [];
let allExpensesAdmin = [];
let usersUnsubscribe = null;
let adminExpensesUnsubscribe = null;

function initAdmin() {
  if (usersUnsubscribe) usersUnsubscribe();
  if (adminExpensesUnsubscribe) adminExpensesUnsubscribe();

  usersUnsubscribe = db.collection(COLLECTIONS.users).onSnapshot(
    (snap) => {
      allUsers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      populateAdminUserFilter();
      renderAdminAll();
    },
    (err) => console.error("Admin users listener error:", err)
  );

  adminExpensesUnsubscribe = db.collection(COLLECTIONS.expenses).onSnapshot(
    (snap) => {
      allExpensesAdmin = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderAdminAll();
    },
    (err) => console.error("Admin expenses listener error:", err)
  );
}

function renderAdminAll() {
  renderAdminStats();
  renderAdminUsersTable();
  renderAdminExpensesTable();
  renderAdminCharts();
}

/* ---------------------------- Stats ---------------------------- */

function renderAdminStats() {
  const container = document.getElementById("admin-stats");
  if (!container) return;
  const total = sumExpenses(allExpensesAdmin);
  const avgPerUser = allUsers.length ? total / allUsers.length : 0;

  const cards = [
    { cls: "sc-1", icon: "fa-users", label: "Total Users", value: allUsers.length },
    { cls: "sc-2", icon: "fa-receipt", label: "Total Transactions", value: allExpensesAdmin.length },
    { cls: "sc-3", icon: "fa-wallet", label: "Total Spent (All Users)", value: formatCurrency(total) },
    { cls: "sc-4", icon: "fa-chart-simple", label: "Avg. Spend / User", value: formatCurrency(avgPerUser) }
  ];
  container.innerHTML = cards
    .map(
      (c) => `
    <div class="summary-card ${c.cls} fade-in">
      <div class="icon-badge"><i class="fa-solid ${c.icon}"></i></div>
      <div class="label">${c.label}</div>
      <div class="value">${c.value}</div>
    </div>`
    )
    .join("");
}

/* ---------------------------- Users table ---------------------------- */

function userSpend(uid) {
  return sumExpenses(allExpensesAdmin.filter((e) => e.uid === uid));
}
function userTxnCount(uid) {
  return allExpensesAdmin.filter((e) => e.uid === uid).length;
}

function renderAdminUsersTable() {
  const tbody = document.querySelector("#admin-users-table tbody");
  if (!tbody) return;
  const search = (document.getElementById("admin-user-search")?.value || "").toLowerCase();

  const rows = allUsers
    .filter((u) => !search || `${u.displayName} ${u.email}`.toLowerCase().includes(search))
    .sort((a, b) => userSpend(b.uid) - userSpend(a.uid));

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px;">No users found</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map((u) => {
      const fallback = `https://ui-avatars.com/api/?background=667eea&color=fff&name=${encodeURIComponent(u.displayName || u.email)}`;
      const joined = u.createdAt ? formatDate(toJsDate(u.createdAt)) : "—";
      return `
      <tr>
        <td>
          <div class="table-user-cell">
            <img src="${u.photoURL || fallback}" onerror="this.src='${fallback}'" alt="" />
            <span>${escapeHtml(u.displayName || "—")}${u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? ' <span class="badge badge-admin">Admin</span>' : ""}</span>
          </div>
        </td>
        <td>${escapeHtml(u.email)}</td>
        <td>${userTxnCount(u.uid)}</td>
        <td>${formatCurrency(userSpend(u.uid))}</td>
        <td>${joined}</td>
        <td><button class="btn btn-sm btn-outline view-user-expenses-btn" data-uid="${u.uid}"><i class="fa-solid fa-eye"></i> View</button></td>
      </tr>`;
    })
    .join("");

  tbody.querySelectorAll(".view-user-expenses-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      document.getElementById("admin-filter-user").value = btn.dataset.uid;
      renderAdminExpensesTable();
      document.getElementById("admin-expenses-table").scrollIntoView({ behavior: "smooth", block: "start" });
    })
  );
}

document.getElementById("admin-user-search")?.addEventListener("input", debounce(renderAdminUsersTable, 250));

function populateAdminUserFilter() {
  const select = document.getElementById("admin-filter-user");
  if (!select) return;
  const previousValue = select.value;
  select.innerHTML = '<option value="">All Users</option>';
  [...allUsers]
    .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""))
    .forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.uid;
      opt.textContent = u.displayName ? `${u.displayName} (${u.email})` : u.email;
      select.appendChild(opt);
    });
  if ([...select.options].some((o) => o.value === previousValue)) select.value = previousValue;
}

/* ---------------------------- Expenses table ---------------------------- */

function getFilteredAdminExpenses() {
  const search = (document.getElementById("admin-expense-search")?.value || "").toLowerCase();
  const userId = document.getElementById("admin-filter-user")?.value || "";
  const categoryId = document.getElementById("admin-filter-category")?.value || "";

  return allExpensesAdmin
    .filter((e) => {
      if (userId && e.uid !== userId) return false;
      if (categoryId && e.category !== categoryId) return false;
      if (search) {
        const haystack = `${e.expenseName} ${e.categoryLabel} ${e.userEmail} ${e.userName}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    })
    .sort((a, b) => `${b.date}T${b.time || ""}`.localeCompare(`${a.date}T${a.time || ""}`));
}

function renderAdminExpensesTable() {
  const tbody = document.querySelector("#admin-expenses-table tbody");
  if (!tbody) return;
  const rows = getFilteredAdminExpenses();

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px;">No expenses found</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map((e) => {
      const cat = getCategoryMeta(e.category);
      const payment = (PAYMENT_METHODS.find((p) => p.id === e.paymentMethod) || {}).label || e.paymentMethod;
      return `
      <tr>
        <td>${formatDate(e.date)}<br/><span style="color:var(--text-muted); font-size:0.72rem;">${formatTime(e.time)}</span></td>
        <td>${escapeHtml(e.userName || e.userEmail || "—")}</td>
        <td>${escapeHtml(e.expenseName)}</td>
        <td><span class="badge" style="background:${cat.color}22; color:${cat.color};">${escapeHtml(cat.label)}</span></td>
        <td>${formatCurrency(e.amount)}</td>
        <td>${escapeHtml(payment)}</td>
        <td>
          <div class="row-actions">
            <button class="btn-icon admin-edit-exp-btn" data-id="${e.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
            <button class="btn-icon admin-delete-exp-btn" data-id="${e.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
          </div>
        </td>
      </tr>`;
    })
    .join("");

  tbody.querySelectorAll(".admin-edit-exp-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      const exp = allExpensesAdmin.find((e) => e.id === btn.dataset.id);
      if (exp) openExpenseModal(exp);
    })
  );
  tbody.querySelectorAll(".admin-delete-exp-btn").forEach((btn) =>
    btn.addEventListener("click", () => deleteExpense(btn.dataset.id))
  );
}

["admin-expense-search"].forEach((id) => document.getElementById(id)?.addEventListener("input", debounce(renderAdminExpensesTable, 250)));
["admin-filter-user", "admin-filter-category"].forEach((id) => document.getElementById(id)?.addEventListener("change", renderAdminExpensesTable));

/* ---------------------------- Charts ---------------------------- */

function renderAdminCharts() {
  // Spend by user
  const byUser = {};
  allExpensesAdmin.forEach((e) => {
    const label = e.userName || e.userEmail || "Unknown";
    byUser[label] = (byUser[label] || 0) + (Number(e.amount) || 0);
  });
  const userEntries = Object.entries(byUser).sort((a, b) => b[1] - a[1]).slice(0, 8);
  upsertChart("chart-admin-users", {
    type: "doughnut",
    data: {
      labels: userEntries.map(([l]) => l),
      datasets: [{ data: userEntries.map(([, v]) => v), backgroundColor: CHART_PALETTE, borderWidth: 0 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "60%",
      plugins: { legend: { position: "bottom", labels: { color: themeColor("--text-secondary"), boxWidth: 10, font: { size: 10 } } } }
    }
  });

  // Spend by category, all users
  const byCategory = groupSum(allExpensesAdmin, (e) => e.category);
  const catEntries = Object.entries(byCategory).filter(([, v]) => v > 0);
  upsertChart("chart-admin-category", {
    type: "bar",
    data: {
      labels: catEntries.map(([c]) => getCategoryMeta(c).label),
      datasets: [{ data: catEntries.map(([, v]) => v), backgroundColor: catEntries.map(([c]) => getCategoryMeta(c).color), borderRadius: 6 }]
    },
    options: baseChartOptions()
  });
}

/* ---------------------------- Export ---------------------------- */

document.getElementById("admin-export-btn")?.addEventListener("click", () => {
  const rows = getFilteredAdminExpenses();
  if (!rows.length) return showToast("No data to export", "warning");

  const userId = document.getElementById("admin-filter-user")?.value;
  const userLabel = userId ? (allUsers.find((u) => u.uid === userId)?.email || userId) : "all-users";

  const csvRows = rows.map((e) => ({
    date: e.date,
    time: e.time,
    userName: e.userName,
    userEmail: e.userEmail,
    expenseName: e.expenseName,
    category: e.categoryLabel,
    amount: e.amount,
    paymentMethod: e.paymentMethod,
    notes: e.notes || ""
  }));
  const headers = Object.keys(csvRows[0]);
  const csv = [headers, ...csvRows.map((r) => headers.map((h) => r[h]))]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  downloadFile(`expenses_${userLabel}_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  showToast("Export ready", "success");
});
