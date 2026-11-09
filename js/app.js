const App = (() => {
  const routes = {
    "/dashboard": { title: "Dashboard", page: DashboardPage, icon: "layout-dashboard" },
    "/pos": { title: "POS / New Sale", page: POSPage, icon: "shopping-cart" },
    "/products": { title: "Products", page: ProductsPage, icon: "package" },
    "/purchases": { title: "Purchases", page: PurchasesPage, icon: "truck" },
    "/sales": { title: "Sales History", page: SalesPage, icon: "receipt-text" },
    "/inventory": { title: "Inventory", page: InventoryPage, icon: "warehouse" },
    "/customers": { title: "Customers", page: CustomersPage, icon: "users" },
    "/expenses": { title: "Expenses", page: ExpensesPage, icon: "wallet" },
    "/reports": { title: "Reports", page: ReportsPage, icon: "chart-column" },
    "/settings": { title: "Settings", page: SettingsPage, icon: "settings" },
  };

  function path() {
    const hash = location.hash.replace("#", "") || "/dashboard";
    return routes[hash] ? hash : "/dashboard";
  }

  function refreshChrome() {
    const settings = Store.settings();
    const shop = document.getElementById("shop-brand");
    if (shop) {
      shop.textContent = settings.shopName || "Zaro Stationery";
    }
    highlightNav();
  }

  function highlightNav() {
    const current = path();
    document.querySelectorAll(".sidebar-link").forEach((link) => {
      link.classList.toggle("active", link.getAttribute("href") === `#${current}`);
    });
  }

  function renderNav() {
    const nav = document.getElementById("sidebar-nav");
    const groups = [
      { label: "Sell", items: ["/dashboard", "/pos", "/sales"] },
      { label: "Stock", items: ["/products", "/purchases", "/inventory"] },
      { label: "Finance", items: ["/customers", "/expenses", "/reports"] },
      { label: "System", items: ["/settings"] },
    ];
    nav.innerHTML = groups
      .map(
        (g) => `
        <p class="px-3 mt-5 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">${g.label}</p>
        ${g.items
          .map((key) => {
            const r = routes[key];
            return `<a class="sidebar-link" href="#${key}">${UI.icon(r.icon, 18)}<span>${r.title}</span></a>`;
          })
          .join("")}
      `
      )
      .join("");
  }

  function route() {
    const current = path();
    if (location.hash !== `#${current}`) {
      location.hash = `#${current}`;
      return;
    }
    highlightNav();
    document.getElementById("top-title").textContent = routes[current].title;
    try {
      routes[current].page.render();
    } catch (err) {
      console.error(err);
      document.getElementById("view").innerHTML = `
        <div class="bg-white rounded-2xl p-10 text-center">
          <p class="font-semibold">Something went wrong</p>
          <p class="text-sm text-slate-500 mt-2">${Utils.escapeHtml(err.message)}</p>
        </div>`;
    }
    UI.refreshIcons();
    closeMobile();
  }

  function closeMobile() {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("sidebar-backdrop").classList.add("hidden");
  }

  function openMobile() {
    document.getElementById("sidebar").classList.add("open");
    document.getElementById("sidebar-backdrop").classList.remove("hidden");
  }

  function init() {
    Demo.seedIfNeeded();
    renderNav();
    refreshChrome();
    window.addEventListener("hashchange", route);
    document.getElementById("menu-btn").onclick = openMobile;
    document.getElementById("sidebar-backdrop").onclick = closeMobile;
    document.getElementById("quick-sale").onclick = () => {
      location.hash = "#/pos";
    };
    route();
    UI.refreshIcons();
  }

  return { init, refreshChrome, path };
})();

document.addEventListener("DOMContentLoaded", App.init);
