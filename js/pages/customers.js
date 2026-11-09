const CustomersPage = (() => {
  let query = "";

  function openForm(existing) {
    UI.modal({
      title: existing ? "Edit customer" : "Add customer",
      width: "max-w-lg",
      body: `
        <form id="cus-form" class="grid gap-4">
          ${UI.input("name", "Customer name", { value: existing?.name || "", required: true })}
          ${UI.input("phone", "Phone number", { value: existing?.phone || "" })}
          ${UI.input("address", "Address (optional)", { type: "textarea", value: existing?.address || "" })}
        </form>
      `,
      footer: `<button class="btn-secondary" data-close="1">Cancel</button><button class="btn-primary" id="save-cus">Save</button>`,
      onOpen: () => {
        document.getElementById("save-cus").onclick = () => {
          const form = document.getElementById("cus-form");
          if (!form.reportValidity()) return;
          const data = UI.formToObject(form);
          if (existing) Store.patch("customers", existing.id, data);
          else {
            Store.insert("customers", {
              id: Utils.uid("cus"),
              ...data,
              totalPurchases: 0,
              totalPaid: 0,
              outstanding: 0,
              createdAt: Utils.nowISO(),
            });
          }
          UI.closeModal();
          UI.toast("Customer saved");
          render();
        };
      },
    });
  }

  function pay(customer) {
    UI.modal({
      title: `Record payment · ${customer.name}`,
      width: "max-w-md",
      body: `
        <p class="text-sm text-slate-500 mb-3">Outstanding: <strong>${UI.money(customer.outstanding)}</strong></p>
        <form id="pay-form" class="grid gap-4">
          ${UI.input("amount", "Amount received", { type: "number", min: "0.01", step: "0.01", required: true, max: customer.outstanding })}
          ${UI.input("method", "Method", { type: "select", options: ["Cash", "Online"] })}
          ${UI.input("date", "Date", { type: "date", value: Utils.todayISO() })}
          ${UI.input("notes", "Notes", { type: "textarea", rows: 2 })}
        </form>
      `,
      footer: `<button class="btn-secondary" data-close="1">Cancel</button><button class="btn-primary" id="save-pay">Record payment</button>`,
      onOpen: () => {
        document.getElementById("save-pay").onclick = () => {
          const form = document.getElementById("pay-form");
          if (!form.reportValidity()) return;
          const data = UI.formToObject(form);
          try {
            Store.update((state) => {
              Finance.recordCustomerPayment(state, {
                customerId: customer.id,
                amount: Number(data.amount),
                method: data.method,
                date: data.date,
                notes: data.notes,
              });
            });
            UI.closeModal();
            UI.toast("Payment recorded");
            render();
          } catch (err) {
            UI.toast(err.message, "error");
          }
        };
      },
    });
  }

  function history(customer) {
    const state = Store.getState();
    const sales = state.sales.filter((s) => s.customerId === customer.id);
    const pays = state.customerPayments.filter((p) => p.customerId === customer.id);
    UI.modal({
      title: customer.name,
      body: `
        <div class="grid grid-cols-3 gap-3 mb-4 text-sm">
          <div class="rounded-xl bg-slate-50 p-3">Purchases<br><strong>${UI.money(customer.totalPurchases)}</strong></div>
          <div class="rounded-xl bg-emerald-50 p-3">Paid<br><strong>${UI.money(customer.totalPaid)}</strong></div>
          <div class="rounded-xl bg-rose-50 p-3">Udhaar<br><strong>${UI.money(customer.outstanding)}</strong></div>
        </div>
        <h4 class="font-semibold mb-2">Sales</h4>
        ${
          sales.length
            ? `<div class="table-wrap mb-4"><table class="data-table"><thead><tr><th>Invoice</th><th>Total</th><th>Paid</th><th>Due</th></tr></thead><tbody>
            ${sales
              .map(
                (s) =>
                  `<tr><td>${s.invoiceNo}<div class="text-xs text-slate-400">${Utils.formatDate(s.date)}</div></td><td>${UI.money(
                    s.grandTotal
                  )}</td><td>${UI.money(s.amountPaid)}</td><td>${UI.money(s.balanceDue)}</td></tr>`
              )
              .join("")}
          </tbody></table></div>`
            : `<p class="text-sm text-slate-500 mb-4">No sales yet.</p>`
        }
        <h4 class="font-semibold mb-2">Payments</h4>
        ${
          pays.length
            ? `<div class="space-y-2">${pays
                .map(
                  (p) =>
                    `<div class="text-sm flex justify-between border border-slate-100 rounded-xl px-3 py-2"><span>${Utils.formatDate(
                      p.date
                    )} · ${p.type}</span><strong>${UI.money(p.amount)}</strong></div>`
                )
                .join("")}</div>`
            : `<p class="text-sm text-slate-500">No payments recorded.</p>`
        }
      `,
      footer: `
        <button class="btn-secondary" data-close="1">Close</button>
        <button class="btn-secondary" id="print-st">${UI.icon("printer", 16)} Statement</button>
        ${customer.outstanding > 0 ? `<button class="btn-primary" id="pay-now">Record payment</button>` : ""}
      `,
      onOpen: (root) => {
        root.querySelector("#print-st").onclick = () => UI.printHtml(UI.customerStatement(customer, Store.getState()));
        const payBtn = root.querySelector("#pay-now");
        if (payBtn) payBtn.onclick = () => pay(customer);
      },
    });
  }

  function render() {
    const state = Store.getState();
    const list = state.customers.filter(
      (c) => Utils.searchMatch(c.name, query) || Utils.searchMatch(c.phone, query)
    );
    const udhaar = list.reduce((s, c) => s + Number(c.outstanding), 0);
    const view = document.getElementById("view");
    view.innerHTML = `
      ${UI.pageHeader({
        title: "Customers & Udhaar",
        subtitle: "Credit sales increase outstanding. Payments reduce it. Credit is never counted as cash.",
        actions: `<button class="btn-primary" id="add-cus">${UI.icon("user-plus", 16)} Add customer</button>`,
      })}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div class="kpi"><div class="kpi-label">Customers</div><div class="kpi-value">${list.length}</div></div>
        <div class="kpi"><div class="kpi-label">Total outstanding udhaar</div><div class="kpi-value text-rose-600">${UI.money(udhaar)}</div></div>
        <div class="kpi"><div class="kpi-label">Total collected</div><div class="kpi-value text-emerald-600">${UI.money(
          list.reduce((s, c) => s + Number(c.totalPaid), 0)
        )}</div></div>
      </div>
      ${UI.card(`
        <div class="p-4 border-b border-slate-100">
          <input class="field mt-0" id="cus-q" placeholder="Search name or phone" value="${Utils.escapeHtml(query)}" />
        </div>
        ${
          list.length
            ? `<div class="table-wrap"><table class="data-table">
          <thead><tr><th>Customer</th><th>Purchases</th><th>Paid</th><th>Outstanding</th><th></th></tr></thead>
          <tbody>
            ${list
              .map(
                (c) => `<tr>
              <td class="font-semibold">${Utils.escapeHtml(c.name)}<div class="text-xs font-normal text-slate-400">${Utils.escapeHtml(
                  c.phone || ""
                )}</div></td>
              <td>${UI.money(c.totalPurchases)}</td>
              <td>${UI.money(c.totalPaid)}</td>
              <td class="${c.outstanding > 0 ? "text-rose-600 font-semibold" : ""}">${UI.money(c.outstanding)}</td>
              <td class="whitespace-nowrap">
                <button class="btn-secondary hist" data-id="${c.id}">History</button>
                <button class="btn-ghost edit-c" data-id="${c.id}">${UI.icon("pencil", 16)}</button>
              </td>
            </tr>`
              )
              .join("")}
          </tbody>
        </table></div>`
            : UI.empty("No customers yet", "Customers are also created automatically from credit sales.", "users")
        }
      `)}
    `;
    view.querySelector("#add-cus").onclick = () => openForm();
    view.querySelector("#cus-q").oninput = Utils.debounce((e) => {
      query = e.target.value;
      render();
    }, 180);
    view.querySelectorAll(".edit-c").forEach((b) => {
      b.onclick = () => openForm(state.customers.find((c) => c.id === b.dataset.id));
    });
    view.querySelectorAll(".hist").forEach((b) => {
      b.onclick = () => history(state.customers.find((c) => c.id === b.dataset.id));
    });
    UI.refreshIcons();
  }

  return { render };
})();
