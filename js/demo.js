const Demo = (() => {
  function seedIfNeeded() {
    const state = Store.getState();
    if (!Store.wasFirstBoot()) return false;
    if (state.settings.demoDataLoaded || state.products.length) return false;
    seed();
    return true;
  }

  function seed() {
    Store.update((state) => {
      const now = new Date();
      const daysAgo = (n) => {
        const d = new Date(now);
        d.setDate(d.getDate() - n);
        return d.toISOString();
      };

      state.categories = [
        { id: "cat_writing", name: "Writing" },
        { id: "cat_paper", name: "Paper & Books" },
        { id: "cat_art", name: "Art & Craft" },
        { id: "cat_office", name: "Office Supplies" },
      ];

      const defs = [
        { id: "prd_pencil", name: "Pencil", cat: "cat_writing", unit: "piece", sell: 20, min: 20, desc: "HB wooden pencil" },
        { id: "prd_pen", name: "Ball Pen", cat: "cat_writing", unit: "piece", sell: 25, min: 20, desc: "Blue ballpoint pen" },
        { id: "prd_notebook", name: "Notebook", cat: "cat_paper", unit: "piece", sell: 80, min: 10, desc: "A4 lined notebook 200 pages" },
        { id: "prd_eraser", name: "Eraser", cat: "cat_writing", unit: "piece", sell: 15, min: 15, desc: "Soft white eraser" },
        { id: "prd_sharpener", name: "Sharpener", cat: "cat_writing", unit: "piece", sell: 18, min: 15, desc: "Metal blade sharpener" },
        { id: "prd_scale", name: "Scale", cat: "cat_office", unit: "piece", sell: 30, min: 10, desc: "12 inch plastic ruler" },
        { id: "prd_marker", name: "Marker", cat: "cat_writing", unit: "piece", sell: 45, min: 10, desc: "Permanent black marker" },
        { id: "prd_register", name: "Register", cat: "cat_paper", unit: "piece", sell: 220, min: 5, desc: "Hard cover register" },
        { id: "prd_colors", name: "Color Pencils", cat: "cat_art", unit: "packet", sell: 150, min: 8, desc: "12-color pencil pack" },
        { id: "prd_glue", name: "Glue Stick", cat: "cat_art", unit: "piece", sell: 40, min: 10, desc: "8g glue stick" },
      ];

      state.products = defs.map((d, i) => ({
        id: d.id,
        name: d.name,
        sku: `STA-${String(i + 1).padStart(4, "0")}`,
        categoryId: d.cat,
        unit: d.unit,
        sellingPrice: d.sell,
        currentStock: 0,
        minStock: d.min,
        description: d.desc,
        isDemo: true,
        createdAt: daysAgo(20),
      }));

      const purchases = [
        { productId: "prd_pencil", qty: 12, cost: 120, days: 18, supplier: "Ali Traders" },
        { productId: "prd_pencil", qty: 50, cost: 400, days: 8, supplier: "Ali Traders" },
        { productId: "prd_pen", qty: 40, cost: 400, days: 16, supplier: "City Wholesale" },
        { productId: "prd_notebook", qty: 30, cost: 1500, days: 14, supplier: "Paper House" },
        { productId: "prd_eraser", qty: 40, cost: 200, days: 12, supplier: "Ali Traders" },
        { productId: "prd_sharpener", qty: 30, cost: 210, days: 12, supplier: "Ali Traders" },
        { productId: "prd_scale", qty: 25, cost: 375, days: 10, supplier: "Office Mart" },
        { productId: "prd_marker", qty: 20, cost: 500, days: 9, supplier: "City Wholesale" },
        { productId: "prd_register", qty: 15, cost: 2250, days: 7, supplier: "Paper House" },
        { productId: "prd_colors", qty: 18, cost: 1620, days: 6, supplier: "Art Hub" },
        { productId: "prd_glue", qty: 24, cost: 480, days: 5, supplier: "Art Hub" },
      ];

      purchases.forEach((p) => {
        Finance.createPurchase(state, {
          productId: p.productId,
          quantity: p.qty,
          totalCost: p.cost,
          date: daysAgo(p.days).slice(0, 10),
          supplierName: p.supplier,
          paymentStatus: "Paid",
        });
      });

      const walkInSales = [
        {
          days: 4,
          items: [
            { productId: "prd_pencil", qty: 3, unitPrice: 20 },
            { productId: "prd_eraser", qty: 2, unitPrice: 15 },
          ],
          method: "Cash",
          name: "Walk-in",
        },
        {
          days: 3,
          items: [
            { productId: "prd_notebook", qty: 2, unitPrice: 80 },
            { productId: "prd_pen", qty: 4, unitPrice: 25 },
          ],
          method: "Online",
          name: "Ahmed Khan",
          phone: "0301-1112233",
        },
        {
          days: 2,
          items: [{ productId: "prd_register", qty: 1, unitPrice: 220 }],
          method: "Credit",
          amountPaid: 0,
          name: "School Mart",
          phone: "0321-5557788",
        },
        {
          days: 1,
          items: [
            { productId: "prd_colors", qty: 1, unitPrice: 150 },
            { productId: "prd_glue", qty: 2, unitPrice: 40 },
          ],
          method: "Partial",
          amountPaid: 100,
          name: "Fatima",
          phone: "0333-4445566",
        },
        {
          days: 0,
          items: [
            { productId: "prd_pencil", qty: 5, unitPrice: 20 },
            { productId: "prd_pen", qty: 3, unitPrice: 25 },
            { productId: "prd_scale", qty: 1, unitPrice: 30 },
          ],
          method: "Cash",
          name: "Walk-in",
        },
        {
          days: 0,
          items: [{ productId: "prd_marker", qty: 2, unitPrice: 45 }],
          method: "Cash",
          name: "Walk-in",
        },
      ];

      walkInSales.forEach((s) => {
        Finance.completeSale(state, {
          items: s.items,
          discount: 0,
          paymentMethod: s.method,
          amountPaid: s.amountPaid,
          customerName: s.name,
          customerPhone: s.phone || "",
          date: daysAgo(s.days),
        });
      });

      state.expenses = [
        {
          id: Utils.uid("exp"),
          title: "Shop electricity",
          category: "Electricity Bill",
          amount: 3500,
          date: daysAgo(2).slice(0, 10),
          description: "Monthly bill",
          isDemo: true,
        },
        {
          id: Utils.uid("exp"),
          title: "Delivery rickshaw",
          category: "Transportation",
          amount: 400,
          date: Utils.todayISO(),
          description: "Stock pickup",
          isDemo: true,
        },
      ];

      state.settings.demoDataLoaded = true;
    });
  }

  function removeDemo() {
    Store.update((state) => {
      const demoProductIds = new Set(state.products.filter((p) => p.isDemo).map((p) => p.id));
      state.products = state.products.filter((p) => !p.isDemo);
      state.purchases = state.purchases.filter((p) => !demoProductIds.has(p.productId));
      state.purchaseBatches = state.purchaseBatches.filter((b) => !demoProductIds.has(b.productId));
      state.sales = state.sales.filter((s) => !s.items.some((i) => demoProductIds.has(i.productId)));
      state.stockMovements = state.stockMovements.filter((m) => !demoProductIds.has(m.productId));
      state.expenses = state.expenses.filter((e) => !e.isDemo);
      state.products.forEach((p) => Finance.syncProductStock(state, p.id));
      state.settings.demoDataLoaded = false;
    });
  }

  return { seedIfNeeded, seed, removeDemo };
})();
