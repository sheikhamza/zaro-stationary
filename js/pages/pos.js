const POSPage = (() => {
  let cart = [];
  let search = "";
  let discount = 0;

  function addToCart(product, qty = 1) {
    const existing = cart.find((i) => i.productId === product.id);
    const nextQty = (existing ? existing.qty : 0) + qty;
    if (nextQty > Number(product.currentStock)) {
      UI.toast(`Only ${product.currentStock} ${product.unit} available`, "error");
      return;
    }
    if (existing) existing.qty = nextQty;
    else {
      cart.push({
        productId: product.id,
        name: product.name,
        sku: product.sku,
        unit: product.unit,
        qty,
        unitPrice: Number(product.sellingPrice),
        stock: Number(product.currentStock),
        defaultPrice: Number(product.sellingPrice),
      });
    }
    render();
  }

  function setQty(id, qty) {
    const item = cart.find((i) => i.productId === id);
    if (!item) return;
    const product = Store.getById("products", id);
    const max = Number(product?.currentStock || 0);
    if (qty <= 0) {
      cart = cart.filter((i) => i.productId !== id);
    } else if (qty > max) {
      UI.toast(`Only ${max} in stock`, "error");
      item.qty = max;
    } else {
      item.qty = qty;
    }
    render();
  }

  async function changePrice(item) {
    const ok = await UI.confirm({
      title: "Custom selling price?",
      message: `Default price for ${item.name} is ${UI.money(item.defaultPrice)}. Use a custom price for this sale only?`,
      confirmText: "Change price",
    });
    if (!ok) return;
    UI.modal({
      title: "Custom unit price",
      width: "max-w-md",
      body: UI.input("price", "Unit selling price", { type: "number", min: "0", step: "0.01", value: item.unitPrice, required: true }),
      footer: `<button class="btn-secondary" data-close="1">Cancel</button><button class="btn-primary" id="set-price">Update</button>`,
      onOpen: (root) => {
        root.querySelector("#set-price").onclick = () => {
          const val = Number(root.querySelector("#f-price").value);
          if (val < 0) return UI.toast("Price cannot be negative", "error");
          item.unitPrice = Utils.roundMoney(val);
          UI.closeModal();
          render();
        };
      },
    });
  }

  function totals() {
    const subtotal = Utils.roundMoney(cart.reduce((s, i) => s + i.qty * i.unitPrice, 0));
    const disc = Math.min(Math.max(0, Number(discount) || 0), subtotal);
    return { subtotal, discount: disc, grand: Utils.roundMoney(subtotal - disc) };
  }

  function checkout() {
    if (!cart.length) return UI.toast("Cart is empty", "error");
    const t = totals();
    const customers = Store.get("customers");
    UI.modal({
      title: "Complete sale",
      body: `
        <form id="sale-form" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="md:col-span-2 rounded-xl bg-slate-50 p-3 text-sm">
            Grand total <strong>${UI.money(t.grand)}</strong> · ${cart.length} line(s)
          </div>
          ${UI.input("paymentMethod", "Payment method", { type: "select", options: Finance.PAYMENT_METHODS, value: "Cash" })}
          ${UI.input("amountPaid", "Amount received", { type: "number", min: "0", step: "0.01", value: t.grand })}
          ${UI.input("customerId", "Existing customer", {
            type: "select",
            options: [{ value: "", label: "Walk-in / new" }, ...customers.map((c) => ({ value: c.id, label: `${c.name} (${c.phone || "no phone"})` }))],
          })}
          ${UI.input("customerName", "Customer name")}
          ${UI.input("customerPhone", "Phone")}
          <div class="md:col-span-2">${UI.input("notes", "Notes", { type: "textarea", rows: 2 })}</div>
        </form>
      `,
      footer: `<button class="btn-secondary" data-close="1">Back</button><button class="btn-primary" id="finish-sale">Complete sale</button>`,
      onOpen: (root) => {
        const form = root.querySelector("#sale-form");
        const method = form.paymentMethod;
        const paid = form.amountPaid;
        const sync = () => {
          if (method.value === "Cash" || method.value === "Online") paid.value = t.grand;
          if (method.value === "Credit") paid.value = 0;
        };
        method.onchange = sync;
        form.customerId.onchange = () => {
          const c = Store.getById("customers", form.customerId.value);
          if (c) {
            form.customerName.value = c.name;
            form.customerPhone.value = c.phone || "";
          }
        };
        root.querySelector("#finish-sale").onclick = () => {
          const data = UI.formToObject(form);
          try {
            let sale;
            Store.update((state) => {
              sale = Finance.completeSale(state, {
                items: cart.map((i) => ({ productId: i.productId, qty: i.qty, unitPrice: i.unitPrice })),
                discount: t.discount,
                paymentMethod: data.paymentMethod,
                amountPaid: Number(data.amountPaid || 0),
                customerId: data.customerId || null,
                customerName: data.customerName,
                customerPhone: data.customerPhone,
                notes: data.notes,
              });
            });
            cart = [];
            discount = 0;
            UI.closeModal();
            UI.toast(`Sale ${sale.invoiceNo} completed · Profit ${UI.money(sale.grossProfit)}`);
            showReceipt(sale);
            render();
          } catch (err) {
            UI.toast(err.message, "error");
          }
        };
      },
    });
  }

  function showReceipt(sale) {
    UI.modal({
      title: `Receipt ${sale.invoiceNo}`,
      width: "max-w-md",
      body: UI.receiptHtml(sale),
      footer: `<button class="btn-secondary" data-close="1">Close</button><button class="btn-primary" id="print-rcpt">${UI.icon("printer", 16)} Print</button>`,
      onOpen: (root) => {
        root.querySelector("#print-rcpt").onclick = () => UI.printHtml(UI.receiptHtml(sale));
      },
    });
  }

  function render() {
    const state = Store.getState();
    const products = state.products.filter(
      (p) => Utils.searchMatch(p.name, search) || Utils.searchMatch(p.sku, search)
    );
    const t = totals();
    const view = document.getElementById("view");
    view.innerHTML = `
      ${UI.pageHeader({
        title: "Point of Sale",
        subtitle: "Search, add to cart and checkout quickly",
      })}
      <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div class="xl:col-span-2 space-y-4">
          <div class="relative">
            <input id="pos-search" class="field mt-0 pl-11 h-12 text-base" placeholder="Search by name or SKU..." value="${Utils.escapeHtml(search)}" />
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">${UI.icon("search", 18)}</span>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
            ${
              products.length
                ? products
                    .map((p) => {
                      const disabled = Number(p.currentStock) <= 0;
                      return `
                    <button class="pos-product text-left bg-white rounded-2xl border border-slate-100 p-4 shadow-sm transition disabled:opacity-50" data-id="${p.id}" ${
                      disabled ? "disabled" : ""
                    }>
                      <div class="flex items-start justify-between gap-2">
                        <p class="font-semibold">${Utils.escapeHtml(p.name)}</p>
                        ${UI.stockBadge(p)}
                      </div>
                      <p class="text-xs text-slate-400 mt-1">${p.sku}</p>
                      <p class="mt-3 text-lg font-extrabold">${UI.money(p.sellingPrice)}</p>
                      <p class="text-xs text-slate-500">${p.currentStock} ${p.unit} available</p>
                    </button>`;
                    })
                    .join("")
                : UI.empty("No matching products", "Try another name or SKU.", "search")
            }
          </div>
        </div>
        <div>${UI.card(`
          <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 class="font-semibold">Cart</h2>
            <button class="text-sm font-semibold text-rose-600" id="clear-cart">Clear</button>
          </div>
          <div class="p-4 space-y-3 max-h-[50vh] overflow-y-auto">
            ${
              cart.length
                ? cart
                    .map(
                      (i) => `
              <div class="rounded-xl border border-slate-100 p-3">
                <div class="flex justify-between gap-2">
                  <div>
                    <p class="font-semibold">${Utils.escapeHtml(i.name)}</p>
                    <button class="text-xs text-emerald-700 font-semibold price-btn" data-id="${i.productId}">${UI.money(i.unitPrice)} / ${i.unit}</button>
                  </div>
                  <button class="text-slate-400 remove-item" data-id="${i.productId}">${UI.icon("x", 16)}</button>
                </div>
                <div class="flex items-center gap-2 mt-2">
                  <button class="qty-btn w-8 h-8 rounded-lg bg-slate-100" data-id="${i.productId}" data-d="-1">-</button>
                  <input class="field mt-0 w-16 text-center qty-input" data-id="${i.productId}" value="${i.qty}" />
                  <button class="qty-btn w-8 h-8 rounded-lg bg-slate-100" data-id="${i.productId}" data-d="1">+</button>
                  <span class="ml-auto font-bold">${UI.money(i.qty * i.unitPrice)}</span>
                </div>
              </div>`
                    )
                    .join("")
                : `<p class="text-sm text-slate-500 py-8 text-center">Tap a product to add it.</p>`
            }
          </div>
          <div class="px-5 py-4 border-t border-slate-100 space-y-3">
            <label class="flex items-center justify-between text-sm">
              <span class="text-slate-500">Subtotal</span><strong>${UI.money(t.subtotal)}</strong>
            </label>
            <label class="flex items-center justify-between gap-3 text-sm">
              <span class="text-slate-500">Discount</span>
              <input id="pos-discount" class="field mt-0 w-28 text-right" type="number" min="0" step="0.01" value="${discount}" />
            </label>
            <div class="flex items-center justify-between text-lg">
              <span class="font-semibold">Grand total</span>
              <span class="font-extrabold">${UI.money(t.grand)}</span>
            </div>
            <button class="btn-primary w-full h-11" id="checkout" ${cart.length ? "" : "disabled"}>${UI.icon("banknote", 16)} Checkout</button>
          </div>
        `)}</div>
      </div>
    `;
    view.querySelector("#pos-search").oninput = Utils.debounce((e) => {
      search = e.target.value;
      render();
    }, 150);
    view.querySelectorAll(".pos-product").forEach((btn) => {
      btn.onclick = () => addToCart(state.products.find((p) => p.id === btn.dataset.id));
    });
    view.querySelector("#clear-cart")?.addEventListener("click", () => {
      cart = [];
      render();
    });
    view.querySelectorAll(".qty-btn").forEach((btn) => {
      btn.onclick = () => {
        const item = cart.find((i) => i.productId === btn.dataset.id);
        if (!item) return;
        setQty(item.productId, item.qty + Number(btn.dataset.d));
      };
    });
    view.querySelectorAll(".qty-input").forEach((input) => {
      input.onchange = () => setQty(input.dataset.id, Number(input.value));
    });
    view.querySelectorAll(".remove-item").forEach((btn) => {
      btn.onclick = () => setQty(btn.dataset.id, 0);
    });
    view.querySelectorAll(".price-btn").forEach((btn) => {
      btn.onclick = () => changePrice(cart.find((i) => i.productId === btn.dataset.id));
    });
    view.querySelector("#pos-discount").onchange = (e) => {
      discount = Number(e.target.value) || 0;
      render();
    };
    view.querySelector("#checkout").onclick = checkout;
    UI.refreshIcons();
  }

  return { render };
})();
