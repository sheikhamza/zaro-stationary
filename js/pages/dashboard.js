const DashboardPage = (() => {
  let salesChart;
  let profitChart;
  let range = "daily";

  function kpi(icon, label, value, tone) {
    const tones = {
      green: "text-emerald-600 bg-emerald-50",
      red: "text-rose-600 bg-rose-50",
      navy: "text-slate-800 bg-slate-100",
      amber: "text-amber-600 bg-amber-50",
      blue: "text-sky-600 bg-sky-50",
    };
    return `
      <div class="kpi">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="kpi-label">${label}</div>
            <div class="kpi-value">${value}</div>
          </div>
          <div class="w-10 h-10 rounded-xl flex items-center justify-center ${tones[tone] || tones.navy}">${UI.icon(icon, 18)}</div>
        </div>
      </div>
    `;
  }

  function render() {
    const state = Store.getState();
    const m = Finance.dashboardMetrics(state);
    const recentSales = Finance.completedSales(state).slice(-6).reverse();
    const recentPurchases = [...state.purchases].slice(-5).reverse();
    const best = Finance.bestSellers(state, Utils.startOfMonth(), new Date(), 5);
    const view = document.getElementById("view");
    view.innerHTML = `
      ${UI.pageHeader({
        title: "Dashboard",
        subtitle: `Welcome back · ${Utils.escapeHtml(state.settings.shopName)}`,
        actions: `
          <a href="#/pos" class="btn-primary">${UI.icon("shopping-cart", 16)} New Sale</a>
          <a href="#/products" class="btn-secondary">${UI.icon("package-plus", 16)} Add Product</a>
          <a href="#/purchases" class="btn-secondary">${UI.icon("truck", 16)} Add Purchase</a>
        `,
      })}
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        ${kpi("banknote", "Today's Total Sales", UI.money(m.todaySales), "green")}
        ${kpi("trending-up", "Today's Gross Profit", UI.money(m.todayProfit), "green")}
        ${kpi("wallet", "Today's Expenses", UI.money(m.todayExpenses), "red")}
        ${kpi("package", "Total Products", m.productCount, "navy")}
        ${kpi("layers", "Total Stock Quantity", Utils.formatNumber(m.stockQty, 0), "blue")}
        ${kpi("triangle-alert", "Low Stock Products", m.lowStockCount, "amber")}
        ${kpi("boxes", "Total Inventory Value", UI.money(m.inventoryValue), "navy")}
        ${kpi("hand-coins", "Total Customer Udhaar", UI.money(m.udhaar), "red")}
        ${kpi("shopping-bag", "Total Purchases", UI.money(m.purchasesAll), "blue")}
      </div>
      <div class="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-4">
        <div class="xl:col-span-2">${UI.card(`
          <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <h2 class="font-semibold">Sales & Profit</h2>
              <p class="text-xs text-slate-500 mt-0.5">Calculated from completed sales using FIFO cost</p>
            </div>
            <div class="flex bg-slate-100 rounded-xl p-1 text-xs font-semibold">
              ${["daily", "weekly", "monthly"]
                .map(
                  (r) =>
                    `<button class="chart-range px-3 py-1.5 rounded-lg ${
                      range === r ? "bg-white shadow-sm text-slate-900" : "text-slate-500"
                    }" data-range="${r}">${r[0].toUpperCase() + r.slice(1)}</button>`
                )
                .join("")}
            </div>
          </div>
          <div class="p-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div><canvas id="sales-chart" height="180"></canvas></div>
            <div><canvas id="profit-chart" height="180"></canvas></div>
          </div>
        `)}</div>
        <div>${UI.card(`
          <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 class="font-semibold">Low stock alerts</h2>
            <a href="#/inventory" class="text-sm text-emerald-700 font-semibold">View all</a>
          </div>
          ${
            m.lowStock.length
              ? `<div class="divide-y divide-slate-100">${m.lowStock
                  .slice(0, 8)
                  .map(
                    (p) => `
                <div class="px-5 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p class="font-medium">${Utils.escapeHtml(p.name)}</p>
                    <p class="text-xs text-slate-500">${p.sku} · min ${p.minStock}</p>
                  </div>
                  ${UI.stockBadge(p)}
                </div>`
                  )
                  .join("")}</div>`
              : UI.empty("All stocked up", "No products are below their alert level.", "check-circle")
          }
        `)}</div>
      </div>
      <div class="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-4">
        <div class="xl:col-span-2">${UI.card(`
          <div class="px-5 py-4 border-b border-slate-100"><h2 class="font-semibold">Recent sales</h2></div>
          ${
            recentSales.length
              ? `<div class="table-wrap"><table class="data-table">
            <thead><tr><th>Invoice</th><th>Customer</th><th>Amount</th><th>Profit</th><th>Pay</th></tr></thead>
            <tbody>
              ${recentSales
                .map(
                  (s) => `<tr>
                <td class="font-semibold">${s.invoiceNo}<div class="text-xs text-slate-400 font-normal">${Utils.formatDateTime(s.date)}</div></td>
                <td>${Utils.escapeHtml(s.customerName)}</td>
                <td>${UI.money(s.grandTotal)}</td>
                <td class="text-emerald-600 font-semibold">${UI.money(s.grossProfit)}</td>
                <td>${UI.badge(s.paymentMethod, s.paymentStatus === "Paid" ? "green" : "amber")}</td>
              </tr>`
                )
                .join("")}
            </tbody>
          </table></div>`
              : UI.empty("No sales yet", "Complete a sale from the POS to see it here.", "receipt")
          }
        `)}</div>
        <div class="space-y-4">
          ${UI.card(`
            <div class="px-5 py-4 border-b border-slate-100"><h2 class="font-semibold">Most selling</h2></div>
            ${
              best.length
                ? `<div class="divide-y divide-slate-100">${best
                    .map(
                      (p, i) => `
                  <div class="px-5 py-3 flex items-center gap-3">
                    <div class="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center">${i + 1}</div>
                    <div class="flex-1">
                      <p class="font-medium">${Utils.escapeHtml(p.name)}</p>
                      <p class="text-xs text-slate-500">${p.qty} sold · ${UI.money(p.revenue)}</p>
                    </div>
                  </div>`
                    )
                    .join("")}</div>`
                : UI.empty("No sales data", "Best sellers appear after completed invoices.", "sparkles")
            }
          `)}
          ${UI.card(`
            <div class="px-5 py-4 border-b border-slate-100"><h2 class="font-semibold">Recent purchases</h2></div>
            ${
              recentPurchases.length
                ? `<div class="divide-y divide-slate-100">${recentPurchases
                    .map(
                      (p) => `
                  <div class="px-5 py-3">
                    <div class="flex justify-between gap-2">
                      <p class="font-medium">${Utils.escapeHtml(p.productName)}</p>
                      <p class="font-semibold">${UI.money(p.totalCost)}</p>
                    </div>
                    <p class="text-xs text-slate-500 mt-1">${p.quantity} units · ${Utils.formatDate(p.date)}</p>
                  </div>`
                    )
                    .join("")}</div>`
                : UI.empty("No purchases", "Record a supplier purchase to add stock.", "truck")
            }
          `)}
        </div>
      </div>
    `;
    bindCharts(state);
    view.querySelectorAll(".chart-range").forEach((btn) => {
      btn.addEventListener("click", () => {
        range = btn.dataset.range;
        render();
      });
    });
    UI.refreshIcons();
  }

  function bindCharts(state) {
    const series = Finance.chartSeries(state, range);
    const labels = series.map((p) => p.label);
    if (salesChart) salesChart.destroy();
    if (profitChart) profitChart.destroy();
    const salesEl = document.getElementById("sales-chart");
    const profitEl = document.getElementById("profit-chart");
    if (!salesEl || !window.Chart) return;
    salesChart = new Chart(salesEl, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Sales",
            data: series.map((p) => p.sales),
            borderColor: "#059669",
            backgroundColor: "rgba(5,150,105,0.12)",
            fill: true,
            tension: 0.35,
          },
        ],
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
    });
    profitChart = new Chart(profitEl, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Gross profit",
            data: series.map((p) => p.profit),
            backgroundColor: "#0f172a",
            borderRadius: 8,
          },
        ],
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
    });
  }

  return { render };
})();
