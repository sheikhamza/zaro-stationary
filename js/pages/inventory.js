const InventoryPage = (() => {
  let query = "";
  let status = "all";

  function adjust(product, type) {
    const titles = {
      adjustment: "Manual stock correction",
      damage: "Damaged product",
      loss: "Lost product",
    };
    UI.modal({
      title: `${titles[type]} · ${product.name}`,
      width: "max-w-lg",
      body: `
        <p class="text-sm text-slate-500 mb-3">Current stock: <strong>${product.currentStock} ${product.unit}</strong></p>
        <form id="adj-form" class="grid gap-4">
          ${
            type === "adjustment"
              ? UI.input("direction", "Adjustment type", {
                  type: "select",
                  options: [
                    { value: "add", label: "Increase stock" },
                    { value: "remove", label: "Decrease stock" },
                  ],
                })
              : ""
          }
          ${UI.input("qty", "Quantity", { type: "number", min: "0.01", step: "0.01", required: true })}
          ${type === "adjustment" ? UI.input("costPerUnit", "Cost per unit (for increases)", { type: "number", min: "0", step: "0.01", value: Finance.displayPurchaseCost(Store.getState(), product.id) }) : ""}
          ${UI.input("reason", "Reason", { required: true, placeholder: "e.g. count correction, water damage" })}
        </form>
      `,
      footer: `<button class="btn-secondary" data-close="1">Cancel</button><button class="btn-primary" id="save-adj">Save</button>`,
      onOpen: () => {
        document.getElementById("save-adj").onclick = () => {
          const form = document.getElementById("adj-form");
          if (!form.reportValidity()) return;
          const data = UI.formToObject(form);
          let qty = Number(data.qty);
          if (type !== "adjustment" || data.direction === "remove") qty = -Math.abs(qty);
          else qty = Math.abs(qty);
          try {
            Store.update((state) => {
              Finance.adjustStock(state, {
                productId: product.id,
                qtyChange: qty,
                reason: data.reason,
                type,
                costPerUnit: data.costPerUnit ? Number(data.costPerUnit) : undefined,
              });
            });
            UI.closeModal();
            UI.toast("Inventory updated");
            render();
          } catch (err) {
            UI.toast(err.message, "error");
          }
        };
      },
    });
  }

  function movements() {
    const state = Store.getState();
    const rows = [...state.stockMovements].reverse().slice(0, 80);
    UI.modal({
      title: "Inventory movement history",
      width: "max-w-3xl",
      body: rows.length
        ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Qty</th><th>Reason</th></tr></thead><tbody>
          ${rows
            .map((m) => {
              const p = state.products.find((x) => x.id === m.productId);
              return `<tr>
                <td>${Utils.formatDateTime(m.date)}</td>
                <td>${Utils.escapeHtml(p?.name || "Removed product")}</td>
                <td>${UI.badge(m.type, m.qtyChange < 0 ? "red" : "green")}</td>
                <td class="${m.qtyChange < 0 ? "text-rose-600" : "text-emerald-600"} font-semibold">${m.qtyChange > 0 ? "+" : ""}${m.qtyChange}</td>
                <td>${Utils.escapeHtml(m.reason)}</td>
              </tr>`;
            })
            .join("")}
        </tbody></table></div>`
        : UI.empty("No movements", "Purchases, sales and adjustments will appear here.", "history"),
      footer: `<button class="btn-secondary" data-close="1">Close</button>`,
    });
  }

  function render() {
    const state = Store.getState();
    let list = [...state.products];
    if (query) list = list.filter((p) => Utils.searchMatch(p.name, query) || Utils.searchMatch(p.sku, query));
    if (status === "low") list = list.filter((p) => p.currentStock > 0 && p.currentStock <= p.minStock);
    if (status === "out") list = list.filter((p) => Number(p.currentStock) <= 0);
    const view = document.getElementById("view");
    view.innerHTML = `
      ${UI.pageHeader({
        title: "Inventory",
        subtitle: "Stock value uses remaining FIFO batches, not the latest purchase price",
        actions: `<button class="btn-secondary" id="show-mov">${UI.icon("history", 16)} Movement history</button>`,
      })}
      ${UI.card(`
        <div class="p-4 flex flex-col md:flex-row gap-3 border-b border-slate-100">
          <input class="field mt-0" id="inv-q" placeholder="Search products" value="${Utils.escapeHtml(query)}" />
          <select class="field mt-0 md:w-48" id="inv-st">
            <option value="all" ${status === "all" ? "selected" : ""}>All stock</option>
            <option value="low" ${status === "low" ? "selected" : ""}>Low stock</option>
            <option value="out" ${status === "out" ? "selected" : ""}>Out of stock</option>
          </select>
        </div>
        ${
          list.length
            ? `<div class="table-wrap"><table class="data-table">
          <thead><tr><th>Product</th><th>Cost</th><th>Selling</th><th>Stock</th><th>Stock value</th><th>Potential profit</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${list
              .map((p) => {
                const cost = Finance.displayPurchaseCost(state, p.id);
                const value = Finance.inventoryValueForProduct(state, p.id);
                const potential = Utils.roundMoney(Number(p.currentStock) * Number(p.sellingPrice) - value);
                return `<tr>
                  <td class="font-semibold">${Utils.escapeHtml(p.name)}<div class="text-xs font-normal text-slate-400">${p.sku}</div></td>
                  <td>${UI.money(cost)}</td>
                  <td>${UI.money(p.sellingPrice)}</td>
                  <td class="font-semibold">${p.currentStock} ${p.unit}</td>
                  <td>${UI.money(value)}</td>
                  <td class="text-emerald-600 font-semibold">${UI.money(potential)}</td>
                  <td>${UI.stockBadge(p)}</td>
                  <td class="whitespace-nowrap">
                    <button class="btn-ghost adj" data-id="${p.id}" data-t="adjustment" title="Adjust">${UI.icon("sliders-horizontal", 16)}</button>
                    <button class="btn-ghost adj" data-id="${p.id}" data-t="damage" title="Damage">${UI.icon("shield-alert", 16)}</button>
                    <button class="btn-ghost adj" data-id="${p.id}" data-t="loss" title="Loss">${UI.icon("package-x", 16)}</button>
                  </td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table></div>`
            : UI.empty("Nothing to show", "Add products and purchases first.", "boxes")
        }
      `)}
    `;
    view.querySelector("#show-mov").onclick = movements;
    view.querySelector("#inv-q").oninput = Utils.debounce((e) => {
      query = e.target.value;
      render();
    }, 180);
    view.querySelector("#inv-st").onchange = (e) => {
      status = e.target.value;
      render();
    };
    view.querySelectorAll(".adj").forEach((b) => {
      b.onclick = () => adjust(
        state.products.find((p) => p.id === b.dataset.id),
        b.dataset.t
      );
    });
    UI.refreshIcons();
  }

  return { render };
})();
