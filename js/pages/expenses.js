const ExpensesPage = (() => {
  let category = "all";
  let from = "";
  let to = "";

  function openForm(existing) {
    UI.modal({
      title: existing ? "Edit expense" : "Add expense",
      body: `
        <form id="exp-form" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${UI.input("title", "Expense title", { value: existing?.title || "", required: true })}
          ${UI.input("category", "Category", { type: "select", options: Finance.EXPENSE_CATEGORIES, value: existing?.category || "Other Expenses" })}
          ${UI.input("amount", "Amount", { type: "number", min: "0.01", step: "0.01", value: existing?.amount ?? "", required: true })}
          ${UI.input("date", "Date", { type: "date", value: existing?.date || Utils.todayISO(), required: true })}
          <div class="md:col-span-2">${UI.input("description", "Description", { type: "textarea", value: existing?.description || "" })}</div>
          <p class="md:col-span-2 text-sm text-slate-500">Operating expenses only. Product purchase costs are tracked separately in Purchases.</p>
        </form>
      `,
      footer: `<button class="btn-secondary" data-close="1">Cancel</button><button class="btn-primary" id="save-exp">Save</button>`,
      onOpen: () => {
        document.getElementById("save-exp").onclick = () => {
          const form = document.getElementById("exp-form");
          if (!form.reportValidity()) return;
          const data = UI.formToObject(form);
          const payload = {
            title: data.title,
            category: data.category,
            amount: Number(data.amount),
            date: data.date,
            description: data.description,
          };
          if (existing) Store.patch("expenses", existing.id, payload);
          else Store.insert("expenses", { id: Utils.uid("exp"), ...payload, createdAt: Utils.nowISO() });
          UI.closeModal();
          UI.toast(existing ? "Expense updated" : "Expense recorded");
          render();
        };
      },
    });
  }

  function render() {
    const state = Store.getState();
    let list = [...state.expenses].reverse();
    if (category !== "all") list = list.filter((e) => e.category === category);
    if (from || to) list = list.filter((e) => Utils.inRange(e.date, from || null, to || null));
    const total = list.reduce((s, e) => s + Number(e.amount), 0);
    const report = Finance.profitReport(state, from || Utils.startOfMonth(), to || new Date());
    const view = document.getElementById("view");
    view.innerHTML = `
      ${UI.pageHeader({
        title: "Expenses",
        subtitle: "Operating costs only · not product purchases",
        actions: `<button class="btn-primary" id="add-exp">${UI.icon("plus", 16)} Add expense</button>`,
      })}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div class="kpi"><div class="kpi-label">Shown expenses</div><div class="kpi-value text-rose-600">${UI.money(total)}</div></div>
        <div class="kpi"><div class="kpi-label">Gross profit (filtered period)</div><div class="kpi-value text-emerald-600">${UI.money(report.grossProfit)}</div></div>
        <div class="kpi"><div class="kpi-label">Net profit (gross − expenses)</div><div class="kpi-value ${report.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}">${UI.money(report.netProfit)}</div></div>
      </div>
      ${UI.card(`
        <div class="p-4 grid grid-cols-1 md:grid-cols-3 gap-3 border-b border-slate-100">
          <select class="field mt-0" id="exp-cat">
            <option value="all">All categories</option>
            ${Finance.EXPENSE_CATEGORIES.map((c) => `<option ${category === c ? "selected" : ""}>${c}</option>`).join("")}
          </select>
          <input type="date" class="field mt-0" id="exp-from" value="${from}" />
          <input type="date" class="field mt-0" id="exp-to" value="${to}" />
        </div>
        ${
          list.length
            ? `<div class="table-wrap"><table class="data-table">
          <thead><tr><th>Date</th><th>Title</th><th>Category</th><th>Amount</th><th></th></tr></thead>
          <tbody>
            ${list
              .map(
                (e) => `<tr>
              <td>${Utils.formatDate(e.date)}</td>
              <td class="font-semibold">${Utils.escapeHtml(e.title)}<div class="text-xs font-normal text-slate-400">${Utils.escapeHtml(e.description || "")}</div></td>
              <td>${Utils.escapeHtml(e.category)}</td>
              <td class="text-rose-600 font-semibold">${UI.money(e.amount)}</td>
              <td class="whitespace-nowrap">
                <button class="btn-ghost edit-e" data-id="${e.id}">${UI.icon("pencil", 16)}</button>
                <button class="btn-ghost text-rose-600 del-e" data-id="${e.id}">${UI.icon("trash-2", 16)}</button>
              </td>
            </tr>`
              )
              .join("")}
          </tbody>
        </table></div>`
            : UI.empty("No expenses", "Record rent, bills and other operating costs here.", "wallet")
        }
      `)}
    `;
    view.querySelector("#add-exp").onclick = () => openForm();
    view.querySelector("#exp-cat").onchange = (e) => {
      category = e.target.value;
      render();
    };
    view.querySelector("#exp-from").onchange = (e) => {
      from = e.target.value;
      render();
    };
    view.querySelector("#exp-to").onchange = (e) => {
      to = e.target.value;
      render();
    };
    view.querySelectorAll(".edit-e").forEach((b) => {
      b.onclick = () => openForm(state.expenses.find((e) => e.id === b.dataset.id));
    });
    view.querySelectorAll(".del-e").forEach((b) => {
      b.onclick = async () => {
        const ok = await UI.confirm({ title: "Delete expense?", message: "This cannot be undone.", danger: true, confirmText: "Delete" });
        if (!ok) return;
        Store.remove("expenses", b.dataset.id);
        UI.toast("Expense deleted");
        render();
      };
    });
    UI.refreshIcons();
  }

  return { render };
})();
