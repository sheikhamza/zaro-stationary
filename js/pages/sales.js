const SalesPage = (() => {
  let query = "";
  let method = "all";
  let from = "";
  let to = "";

  function list() {
    const state = Store.getState();
    return [...state.sales].reverse().filter((s) => {
      if (query && !Utils.searchMatch(s.invoiceNo, query) && !Utils.searchMatch(s.customerName, query)) return false;
      if (method !== "all" && s.paymentMethod !== method) return false;
      if (from && !Utils.inRange(s.date, from, to || from)) return false;
      if (!from && to && !Utils.inRange(s.date, null, to)) return false;
      return true;
    });
  }

  function viewInvoice(sale) {
    UI.modal({
      title: sale.invoiceNo,
      body: `
        ${sale.status === "voided" ? `<div class="mb-3">${UI.badge("Cancelled", "red")}</div>` : ""}
        ${UI.receiptHtml(sale)}
        <div class="mt-4 rounded-xl bg-slate-50 p-3 text-sm grid grid-cols-2 gap-2">
          <div>Total cost (FIFO)<br><strong>${UI.money(sale.costTotal)}</strong></div>
          <div>Gross profit<br><strong class="text-emerald-700">${UI.money(sale.grossProfit)}</strong></div>
        </div>
      `,
      footer: `
        <button class="btn-secondary" data-close="1">Close</button>
        <button class="btn-secondary" id="print-inv">${UI.icon("printer", 16)} Print</button>
        ${sale.status === "completed" ? `<button class="btn-danger" id="void-inv">Cancel sale</button>` : ""}
      `,
      onOpen: (root) => {
        root.querySelector("#print-inv").onclick = () => UI.printHtml(UI.receiptHtml(sale));
        const voidBtn = root.querySelector("#void-inv");
        if (voidBtn) {
          voidBtn.onclick = async () => {
            const ok = await UI.confirm({
              title: "Cancel this sale?",
              message: "Stock will be restored to the original FIFO batches and customer balances reversed.",
              danger: true,
              confirmText: "Void sale",
            });
            if (!ok) return;
            try {
              Store.update((state) => Finance.voidSale(state, sale.id));
              UI.closeModal();
              UI.toast("Sale cancelled and stock restored");
              render();
            } catch (err) {
              UI.toast(err.message, "error");
            }
          };
        }
      },
    });
  }

  function render() {
    const rows = list();
    const view = document.getElementById("view");
    view.innerHTML = `
      ${UI.pageHeader({
        title: "Sales history",
        subtitle: "Invoices, profit snapshots and cancellations",
      })}
      ${UI.card(`
        <div class="p-4 grid grid-cols-1 md:grid-cols-4 gap-3 border-b border-slate-100">
          <input class="field mt-0" id="sale-q" placeholder="Search invoice or customer" value="${Utils.escapeHtml(query)}" />
          <select class="field mt-0" id="sale-m">
            <option value="all">All methods</option>
            ${Finance.PAYMENT_METHODS.map((m) => `<option ${method === m ? "selected" : ""}>${m}</option>`).join("")}
          </select>
          <input class="field mt-0" type="date" id="sale-from" value="${from}" />
          <input class="field mt-0" type="date" id="sale-to" value="${to}" />
        </div>
        ${
          rows.length
            ? `<div class="table-wrap"><table class="data-table">
          <thead><tr><th>Invoice</th><th>Customer</th><th>Items</th><th>Amount</th><th>Cost</th><th>Profit</th><th>Payment</th><th></th></tr></thead>
          <tbody>
            ${rows
              .map((s) => {
                const items = s.items.reduce((n, i) => n + Number(i.qty), 0);
                return `<tr class="${s.status === "voided" ? "opacity-50" : ""}">
                  <td class="font-semibold">${s.invoiceNo}<div class="text-xs font-normal text-slate-400">${Utils.formatDateTime(s.date)}</div></td>
                  <td>${Utils.escapeHtml(s.customerName)}</td>
                  <td>${items}</td>
                  <td>${UI.money(s.grandTotal)}</td>
                  <td>${UI.money(s.costTotal)}</td>
                  <td class="text-emerald-600 font-semibold">${UI.money(s.grossProfit)}</td>
                  <td>${UI.badge(s.paymentMethod, "navy")} ${UI.badge(s.status === "voided" ? "Cancelled" : s.paymentStatus, s.status === "voided" ? "red" : s.paymentStatus === "Paid" ? "green" : "amber")}</td>
                  <td><button class="btn-secondary view-sale" data-id="${s.id}">View</button></td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table></div>`
            : UI.empty("No invoices found", "Completed POS sales will show here.", "receipt")
        }
      `)}
    `;
    view.querySelector("#sale-q").oninput = Utils.debounce((e) => {
      query = e.target.value;
      render();
    }, 180);
    view.querySelector("#sale-m").onchange = (e) => {
      method = e.target.value;
      render();
    };
    view.querySelector("#sale-from").onchange = (e) => {
      from = e.target.value;
      render();
    };
    view.querySelector("#sale-to").onchange = (e) => {
      to = e.target.value;
      render();
    };
    view.querySelectorAll(".view-sale").forEach((b) => {
      b.onclick = () => viewInvoice(Store.getById("sales", b.dataset.id));
    });
    UI.refreshIcons();
  }

  return { render };
})();
