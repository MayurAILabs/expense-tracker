/**
 * All Chart.js visualizations for the user dashboard. Charts are rebuilt
 * (destroy + recreate) whenever the underlying expense data or the color
 * theme changes, so they always reflect the latest state.
 */

const chartInstances = {};

function themeColor(varName) {
  return getComputedStyle(document.body).getPropertyValue(varName).trim();
}

function upsertChart(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (chartInstances[canvasId]) chartInstances[canvasId].destroy();
  chartInstances[canvasId] = new Chart(canvas.getContext("2d"), config);
}

function baseChartOptions(extra = {}) {
  const textColor = themeColor("--text-secondary");
  const gridColor = themeColor("--border-color");
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false, labels: { color: textColor } },
      tooltip: {
        backgroundColor: themeColor("--bg-surface"),
        titleColor: themeColor("--text-primary"),
        bodyColor: themeColor("--text-secondary"),
        borderColor: gridColor,
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8
      }
    },
    scales: {
      x: { ticks: { color: textColor, font: { size: 10 } }, grid: { display: false } },
      y: { ticks: { color: textColor, font: { size: 10 } }, grid: { color: gridColor }, beginAtZero: true }
    },
    ...extra
  };
}

const CHART_PALETTE = ["#667eea", "#f5576c", "#43e97b", "#fa709a", "#4facfe", "#f9a826", "#a29bfe", "#00c2a8", "#ff8fa3", "#8338ec"];

/* ---------------------------- Data grouping helpers ---------------------------- */

function groupSum(list, keyFn) {
  const map = {};
  list.forEach((e) => {
    const key = keyFn(e);
    map[key] = (map[key] || 0) + (Number(e.amount) || 0);
  });
  return map;
}

/* ---------------------------- Individual charts ---------------------------- */

function renderDailyChart() {
  const today = expensesInRange(startOfDay(), endOfDay());
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const byHour = groupSum(today, (e) => parseInt((e.time || "00:00").split(":")[0], 10));
  const data = hours.map((h) => byHour[h] || 0);
  const labels = hours.map((h) => (h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`));

  upsertChart("chart-daily", {
    type: "bar",
    data: { labels, datasets: [{ data, backgroundColor: "#667eea", borderRadius: 6, maxBarThickness: 18 }] },
    options: baseChartOptions()
  });
}

function renderWeeklyChart() {
  const week = expensesInRange(startOfWeek(), endOfWeek());
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const byDay = groupSum(week, (e) => new Date(`${e.date}T00:00`).getDay());
  const data = days.map((_, i) => byDay[i] || 0);

  upsertChart("chart-weekly", {
    type: "bar",
    data: { labels: days, datasets: [{ data, backgroundColor: "#f5576c", borderRadius: 6, maxBarThickness: 28 }] },
    options: baseChartOptions()
  });
}

function renderMonthlyChart() {
  const now = new Date();
  const daysInMonth = endOfMonth(now).getDate();
  const month = expensesInRange(startOfMonth(), endOfMonth());
  const byDate = groupSum(month, (e) => parseInt(e.date.slice(8, 10), 10));
  const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const data = labels.map((d) => byDate[d] || 0);

  upsertChart("chart-monthly", {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          data,
          borderColor: "#43e97b",
          backgroundColor: "rgba(67, 233, 123, 0.15)",
          fill: true,
          tension: 0.35,
          pointRadius: 2
        }
      ]
    },
    options: baseChartOptions()
  });
}

function renderYearlyChart() {
  const year = expensesInRange(startOfYear(), endOfYear());
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const byMonth = groupSum(year, (e) => parseInt(e.date.slice(5, 7), 10) - 1);
  const data = months.map((_, i) => byMonth[i] || 0);

  upsertChart("chart-yearly", {
    type: "bar",
    data: { labels: months, datasets: [{ data, backgroundColor: "#4facfe", borderRadius: 6, maxBarThickness: 28 }] },
    options: baseChartOptions()
  });
}

function renderCategoryChart(source = allExpenses, canvasId = "chart-category") {
  const byCategory = groupSum(source, (e) => e.category);
  const entries = Object.entries(byCategory).filter(([, v]) => v > 0);
  const labels = entries.map(([cat]) => getCategoryMeta(cat).label);
  const data = entries.map(([, v]) => v);
  const colors = entries.map(([cat]) => getCategoryMeta(cat).color);

  upsertChart(canvasId, {
    type: "doughnut",
    data: { labels, datasets: [{ data, backgroundColor: colors.length ? colors : CHART_PALETTE, borderWidth: 0 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
      plugins: {
        legend: { position: "bottom", labels: { color: themeColor("--text-secondary"), boxWidth: 10, font: { size: 10 }, padding: 10 } },
        tooltip: baseChartOptions().plugins.tooltip
      }
    }
  });
}

function renderPaymentChart() {
  const byPayment = groupSum(allExpenses, (e) => e.paymentMethod);
  const entries = Object.entries(byPayment).filter(([, v]) => v > 0);
  const labels = entries.map(([id]) => (PAYMENT_METHODS.find((p) => p.id === id) || { label: id }).label);
  const data = entries.map(([, v]) => v);

  upsertChart("chart-payment", {
    type: "pie",
    data: { labels, datasets: [{ data, backgroundColor: CHART_PALETTE, borderWidth: 0 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { color: themeColor("--text-secondary"), boxWidth: 10, font: { size: 10 }, padding: 10 } },
        tooltip: baseChartOptions().plugins.tooltip
      }
    }
  });
}

/** Rebuilds every dashboard chart. Called on data change and theme change. */
function updateAllCharts() {
  if (!currentUser) return;
  renderDailyChart();
  renderWeeklyChart();
  renderMonthlyChart();
  renderYearlyChart();
  renderCategoryChart();
  renderPaymentChart();
}

window.addEventListener("expenses-updated", updateAllCharts);
window.addEventListener("categories-updated", updateAllCharts);
