const UI = (() => {
  const toastRoot = () => document.getElementById("toast-root");
  const modalRoot = () => document.getElementById("modal-root");

  function money(n) {
    return Utils.formatMoney(n, Store.settings());
  }

  function icon(name, size = 18, extra = "") {
    return `<i data-lucide="${name}" class="${extra}" style="width:${size}px;height:${size}px"></i>`;
  }

  function refreshIcons() {
    if (window.lucide) window.lucide.createIcons();
  }

  function toast(message, type = "success") {
    const el = document.createElement("div");
    const colors = {
      success: "bg-emerald-600",
      error: "bg-rose-600",
      info: "bg-slate-800",
    };
    el.className = `pointer-events-auto flex items-start gap-3 rounded-xl ${colors[type] || colors.info} text-white px-4 py-3 shadow-xl shadow-slate-900/20 min-w-[260px] max-w-sm animate-slide-in`;
    el.innerHTML = `
      ${icon(type === "error" ? "circle-alert" : type === "info" ? "info" : "circle-check", 18, "mt-0.5 shrink-0")}
      <p class="text-sm font-medium leading-5">${Utils.escapeHtml(message)}</p>
    `;
    toastRoot().appendChild(el);
    refreshIcons();
    setTimeout(() => {
      el.classList.add("opacity-0", "translate-y-2", "transition");
      setTimeout(() => el.remove(), 250);
    }, 2800);
  }

  function closeModal() {
    const root = modalRoot();
    root.classList.add("hidden");
    root.innerHTML = "";
    document.body.classList.remove("overflow-hidden");
  }

  function modal({ title, body, footer, width = "max-w-2xl", onOpen }) {
    const root = modalRoot();
    root.classList.remove("hidden");
    document.body.classList.add("overflow-hidden");
    root.innerHTML = `
      <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" data-close="1"></div>
      <div class="relative z-10 w-full ${width} mx-4 bg-white rounded-2xl shadow-2xl shadow-slate-900/20 overflow-hidden animate-pop">
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 class="text-lg font-semibold text-slate-900">${title}</h3>
          <button type="button" class="p-2 rounded-lg hover:bg-slate-100 text-slate-500" data-close="1">${icon("x", 18)}</button>
        </div>
        <div class="px-5 py-4 max-h-[70vh] overflow-y-auto" id="modal-body">${body}</div>
        ${footer ? `<div class="px-5 py-4 border-t border-slate-100 bg-slate-50/80 flex justify-end gap-2">${footer}</div>` : ""}
      </div>
    `;
    root.querySelectorAll("[data-close]").forEach((btn) => btn.addEventListener("click", closeModal));
    refreshIcons();
    if (onOpen) onOpen(root);
    return root;
  }

  function confirm({ title, message, confirmText = "Confirm", danger = false }) {
    return new Promise((resolve) => {
      modal({
        title,
        width: "max-w-md",
        body: `<p class="text-slate-600">${message}</p>`,
        footer: `
          <button type="button" class="btn-secondary" data-close="1">Cancel</button>
          <button type="button" class="${danger ? "btn-danger" : "btn-primary"}" id="confirm-ok">${confirmText}</button>
        `,
        onOpen: (root) => {
          root.querySelector("#confirm-ok").addEventListener("click", () => {
            closeModal();
            resolve(true);
          });
          root.querySelectorAll("[data-close]").forEach((btn) => {
            btn.addEventListener("click", () => resolve(false));
          });
        },
      });
    });
  }

  function empty(title, hint, iconName = "inbox") {
    return `
      <div class="flex flex-col items-center justify-center py-16 text-center">
        <div class="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">${icon(iconName, 24)}</div>
        <p class="font-semibold text-slate-800">${title}</p>
        <p class="text-sm text-slate-500 mt-1 max-w-sm">${hint}</p>
      </div>
    `;
  }

  function badge(text, tone = "slate") {
    const map = {
      slate: "bg-slate-100 text-slate-700",
      green: "bg-emerald-50 text-emerald-700",
      red: "bg-rose-50 text-rose-700",
      amber: "bg-amber-50 text-amber-700",
      blue: "bg-sky-50 text-sky-700",
      navy: "bg-slate-900 text-white",
    };
    return `<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[tone] || map.slate}">${text}</span>`;
  }

  function stockBadge(product) {
    const stock = Number(product.currentStock || 0);
    if (stock <= 0) return badge("Out of stock", "red");
    if (stock <= Number(product.minStock || 0)) return badge("Low stock", "amber");
    return badge("In stock", "green");
  }

  function pageHeader({ title, subtitle, actions = "" }) {
    return `
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-slate-900">${title}</h1>
          ${subtitle ? `<p class="text-sm text-slate-500 mt-1">${subtitle}</p>` : ""}
        </div>
        <div class="flex flex-wrap items-center gap-2">${actions}</div>
      </div>
    `;
  }

  function card(html, extra = "") {
    return `<div class="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-900/5 ${extra}">${html}</div>`;
  }

  function input(name, label, opts = {}) {
    const {
      type = "text",
      value = "",
      placeholder = "",
      required = false,
      step,
      min,
      max,
      options,
      rows,
    } = opts;
    const req = required ? "required" : "";
    const common = `name="${name}" id="f-${name}" class="field" ${req}`;
    let control = "";
    if (type === "select") {
      control = `<select ${common}>${(options || [])
        .map((o) => {
          const val = typeof o === "object" ? o.value : o;
          const lab = typeof o === "object" ? o.label : o;
          return `<option value="${Utils.escapeHtml(val)}" ${String(val) === String(value) ? "selected" : ""}>${Utils.escapeHtml(lab)}</option>`;
        })
        .join("")}</select>`;
    } else if (type === "textarea") {
      control = `<textarea ${common} rows="${rows || 3}" placeholder="${placeholder}">${Utils.escapeHtml(value)}</textarea>`;
    } else {
      control = `<input type="${type}" ${common} value="${Utils.escapeHtml(value)}" placeholder="${placeholder}" ${
        step != null ? `step="${step}"` : ""
      } ${min != null ? `min="${min}"` : ""} ${max != null ? `max="${max}"` : ""} />`;
    }
    return `
      <label class="block">
        <span class="label">${label}${required ? " *" : ""}</span>
        ${control}
      </label>
    `;
  }

  function formToObject(form) {
    const data = {};
    new FormData(form).forEach((v, k) => {
      data[k] = typeof v === "string" ? v.trim() : v;
    });
    return data;
  }

  function categoryName(state, id) {
    return state.categories.find((c) => c.id === id)?.name || "Uncategorized";
  }

  function printHtml(html) {
    const frame = document.getElementById("print-root");
    frame.innerHTML = html;
    document.body.classList.add("printing");
    window.print();
    document.body.classList.remove("printing");
  }

  function receiptHtml(sale, settings) {
    const s = settings || Store.settings();
    const rows = sale.items
      .map(
        (i) => `
        <tr>
          <td>${Utils.escapeHtml(i.name)}</td>
          <td class="num">${i.qty}</td>
          <td class="num">${Utils.formatNumber(i.unitPrice)}</td>
          <td class="num">${Utils.formatNumber(i.lineTotal)}</td>
        </tr>`
      )
      .join("");
    return `
      <div class="receipt">
        <div class="receipt-head">
          <h2>${Utils.escapeHtml(s.shopName)}</h2>
          <p>${Utils.escapeHtml(s.shopAddress || "")}</p>
          <p>${Utils.escapeHtml(s.shopPhone || "")}</p>
        </div>
        <div class="receipt-meta">
          <div><strong>Invoice:</strong> ${Utils.escapeHtml(sale.invoiceNo)}</div>
          <div>${Utils.formatDateTime(sale.date)}</div>
          <div><strong>Customer:</strong> ${Utils.escapeHtml(sale.customerName || "Walk-in")}</div>
          ${sale.customerPhone ? `<div>${Utils.escapeHtml(sale.customerPhone)}</div>` : ""}
        </div>
        <table>
          <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="receipt-totals">
          <div><span>Subtotal</span><span>${money(sale.subtotal)}</span></div>
          <div><span>Discount</span><span>${money(sale.discount)}</span></div>
          <div class="grand"><span>Grand Total</span><span>${money(sale.grandTotal)}</span></div>
          <div><span>Amount Paid</span><span>${money(sale.amountPaid)}</span></div>
          <div><span>Balance</span><span>${money(sale.balanceDue)}</span></div>
          <div><span>Payment</span><span>${Utils.escapeHtml(sale.paymentMethod)} · ${Utils.escapeHtml(sale.paymentStatus)}</span></div>
        </div>
        <p class="thanks">${Utils.escapeHtml(s.receiptFooter || "Thank you!")}</p>
      </div>
    `;
  }

  function customerStatement(customer, state) {
    const settings = state.settings;
    const sales = state.sales.filter((s) => s.customerId === customer.id);
    const payments = state.customerPayments.filter((p) => p.customerId === customer.id);
    const rows = [
      ...sales.map((s) => ({
        date: s.date,
        detail: `Sale ${s.invoiceNo}${s.status === "voided" ? " (voided)" : ""}`,
        debit: s.status === "voided" ? 0 : s.grandTotal,
        credit: s.status === "voided" ? 0 : s.amountPaid,
      })),
      ...payments
        .filter((p) => p.type === "payment")
        .map((p) => ({
          date: p.date,
          detail: `Payment (${p.method})`,
          debit: 0,
          credit: p.amount,
        })),
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    return `
      <div class="receipt statement">
        <div class="receipt-head">
          <h2>${Utils.escapeHtml(settings.shopName)}</h2>
          <p>Customer Statement</p>
        </div>
        <div class="receipt-meta">
          <div><strong>${Utils.escapeHtml(customer.name)}</strong></div>
          <div>${Utils.escapeHtml(customer.phone || "")}</div>
          <div>${Utils.escapeHtml(customer.address || "")}</div>
        </div>
        <table>
          <thead><tr><th>Date</th><th>Detail</th><th>Debit</th><th>Credit</th></tr></thead>
          <tbody>
            ${rows
              .map(
                (r) => `<tr>
              <td>${Utils.formatDate(r.date)}</td>
              <td>${Utils.escapeHtml(r.detail)}</td>
              <td class="num">${r.debit ? Utils.formatNumber(r.debit) : ""}</td>
              <td class="num">${r.credit ? Utils.formatNumber(r.credit) : ""}</td>
            </tr>`
              )
              .join("")}
          </tbody>
        </table>
        <div class="receipt-totals">
          <div><span>Total Purchases</span><span>${money(customer.totalPurchases)}</span></div>
          <div><span>Total Paid</span><span>${money(customer.totalPaid)}</span></div>
          <div class="grand"><span>Outstanding Udhaar</span><span>${money(customer.outstanding)}</span></div>
        </div>
      </div>
    `;
  }

  return {
    money,
    icon,
    refreshIcons,
    toast,
    modal,
    closeModal,
    confirm,
    empty,
    badge,
    stockBadge,
    pageHeader,
    card,
    input,
    formToObject,
    categoryName,
    printHtml,
    receiptHtml,
    customerStatement,
  };
})();
