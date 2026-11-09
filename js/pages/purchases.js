const PurchasesPage = (() => {
  let query = "";

  function openForm() {
    const state = Store.getState();
    const products = state.products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` }));
    UI.modal({
      title: "Add purchase (stock in)",
      body: `
        <form id="purchase-form" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${UI.input("productId", "Product", { type: "select", options: products.length ? products : [{ value: "", label: "No products" }], required: true })}
          ${UI.input("quantity", "Purchase quantity", { type: "number", min: "0.01", step: "0.01", required: true })}
          ${UI.input("totalCost", "Total purchase cost", { type: "number", min: "0", step: "0.01", required: true })}
          ${UI.input("date", "Purchase date", { type: "date", value: Utils.todayISO(), required: true })}
          ${UI.input("supplierName", "Supplier name (optional)")}
          ${UI.input("paymentStatus", "Payment status", { type: "select", options: Finance.PURCHASE_PAYMENT, value: "Paid" })}
          ${UI.input("amountPaid", "Amount paid (if partial)", { type: "number", min: "0", step: "0.01", value: "0" })}
          <div class="md:col-span-2">${UI.input("notes", "Notes", { type: "textarea" })}</div>
          <div class="md:col-span-2 rounded-xl bg-slate-50 p-3 text-sm" id="cost-preview">Cost per unit will appear here.</div>
        </form>
      `,
      footer: `<button class="btn-secondary" data-close="1">Cancel</button><button class="btn-primary" id="save-purchase">Save purchase</button>`,
      onOpen: (root) => {
        const form = root.querySelector("#purchase-form");
        const preview = () => {
          const qty = Number(form.quantity.value);
          const total = Number(form.totalCost.value);
          const el = root.querySelector("#cost-preview");
          if (qty > 0 && total >= 0) {
            el.innerHTML = `Cost per unit = <strong>${UI.money(total / qty)}</strong>. This creates a new FIFO batch and does not overwrite older purchase costs.`;
          }
        };
        form.quantity.addEventListener("input", preview);
        form.totalCost.addEventListener("input", preview);
        root.querySelector("#save-purchase").onclick = () => {
          if (!form.reportValidity()) return;
          const data = UI.formToObject(form);
          try {
            Store.update((state) => {
              Finance.createPurchase(state, {
                productId: data.productId,
                quantity: Number(data.quantity),
                totalCost: Number(data.totalCost),
                date: data.date,
                supplierName: data.supplierName,
                paymentStatus: data.paymentStatus,
                amountPaid: Number(data.amountPaid || 0),
                notes: data.notes,
              });
            });
            UI.closeModal();
            UI.toast("Purchase recorded and stock updated");
            render();
          } catch (err) {
            UI.toast(err.message, "error");
          }
        };
      },
    });
  }

  function render() {
    const state = Store.getState();
    let list = [...state.purchases].reverse();
    if (query) {
      list = list.filter(
        (p) => Utils.searchMatch(p.productName, query) || Utils.searchMatch(p.supplierName, query)
      );
    }
    const unpaid = list.filter((p) => p.paymentStatus !== "Paid");
    const view = document.getElementById("view");
    view.innerHTML = `
      ${UI.pageHeader({
        title: "Purchases",
        subtitle: "Stock in from suppliers · FIFO batches keep historical costs",
        actions: `<button class="btn-primary" id="add-purchase">${UI.icon("plus", 16)} Add purchase</button>`,
      })}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div class="kpi"><div class="kpi-label">Purchase records</div><div class="kpi-value">${state.purchases.length}</div></div>
        <div class="kpi"><div class="kpi-label">Total purchase spend</div><div class="kpi-value">${UI.money(
          state.purchases.reduce((s, p) => s + Number(p.totalCost), 0)
        )}</div></div>
        <div class="kpi"><div class="kpi-label">Unpaid / partial to suppliers</div><div class="kpi-value text-rose-600">${unpaid.length}</div></div>
      </div>
      ${UI.card(`
        <div class="p-4 border-b border-slate-100">
          <input class="field mt-0" id="pur-search" placeholder="Search product or supplier" value="${Utils.escapeHtml(query)}" />
        </div>
        ${
          list.length
            ? `<div class="table-wrap"><table class="data-table">
          <thead><tr><th>Date</th><th>Product</th><th>Qty</th><th>Total cost</th><th>Cost / unit</th><th>Supplier</th><th>Payment</th></tr></thead>
          <tbody>
            ${list
              .map(
                (p) => `<tr>
              <td>${Utils.formatDate(p.date)}</td>
              <td class="font-semibold">${Utils.escapeHtml(p.productName)}</td>
              <td>${p.quantity}</td>
              <td>${UI.money(p.totalCost)}</td>
              <td>${UI.money(p.costPerUnit)}</td>
              <td>${Utils.escapeHtml(p.supplierName || "—")}</td>
              <td>${UI.badge(p.paymentStatus, p.paymentStatus === "Paid" ? "green" : p.paymentStatus === "Partial" ? "amber" : "red")}</td>
            </tr>`
              )
              .join("")}
          </tbody>
        </table></div>`
            : UI.empty("No purchases yet", "Buy stock from a supplier to increase inventory.", "truck")
        }
      `)}
    `;
    view.querySelector("#add-purchase").onclick = openForm;
    view.querySelector("#pur-search").oninput = Utils.debounce((e) => {
      query = e.target.value;
      render();
    }, 180);
    UI.refreshIcons();
  }

  return { render };
})();
