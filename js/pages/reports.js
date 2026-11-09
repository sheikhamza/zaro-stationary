const ReportsPage = (() => {
  let type = "sales";
  let from = Utils.todayISO(Utils.startOfMonth());
  let to = Utils.todayISO();

  function presets() {
    return {
      daily: [Utils.todayISO(), Utils.todayISO()],
      weekly: [Utils.todayISO(Utils.startOfWeek()), Utils.todayISO()],
      monthly: [Utils.todayISO(Utils.startOfMonth()), Utils.todayISO()],
      yearly: [Utils.todayISO(Utils.startOfYear()), Utils.todayISO()],
    };
  }

  function dataset() {
    const state = Store.getState();
    const sales = Finance.salesInRange(state, from, to);
    const expenses = Finance.expensesInRange(state, from, to);
    const purchases = state.purchases.filter((p) => Utils.inRange(p.date, from, to));
    const profit = Finance.profitReport(state, from, to);
    const best = Finance.bestSellers(state, from, to, 20);
    const low = state.products.filter((p) => Number(p.currentStock) <= Number(p.minStock));
    const headers = {
      sales: ["Invoice", "Date", "Customer", "Amount", "Cost", "Gross Profit", "Cash Received", "Method", "Status"],
      profit: ["Metric", "Amount"],
      purchases: ["Date", "Product", "Qty", "Total Cost", "Cost/Unit", "Supplier", "Payment"],
      expenses: ["Date", "Title", "Category", "Amount"],
      stock: ["Product", "SKU", "Stock", "Stock Value", "Selling", "Status"],
      bestsellers: ["Product", "Qty Sold", "Revenue", "Profit"],
      lowstock: ["Product", "SKU", "Stock", "Min"],
      udhaar: ["Customer", "Phone", "Purchases", "Paid", "Outstanding"],
    };
    const rows = {
      sales: sales.map((s) => [
        s.invoiceNo,
        Utils.formatDateTime(s.date),
        s.customerName,
        s.grandTotal,
        s.costTotal,
        s.grossProfit,
        s.cashReceived ?? s.amountPaid,
        s.paymentMethod,
        s.paymentStatus,
      ]),
      profit: [
        ["Sales revenue", profit.revenue],
        ["Cash received", profit.cashReceived],
        ["FIFO cost of goods", profit.cost],
        ["Gross profit", profit.grossProfit],
        ["Operating expenses", profit.operatingExpenses],
        ["Net profit", profit.netProfit],
      ],
      purchases: purchases.map((p) => [Utils.formatDate(p.date), p.productName, p.quantity, p.totalCost, p.costPerUnit, p.supplierName, p.paymentStatus]),
      expenses: expenses.map((e) => [Utils.formatDate(e.date), e.title, e.category, e.amount]),
      stock: state.products.map((p) => [
        p.name,
        p.sku,
        p.currentStock,
        Finance.inventoryValueForProduct(state, p.id),
        p.sellingPrice,
        Number(p.currentStock) <= 0 ? "Out" : p.currentStock <= p.minStock ? "Low" : "OK",
      ]),
      bestsellers: best.map((p) => [p.name, p.qty, p.revenue, p.profit]),
      lowstock: low.map((p) => [p.name, p.sku, p.currentStock, p.minStock]),
      udhaar: state.customers.map((c) => [c.name, c.phone, c.totalPurchases, c.totalPaid, c.outstanding]),
    };
    return { headers: headers[type], rows: rows[type], profit, sales, expenses, purchases, best, low, state };
  }

  const MONEY_HEADERS = [
    "Amount",
    "Cost",
    "Gross Profit",
    "Cash Received",
    "Total Cost",
    "Cost/Unit",
    "Stock Value",
    "Selling",
    "Revenue",
    "Profit",
    "Purchases",
    "Paid",
    "Outstanding",
  ];

  function formatCell(header, value) {
    if (MONEY_HEADERS.includes(header) && typeof value === "number") return UI.money(value);
    return Utils.escapeHtml(value);
  }

  function exportCSV() {
    const { headers, rows } = dataset();
    Utils.downloadFile(`zaro-${type}-report.csv`, Utils.toCSV(headers, rows), "text/csv;charset=utf-8");
    UI.toast("CSV exported");
  }

  function render() {
    const data = dataset();
    const view = document.getElementById("view");
    view.innerHTML = `
      ${UI.pageHeader({
        title: "Reports & Analytics",
        subtitle: "Gross profit uses FIFO cost. Net profit subtracts operating expenses only.",
        actions: `<button class="btn-primary" id="csv">${UI.icon("download", 16)} Export CSV</button>`,
      })}
      ${UI.card(`
        <div class="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 border-b border-slate-100">
          <select class="field mt-0" id="rep-type">
            <option value="sales" ${type === "sales" ? "selected" : ""}>Sales report</option>
            <option value="profit" ${type === "profit" ? "selected" : ""}>Gross & net profit</option>
            <option value="purchases" ${type === "purchases" ? "selected" : ""}>Purchase report</option>
            <option value="expenses" ${type === "expenses" ? "selected" : ""}>Expense report</option>
            <option value="stock" ${type === "stock" ? "selected" : ""}>Stock report</option>
            <option value="bestsellers" ${type === "bestsellers" ? "selected" : ""}>Best selling products</option>
            <option value="lowstock" ${type === "lowstock" ? "selected" : ""}>Low stock products</option>
            <option value="udhaar" ${type === "udhaar" ? "selected" : ""}>Customer udhaar</option>
          </select>
          <div class="flex gap-2">
            ${["daily", "weekly", "monthly", "yearly"]
              .map((p) => `<button class="btn-secondary flex-1 preset" data-p="${p}">${p[0].toUpperCase() + p.slice(1)}</button>`)
              .join("")}
          </div>
          <input type="date" class="field mt-0" id="rep-from" value="${from}" />
          <input type="date" class="field mt-0" id="rep-to" value="${to}" />
        </div>
        <div class="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="rounded-xl bg-slate-50 p-3"><div class="text-xs text-slate-500">Revenue</div><div class="font-bold">${UI.money(data.profit.revenue)}</div></div>
          <div class="rounded-xl bg-emerald-50 p-3"><div class="text-xs text-emerald-700">Gross profit</div><div class="font-bold text-emerald-700">${UI.money(data.profit.grossProfit)}</div></div>
          <div class="rounded-xl bg-rose-50 p-3"><div class="text-xs text-rose-700">Expenses</div><div class="font-bold text-rose-700">${UI.money(data.profit.operatingExpenses)}</div></div>
          <div class="rounded-xl bg-slate-900 text-white p-3"><div class="text-xs text-slate-300">Net profit</div><div class="font-bold">${UI.money(data.profit.netProfit)}</div></div>
        </div>
        ${
          data.rows.length
            ? `<div class="table-wrap"><table class="data-table"><thead><tr>${data.headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
          <tbody>${data.rows
            .map((r) => `<tr>${r.map((c, i) => `<td>${formatCell(data.headers[i], c)}</td>`).join("")}</tr>`)
            .join("")}</tbody></table></div>`
            : UI.empty("No rows for this report", "Adjust the date range or record more activity.", "bar-chart-3")
        }
      `)}
    `;
    view.querySelector("#csv").onclick = exportCSV;
    view.querySelector("#rep-type").onchange = (e) => {
      type = e.target.value;
      render();
    };
    view.querySelector("#rep-from").onchange = (e) => {
      from = e.target.value;
      render();
    };
    view.querySelector("#rep-to").onchange = (e) => {
      to = e.target.value;
      render();
    };
    view.querySelectorAll(".preset").forEach((btn) => {
      btn.onclick = () => {
        const [a, b] = presets()[btn.dataset.p];
        from = a;
        to = b;
        render();
      };
    });
    UI.refreshIcons();
  }

  return { render };
})();
