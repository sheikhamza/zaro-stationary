const SettingsPage = (() => {
  function render() {
    const s = Store.settings();
    const view = document.getElementById("view");
    view.innerHTML = `
      ${UI.pageHeader({
        title: "Settings",
        subtitle: "Shop profile, receipts and data backups",
      })}
      <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div class="xl:col-span-2">${UI.card(`
          <div class="px-5 py-4 border-b border-slate-100"><h2 class="font-semibold">Shop details</h2></div>
          <form id="set-form" class="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            ${UI.input("shopName", "Shop name", { value: s.shopName, required: true })}
            ${UI.input("shopPhone", "Shop phone", { value: s.shopPhone })}
            <div class="md:col-span-2">${UI.input("shopAddress", "Shop address", { value: s.shopAddress })}</div>
            ${UI.input("currency", "Currency code", { value: s.currency })}
            ${UI.input("currencySymbol", "Currency symbol", { value: s.currencySymbol })}
            ${UI.input("lowStockDefault", "Default low-stock threshold", { type: "number", min: "0", value: s.lowStockDefault })}
            <div class="md:col-span-2">${UI.input("receiptFooter", "Receipt footer / thank you message", { type: "textarea", value: s.receiptFooter })}</div>
            <div class="md:col-span-2"><button class="btn-primary" type="submit">${UI.icon("save", 16)} Save settings</button></div>
          </form>
        `)}</div>
        <div class="space-y-4">
          ${UI.card(`
            <div class="px-5 py-4 border-b border-slate-100"><h2 class="font-semibold">Data management</h2></div>
            <div class="p-5 space-y-3">
              <button class="btn-secondary w-full" id="export-json">${UI.icon("download", 16)} Export JSON backup</button>
              <label class="btn-secondary w-full cursor-pointer">
                ${UI.icon("upload", 16)} Import JSON backup
                <input type="file" accept="application/json" class="hidden" id="import-json" />
              </label>
              <button class="btn-secondary w-full" id="load-demo">${UI.icon("sparkles", 16)} Load demo data</button>
              <button class="btn-secondary w-full" id="remove-demo">${UI.icon("eraser", 16)} Remove demo data</button>
              <button class="btn-danger w-full" id="reset-all">${UI.icon("trash-2", 16)} Reset all data</button>
              <p class="text-xs text-slate-500">Schema version ${Store.SCHEMA_VERSION}. Data stays in this browser only.</p>
            </div>
          `)}
        </div>
      </div>
    `;
    view.querySelector("#set-form").onsubmit = (e) => {
      e.preventDefault();
      const data = UI.formToObject(e.target);
      Store.saveSettings({
        shopName: data.shopName,
        shopPhone: data.shopPhone,
        shopAddress: data.shopAddress,
        currency: data.currency,
        currencySymbol: data.currencySymbol,
        lowStockDefault: Number(data.lowStockDefault || 0),
        receiptFooter: data.receiptFooter,
      });
      UI.toast("Settings saved");
      App.refreshChrome();
    };
    view.querySelector("#export-json").onclick = () => {
      Utils.downloadFile(`zaro-stationery-backup-${Utils.todayISO()}.json`, Store.exportJSON());
      UI.toast("Backup downloaded");
    };
    view.querySelector("#import-json").onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        Store.importJSON(text);
        UI.toast("Backup imported");
        App.refreshChrome();
        render();
      } catch (err) {
        UI.toast(err.message || "Invalid backup file", "error");
      }
    };
    view.querySelector("#load-demo").onclick = () => {
      Demo.seed();
      UI.toast("Demo data loaded");
      App.refreshChrome();
      render();
    };
    view.querySelector("#remove-demo").onclick = async () => {
      const ok = await UI.confirm({
        title: "Remove demo data?",
        message: "Sample products, related purchases/sales and demo expenses will be removed.",
        danger: true,
        confirmText: "Remove demo",
      });
      if (!ok) return;
      Demo.removeDemo();
      UI.toast("Demo data removed");
      render();
    };
    view.querySelector("#reset-all").onclick = async () => {
      const ok = await UI.confirm({
        title: "Reset all data?",
        message: "This permanently deletes products, sales, purchases, customers and settings in this browser.",
        danger: true,
        confirmText: "Reset everything",
      });
      if (!ok) return;
      Store.reset();
      UI.toast("Application reset");
      App.refreshChrome();
      render();
    };
    UI.refreshIcons();
  }

  return { render };
})();
