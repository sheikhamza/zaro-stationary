const ProductsPage = (() => {
  let query = "";
  let category = "all";
  let sort = "name";

  function filtered(state) {
    let list = [...state.products];
    if (query) {
      list = list.filter(
        (p) => Utils.searchMatch(p.name, query) || Utils.searchMatch(p.sku, query) || Utils.searchMatch(p.description, query)
      );
    }
    if (category !== "all") list = list.filter((p) => p.categoryId === category);
    list.sort((a, b) => {
      if (sort === "stock") return Number(b.currentStock) - Number(a.currentStock);
      if (sort === "profit") {
        return (
          Number(b.sellingPrice) -
          Finance.displayPurchaseCost(state, b.id) -
          (Number(a.sellingPrice) - Finance.displayPurchaseCost(state, a.id))
        );
      }
      if (sort === "price") return Number(b.sellingPrice) - Number(a.sellingPrice);
      return a.name.localeCompare(b.name);
    });
    return list;
  }

  function openForm(existing) {
    const state = Store.getState();
    const cats = state.categories.map((c) => ({ value: c.id, label: c.name }));
    UI.modal({
      title: existing ? "Edit product" : "Add product",
      body: `
        <form id="product-form" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${UI.input("name", "Product name", { value: existing?.name || "", required: true })}
          ${UI.input("sku", "SKU / Code", { value: existing?.sku || Finance.nextSku(state), required: true })}
          ${UI.input("categoryId", "Category", { type: "select", value: existing?.categoryId || cats[0]?.value, options: cats.length ? cats : [{ value: "", label: "No categories" }] })}
          ${UI.input("unit", "Unit", { type: "select", value: existing?.unit || "piece", options: Finance.UNITS })}
          ${UI.input("sellingPrice", "Selling price per unit", { type: "number", step: "0.01", min: "0", value: existing?.sellingPrice ?? "", required: true })}
          ${UI.input("minStock", "Minimum stock alert", { type: "number", min: "0", value: existing?.minStock ?? state.settings.lowStockDefault })}
          <div class="md:col-span-2">${UI.input("description", "Description (optional)", { type: "textarea", value: existing?.description || "" })}</div>
          ${
            existing
              ? ""
              : `<p class="md:col-span-2 text-sm text-slate-500">Initial stock is added from Purchases. Purchase cost is stored on each stock batch using FIFO.</p>`
          }
        </form>
      `,
      footer: `<button class="btn-secondary" data-close="1">Cancel</button><button class="btn-primary" id="save-product">Save product</button>`,
      onOpen: () => {
        document.getElementById("save-product").onclick = () => {
          const form = document.getElementById("product-form");
          if (!form.reportValidity()) return;
          const data = UI.formToObject(form);
          try {
            saveProduct(existing, data);
            UI.closeModal();
            UI.toast(existing ? "Product updated" : "Product added");
            render();
          } catch (err) {
            UI.toast(err.message, "error");
          }
        };
      },
    });
  }

  function saveProduct(existing, data) {
    Store.update((state) => {
      const skuTaken = state.products.some((p) => p.sku === data.sku && p.id !== existing?.id);
      if (skuTaken) throw new Error("SKU already exists");
      if (!data.name) throw new Error("Product name is required");
      const sellingPrice = Number(data.sellingPrice);
      if (sellingPrice < 0) throw new Error("Selling price cannot be negative");
      if (existing) {
        const p = state.products.find((x) => x.id === existing.id);
        Object.assign(p, {
          name: data.name,
          sku: data.sku,
          categoryId: data.categoryId,
          unit: data.unit,
          sellingPrice,
          minStock: Number(data.minStock || 0),
          description: data.description,
          updatedAt: Utils.nowISO(),
        });
      } else {
        state.products.push({
          id: Utils.uid("prd"),
          name: data.name,
          sku: data.sku,
          categoryId: data.categoryId,
          unit: data.unit,
          sellingPrice,
          currentStock: 0,
          minStock: Number(data.minStock || 0),
          description: data.description,
          createdAt: Utils.nowISO(),
        });
      }
    });
  }

  function openCategory() {
    UI.modal({
      title: "Manage categories",
      width: "max-w-lg",
      body: categoryBody(),
      footer: `<button class="btn-secondary" data-close="1">Close</button>`,
      onOpen: bindCategory,
    });
  }

  function categoryBody() {
    const cats = Store.get("categories");
    return `
      <form id="cat-form" class="flex gap-2 mb-4">
        <input class="field mt-0" name="name" placeholder="New category" required />
        <button class="btn-primary shrink-0">Add</button>
      </form>
      ${
        cats.length
          ? `<div class="space-y-2">${cats
              .map(
                (c) => `<div class="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2">
            <span class="font-medium">${Utils.escapeHtml(c.name)}</span>
            <button class="text-rose-600 text-sm font-semibold del-cat" data-id="${c.id}">Delete</button>
          </div>`
              )
              .join("")}</div>`
          : `<p class="text-sm text-slate-500">No categories yet.</p>`
      }
    `;
  }

  function bindCategory(root) {
    root.querySelector("#cat-form").onsubmit = (e) => {
      e.preventDefault();
      const name = UI.formToObject(e.target).name;
      Store.insert("categories", { id: Utils.uid("cat"), name });
      UI.toast("Category added");
      root.querySelector("#modal-body").innerHTML = categoryBody();
      bindCategory(root);
    };
    root.querySelectorAll(".del-cat").forEach((btn) => {
      btn.onclick = async () => {
        const ok = await UI.confirm({
          title: "Delete category?",
          message: "Products in this category will become uncategorized.",
          danger: true,
          confirmText: "Delete",
        });
        if (!ok) return;
        Store.update((state) => {
          state.categories = state.categories.filter((c) => c.id !== btn.dataset.id);
          state.products.forEach((p) => {
            if (p.categoryId === btn.dataset.id) p.categoryId = "";
          });
        });
        UI.toast("Category deleted");
        render();
        root.querySelector("#modal-body").innerHTML = categoryBody();
        bindCategory(root);
      };
    });
  }

  function details(product) {
    const state = Store.getState();
    const avg = Finance.displayPurchaseCost(state, product.id);
    const value = Finance.inventoryValueForProduct(state, product.id);
    const batches = state.purchaseBatches.filter((b) => b.productId === product.id);
    UI.modal({
      title: product.name,
      body: `
        <div class="grid grid-cols-2 gap-3 text-sm mb-4">
          <div>SKU<br><strong>${product.sku}</strong></div>
          <div>Category<br><strong>${UI.categoryName(state, product.categoryId)}</strong></div>
          <div>Avg / latest FIFO cost<br><strong>${UI.money(avg)}</strong></div>
          <div>Selling price<br><strong>${UI.money(product.sellingPrice)}</strong></div>
          <div>Profit / unit (vs avg cost)<br><strong class="text-emerald-600">${UI.money(product.sellingPrice - avg)}</strong></div>
          <div>Stock value<br><strong>${UI.money(value)}</strong></div>
        </div>
        <h4 class="font-semibold mb-2">FIFO batches</h4>
        ${
          batches.length
            ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Remaining</th><th>Cost / unit</th></tr></thead><tbody>
            ${batches
              .map(
                (b) =>
                  `<tr><td>${Utils.formatDate(b.date)}</td><td>${b.qtyRemaining} / ${b.qtyOriginal}</td><td>${UI.money(
                    b.costPerUnit
                  )}</td></tr>`
              )
              .join("")}
          </tbody></table></div>`
            : `<p class="text-sm text-slate-500">No purchase batches yet.</p>`
        }
      `,
      footer: `<button class="btn-secondary" data-close="1">Close</button>`,
    });
  }

  function render() {
    const state = Store.getState();
    const list = filtered(state);
    const view = document.getElementById("view");
    view.innerHTML = `
      ${UI.pageHeader({
        title: "Products",
        subtitle: "Manage catalogue, prices and stock alerts",
        actions: `
          <button class="btn-secondary" id="manage-cats">${UI.icon("tags", 16)} Categories</button>
          <button class="btn-primary" id="add-product">${UI.icon("plus", 16)} Add product</button>
        `,
      })}
      ${UI.card(`
        <div class="p-4 flex flex-col md:flex-row gap-3 border-b border-slate-100">
          <input class="field mt-0" id="prod-search" placeholder="Search name or SKU" value="${Utils.escapeHtml(query)}" />
          <select class="field mt-0 md:w-48" id="prod-cat">
            <option value="all">All categories</option>
            ${state.categories.map((c) => `<option value="${c.id}" ${category === c.id ? "selected" : ""}>${Utils.escapeHtml(c.name)}</option>`).join("")}
          </select>
          <select class="field mt-0 md:w-44" id="prod-sort">
            <option value="name" ${sort === "name" ? "selected" : ""}>Sort: Name</option>
            <option value="stock" ${sort === "stock" ? "selected" : ""}>Sort: Stock</option>
            <option value="price" ${sort === "price" ? "selected" : ""}>Sort: Selling price</option>
            <option value="profit" ${sort === "profit" ? "selected" : ""}>Sort: Profit / unit</option>
          </select>
        </div>
        ${
          list.length
            ? `<div class="table-wrap"><table class="data-table">
          <thead><tr><th>Product</th><th>Category</th><th>Stock</th><th>Cost (FIFO avg)</th><th>Selling</th><th>Profit / unit</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${list
              .map((p) => {
                const cost = Finance.displayPurchaseCost(state, p.id);
                return `<tr>
                  <td><div class="font-semibold">${Utils.escapeHtml(p.name)}</div><div class="text-xs text-slate-400">${p.sku} · ${p.unit}</div></td>
                  <td>${Utils.escapeHtml(UI.categoryName(state, p.categoryId))}</td>
                  <td class="font-semibold">${p.currentStock}</td>
                  <td>${UI.money(cost)}</td>
                  <td>${UI.money(p.sellingPrice)}</td>
                  <td class="text-emerald-600 font-semibold">${UI.money(p.sellingPrice - cost)}</td>
                  <td>${UI.stockBadge(p)}</td>
                  <td class="whitespace-nowrap">
                    <button class="btn-ghost p-2 view-p" data-id="${p.id}">${UI.icon("eye", 16)}</button>
                    <button class="btn-ghost p-2 edit-p" data-id="${p.id}">${UI.icon("pencil", 16)}</button>
                    <button class="btn-ghost p-2 text-rose-600 del-p" data-id="${p.id}">${UI.icon("trash-2", 16)}</button>
                  </td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table></div>`
            : UI.empty("No products found", "Add your first stationery item to start selling.", "package")
        }
      `)}
    `;
    view.querySelector("#add-product").onclick = () => openForm();
    view.querySelector("#manage-cats").onclick = openCategory;
    view.querySelector("#prod-search").oninput = Utils.debounce((e) => {
      query = e.target.value;
      render();
    }, 180);
    view.querySelector("#prod-cat").onchange = (e) => {
      category = e.target.value;
      render();
    };
    view.querySelector("#prod-sort").onchange = (e) => {
      sort = e.target.value;
      render();
    };
    view.querySelectorAll(".edit-p").forEach((b) => {
      b.onclick = () => openForm(state.products.find((p) => p.id === b.dataset.id));
    });
    view.querySelectorAll(".view-p").forEach((b) => {
      b.onclick = () => details(state.products.find((p) => p.id === b.dataset.id));
    });
    view.querySelectorAll(".del-p").forEach((b) => {
      b.onclick = async () => {
        const ok = await UI.confirm({
          title: "Delete product?",
          message: "This removes the product from the catalogue. Historical sales remain.",
          danger: true,
          confirmText: "Delete",
        });
        if (!ok) return;
        Store.remove("products", b.dataset.id);
        UI.toast("Product deleted");
        render();
      };
    });
    UI.refreshIcons();
  }

  return { render };
})();
