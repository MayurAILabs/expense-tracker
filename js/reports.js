/**
 * Report generation for preset and custom date ranges, plus CSV / Excel / PDF
 * export of the currently generated report.
 */

let currentReportRange = DATE_RANGES.today();
let currentReportExpenses = [];

function renderReport() {
  currentReportExpenses = expensesInRange(currentReportRange.start, currentReportRange.end);
  renderReportSummary();
  renderCategoryChart(currentReportExpenses, "chart-report");
  renderReportList();
}

function renderReportSummary() {
  const container = document.getElementById("report-summary");
  if (!container) return;
  const total = sumExpenses(currentReportExpenses);
  const count = currentReportExpenses.length;
  const avg = count ? total / count : 0;

  const byCategory = groupSum(currentReportExpenses, (e) => e.category);
  let topCat = "—";
  let topAmt = 0;
  Object.entries(byCategory).forEach(([cat, amt]) => {
    if (amt > topAmt) {
      topAmt = amt;
      topCat = getCategoryMeta(cat).label;
    }
  });

  const cards = [
    { icon: "fa-wallet", cls: "sc-1", label: "Total Spent", value: formatCurrency(total) },
    { icon: "fa-receipt", cls: "sc-5", label: "Transactions", value: count },
    { icon: "fa-chart-simple", cls: "sc-3", label: "Average / Transaction", value: formatCurrency(avg) },
    { icon: "fa-crown", cls: "sc-6", label: "Top Category", value: topCat, sub: formatCurrency(topAmt) }
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

function renderReportList() {
  const container = document.getElementById("report-expense-list");
  if (!container) return;
  const sorted = [...currentReportExpenses].sort((a, b) => `${b.date}T${b.time || ""}`.localeCompare(`${a.date}T${a.time || ""}`));
  container.innerHTML = sorted.length ? sorted.map(buildExpenseRowHtml).join("") : emptyStateHtml("No expenses in this range");
  attachRowHandlers(container);
}

document.querySelectorAll(".report-range-grid .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".report-range-grid .chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    const range = chip.dataset.range;
    const customBar = document.getElementById("custom-range-bar");

    if (range === "custom") {
      customBar.classList.remove("hidden");
      return;
    }
    customBar.classList.add("hidden");
    currentReportRange = DATE_RANGES[range] ? DATE_RANGES[range]() : DATE_RANGES.today();
    renderReport();
  });
});

document.getElementById("apply-custom-range")?.addEventListener("click", () => {
  const from = document.getElementById("report-from").value;
  const to = document.getElementById("report-to").value;
  if (!from || !to) {
    showToast("Please select both dates", "warning");
    return;
  }
  currentReportRange = { start: startOfDay(new Date(from)), end: endOfDay(new Date(to)) };
  renderReport();
});

/* ---------------------------- Exports ---------------------------- */

function reportFilenameBase() {
  const s = currentReportRange.start.toISOString().slice(0, 10);
  const e = currentReportRange.end.toISOString().slice(0, 10);
  return `expense-report_${s}_to_${e}`;
}

document.getElementById("export-csv-btn")?.addEventListener("click", () => {
  if (!currentReportExpenses.length) return showToast("No data to export", "warning");
  downloadFile(`${reportFilenameBase()}.csv`, expensesToCsv(currentReportExpenses));
  showToast("CSV exported", "success");
});

document.getElementById("export-excel-btn")?.addEventListener("click", () => {
  if (!currentReportExpenses.length) return showToast("No data to export", "warning");
  const rows = currentReportExpenses.map((e) => ({
    Date: e.date,
    Time: e.time,
    Name: e.expenseName,
    Category: e.categoryLabel,
    "Amount (INR)": e.amount,
    "Payment Method": (PAYMENT_METHODS.find((p) => p.id === e.paymentMethod) || {}).label || e.paymentMethod,
    Notes: e.notes || ""
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `${reportFilenameBase()}.xlsx`);
  showToast("Excel file exported", "success");
});

document.getElementById("export-pdf-btn")?.addEventListener("click", () => {
  if (!currentReportExpenses.length) return showToast("No data to export", "warning");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("Expense Report", 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`${formatDate(currentReportRange.start)} - ${formatDate(currentReportRange.end)}`, 14, 25);
  doc.text(`Generated for: ${currentUser.email}`, 14, 30);

  doc.autoTable({
    startY: 38,
    head: [["Date", "Time", "Name", "Category", "Amount", "Payment"]],
    body: currentReportExpenses.map((e) => [
      e.date,
      formatTime(e.time),
      e.expenseName,
      e.categoryLabel,
      formatCurrency(e.amount),
      (PAYMENT_METHODS.find((p) => p.id === e.paymentMethod) || {}).label || e.paymentMethod
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [102, 126, 234] }
  });

  const total = sumExpenses(currentReportExpenses);
  const finalY = doc.lastAutoTable.finalY || 40;
  doc.setFontSize(11);
  doc.setTextColor(30);
  doc.text(`Total: ${formatCurrency(total)}`, 14, finalY + 10);

  doc.save(`${reportFilenameBase()}.pdf`);
  showToast("PDF exported", "success");
});

window.addEventListener("expenses-updated", () => {
  if (document.getElementById("section-reports")?.classList.contains("active")) {
    renderReport();
  }
});
