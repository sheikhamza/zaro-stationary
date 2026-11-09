const Finance = (() => {
  const PAYMENT_METHODS = ["Cash", "Online", "Partial", "Credit"];
  const PURCHASE_PAYMENT = ["Paid", "Partial", "Unpaid"];
  const UNITS = ["piece", "packet", "box", "dozen", "kg", "ream", "set", "roll"];
  const EXPENSE_CATEGORIES = [
    "Electricity Bill",
    "Shop Rent",
    "Transportation",
    "Employee Salary",
    "Packaging",
    "Maintenance",
    "Other Expenses",
  ];

  function money(n) {
    return Utils.roundMoney(n);
  }

  function productStock(state, productId) {
    return (state.purchaseBatches || [])
      .filter((b) => b.productId === productId)
      .reduce((sum, b) => sum + (Number(b.qtyRemaining) || 0), 0);
  }

  function syncProductStock(state, productId) {
    const product = state.products.find((p) => p.id === productId);
    if (!product) return 0;
    product.currentStock = money(productStock(state, productId));
    product.updatedAt = Utils.nowISO();
    return product.currentStock;
  }

  function activeBatches(state, productId) {
    return (state.purchaseBatches || [])
      .filter((b) => b.productId === productId && Number(b.qtyRemaining) > 0)
      .sort((a, b) => {
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        if (da !== db) return da - db;
        return String(a.id).localeCompare(String(b.id));
      });
  }

  function displayPurchaseCost(state, productId) {
    const batches = activeBatches(state, productId);
    if (!batches.length) {
      const last = (state.purchaseBatches || [])
        .filter((b) => b.productId === productId)
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      return last ? money(last.costPerUnit) : 0;
    }
    const qty = batches.reduce((s, b) => s + Number(b.qtyRemaining), 0);
    const value = batches.reduce((s, b) => s + Number(b.qtyRemaining) * Number(b.costPerUnit), 0);
    return qty ? money(value / qty) : 0;
  }

  function inventoryValueForProduct(state, productId) {
    return money(
      (state.purchaseBatches || [])
        .filter((b) => b.productId === productId)
        .reduce((sum, b) => sum + Number(b.qtyRemaining || 0) * Number(b.costPerUnit || 0), 0)
    );
  }

  function consumeFIFO(state, productId, qty) {
    let remaining = money(qty);
    const allocations = [];
    if (remaining <= 0) return { allocations, totalCost: 0 };

    const batches = activeBatches(state, productId);
    for (const batch of batches) {
      if (remaining <= 0) break;
      const take = Math.min(Number(batch.qtyRemaining), remaining);
      batch.qtyRemaining = money(batch.qtyRemaining - take);
      remaining = money(remaining - take);
      allocations.push({
        batchId: batch.id,
        qty: take,
        costPerUnit: money(batch.costPerUnit),
        cost: money(take * batch.costPerUnit),
      });
    }

    if (remaining > 0) {
      throw new Error("Insufficient stock to complete this operation.");
    }

    const totalCost = money(allocations.reduce((s, a) => s + a.cost, 0));
    syncProductStock(state, productId);
    return { allocations, totalCost };
  }

  function restoreFIFO(state, allocations) {
    (allocations || []).forEach((alloc) => {
      const batch = state.purchaseBatches.find((b) => b.id === alloc.batchId);
      if (batch) {
        batch.qtyRemaining = money(Number(batch.qtyRemaining) + Number(alloc.qty));
        syncProductStock(state, batch.productId);
      } else if (alloc.productId) {
        state.purchaseBatches.push({
          id: Utils.uid("bat"),
          productId: alloc.productId,
          purchaseId: null,
          qtyOriginal: alloc.qty,
          qtyRemaining: alloc.qty,
          costPerUnit: alloc.costPerUnit,
          date: Utils.nowISO(),
          source: "void_restore",
        });
        syncProductStock(state, alloc.productId);
      }
    });
  }

  function addBatch(state, { productId, purchaseId, qty, costPerUnit, date, source = "purchase" }) {
    const batch = {
      id: Utils.uid("bat"),
      productId,
      purchaseId: purchaseId || null,
      qtyOriginal: money(qty),
      qtyRemaining: money(qty),
      costPerUnit: money(costPerUnit),
      date: date || Utils.nowISO(),
      source,
    };
    state.purchaseBatches.push(batch);
    syncProductStock(state, productId);
    return batch;
  }

  function recordMovement(state, movement) {
    state.stockMovements.push({
      id: Utils.uid("mov"),
      date: movement.date || Utils.nowISO(),
      productId: movement.productId,
      type: movement.type,
      qtyChange: money(movement.qtyChange),
      reason: movement.reason || "",
      refId: movement.refId || null,
      costImpact: money(movement.costImpact || 0),
    });
  }

  function nextSku(state) {
    return Utils.nextSequence(state.products, "sku", "STA-");
  }

  function nextInvoice(state) {
    return Utils.nextSequence(state.sales, "invoiceNo", "INV-");
  }

  function upsertCustomer(state, { id, name, phone, address }) {
    if (id) {
      const existing = state.customers.find((c) => c.id === id);
      if (existing) {
        if (name) existing.name = name;
        if (phone) existing.phone = phone;
        if (address !== undefined) existing.address = address;
        return existing;
      }
    }
    if (!name) return null;
    const byPhone = phone ? state.customers.find((c) => c.phone && c.phone === phone) : null;
    if (byPhone) {
      byPhone.name = name;
      return byPhone;
    }
    const customer = {
      id: Utils.uid("cus"),
      name,
      phone: phone || "",
      address: address || "",
      totalPurchases: 0,
      totalPaid: 0,
      outstanding: 0,
      createdAt: Utils.nowISO(),
    };
    state.customers.push(customer);
    return customer;
  }

  function applyCustomerSale(state, customer, sale) {
    if (!customer) return;
    customer.totalPurchases = money(Number(customer.totalPurchases) + Number(sale.grandTotal));
    customer.totalPaid = money(Number(customer.totalPaid) + Number(sale.amountPaid));
    customer.outstanding = money(Number(customer.outstanding) + Number(sale.balanceDue));
    state.customerPayments.push({
      id: Utils.uid("pay"),
      customerId: customer.id,
      saleId: sale.id,
      amount: money(sale.grandTotal),
      paid: money(sale.amountPaid),
      date: sale.date,
      method: sale.paymentMethod,
      type: "sale",
      notes: `Invoice ${sale.invoiceNo}`,
    });
  }

  function reverseCustomerSale(state, sale) {
    if (!sale.customerId) return;
    const customer = state.customers.find((c) => c.id === sale.customerId);
    if (!customer) return;
    customer.totalPurchases = money(Math.max(0, Number(customer.totalPurchases) - Number(sale.grandTotal)));
    customer.totalPaid = money(Math.max(0, Number(customer.totalPaid) - Number(sale.amountPaid)));
    customer.outstanding = money(Math.max(0, Number(customer.outstanding) - Number(sale.balanceDue)));
    state.customerPayments.push({
      id: Utils.uid("pay"),
      customerId: customer.id,
      saleId: sale.id,
      amount: money(-sale.grandTotal),
      paid: money(-sale.amountPaid),
      date: Utils.nowISO(),
      method: sale.paymentMethod,
      type: "void",
      notes: `Voided invoice ${sale.invoiceNo}`,
    });
  }

  function recordCustomerPayment(state, { customerId, amount, date, method, notes }) {
    const customer = state.customers.find((c) => c.id === customerId);
    if (!customer) throw new Error("Customer not found");
    const pay = money(amount);
    if (pay <= 0) throw new Error("Payment must be greater than zero");
    if (pay > money(customer.outstanding + 0.001)) {
      throw new Error("Payment cannot exceed outstanding balance");
    }
    customer.totalPaid = money(Number(customer.totalPaid) + pay);
    customer.outstanding = money(Number(customer.outstanding) - pay);
    const payment = {
      id: Utils.uid("pay"),
      customerId,
      saleId: null,
      amount: pay,
      paid: pay,
      date: date || Utils.nowISO(),
      method: method || "Cash",
      type: "payment",
      notes: notes || "Udhaar payment",
    };
    state.customerPayments.push(payment);
    applyPaymentToOpenSales(state, customerId, pay);
    return payment;
  }

  function applyPaymentToOpenSales(state, customerId, amount) {
    let remaining = money(amount);
    const open = state.sales
      .filter((s) => s.customerId === customerId && s.status === "completed" && Number(s.balanceDue) > 0)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    open.forEach((sale) => {
      if (remaining <= 0) return;
      const take = Math.min(Number(sale.balanceDue), remaining);
      sale.amountPaid = money(Number(sale.amountPaid) + take);
      sale.balanceDue = money(Number(sale.balanceDue) - take);
      remaining = money(remaining - take);
      if (sale.balanceDue <= 0) {
        sale.paymentStatus = "Paid";
        if (sale.paymentMethod === "Credit" || sale.paymentMethod === "Partial") {
          sale.paymentMethod = sale.paymentMethod;
        }
      } else {
        sale.paymentStatus = "Partial";
      }
    });
  }

  function completeSale(state, payload) {
    const items = [];
    let subtotal = 0;
    let costTotal = 0;
    const saleId = Utils.uid("sal");

    payload.items.forEach((line) => {
      const product = state.products.find((p) => p.id === line.productId);
      if (!product) throw new Error("Product not found");
      const qty = money(line.qty);
      if (qty <= 0) throw new Error(`Invalid quantity for ${product.name}`);
      if (qty > Number(product.currentStock)) {
        throw new Error(`Not enough stock for ${product.name}. Available: ${product.currentStock}`);
      }
      const unitPrice = money(line.unitPrice);
      const { allocations, totalCost } = consumeFIFO(state, product.id, qty);
      const lineTotal = money(qty * unitPrice);
      const profit = money(lineTotal - totalCost);
      items.push({
        productId: product.id,
        name: product.name,
        sku: product.sku,
        unit: product.unit,
        qty,
        unitPrice,
        lineTotal,
        fifoCost: totalCost,
        profit,
        batchAllocations: allocations,
      });
      subtotal = money(subtotal + lineTotal);
      costTotal = money(costTotal + totalCost);
      recordMovement(state, {
        productId: product.id,
        type: "sale",
        qtyChange: -qty,
        reason: "POS sale",
        refId: saleId,
        costImpact: -totalCost,
      });
    });

    const discount = money(payload.discount || 0);
    if (discount < 0) throw new Error("Discount cannot be negative");
    if (discount > subtotal) throw new Error("Discount cannot exceed subtotal");
    const grandTotal = money(subtotal - discount);
    const grossProfit = money(subtotal - costTotal - discount);

    let amountPaid = money(payload.amountPaid ?? 0);
    const method = payload.paymentMethod || "Cash";
    if (method === "Cash" || method === "Online") {
      amountPaid = grandTotal;
    } else if (method === "Credit") {
      amountPaid = money(payload.amountPaid || 0);
      if (amountPaid > grandTotal) amountPaid = grandTotal;
    } else if (method === "Partial") {
      if (amountPaid <= 0) throw new Error("Enter the amount received for a partial payment");
      if (amountPaid >= grandTotal) amountPaid = grandTotal;
    }
    const balanceDue = money(grandTotal - amountPaid);
    if ((method === "Credit" || method === "Partial") && balanceDue > 0 && !payload.customerName && !payload.customerId) {
      throw new Error("Customer name is required for credit or partial payment");
    }

    const customer = upsertCustomer(state, {
      id: payload.customerId,
      name: payload.customerName,
      phone: payload.customerPhone,
      address: payload.customerAddress,
    });

    const sale = {
      id: saleId,
      invoiceNo: nextInvoice(state),
      date: payload.date || Utils.nowISO(),
      customerId: customer?.id || null,
      customerName: customer?.name || payload.customerName || "Walk-in",
      customerPhone: customer?.phone || payload.customerPhone || "",
      items,
      subtotal,
      discount,
      grandTotal,
      costTotal,
      grossProfit,
      paymentMethod: method,
      amountPaid,
      balanceDue,
      paymentStatus: balanceDue <= 0 ? "Paid" : amountPaid > 0 ? "Partial" : "Unpaid",
      status: "completed",
      notes: payload.notes || "",
      cashReceived: method === "Credit" ? 0 : amountPaid,
    };
    state.sales.push(sale);
    applyCustomerSale(state, customer, sale);
    return sale;
  }

  function voidSale(state, saleId) {
    const sale = state.sales.find((s) => s.id === saleId);
    if (!sale) throw new Error("Sale not found");
    if (sale.status === "voided") throw new Error("This sale is already cancelled");
    sale.items.forEach((item) => {
      restoreFIFO(state, item.batchAllocations.map((a) => ({ ...a, productId: item.productId })));
      recordMovement(state, {
        productId: item.productId,
        type: "void_restore",
        qtyChange: item.qty,
        reason: `Void ${sale.invoiceNo}`,
        refId: sale.id,
        costImpact: item.fifoCost,
      });
    });
    reverseCustomerSale(state, sale);
    sale.status = "voided";
    sale.voidedAt = Utils.nowISO();
    return sale;
  }

  function createPurchase(state, payload) {
    const product = state.products.find((p) => p.id === payload.productId);
    if (!product) throw new Error("Select a product");
    const qty = money(payload.quantity);
    const totalCost = money(payload.totalCost);
    if (qty <= 0) throw new Error("Quantity must be greater than zero");
    if (totalCost < 0) throw new Error("Total cost cannot be negative");
    const costPerUnit = money(totalCost / qty);
    const purchase = {
      id: Utils.uid("pur"),
      productId: product.id,
      productName: product.name,
      quantity: qty,
      totalCost,
      costPerUnit,
      date: payload.date || Utils.todayISO(),
      supplierName: payload.supplierName || "",
      paymentStatus: payload.paymentStatus || "Paid",
      amountPaid:
        payload.paymentStatus === "Paid"
          ? totalCost
          : payload.paymentStatus === "Unpaid"
            ? 0
            : money(payload.amountPaid || 0),
      notes: payload.notes || "",
      createdAt: Utils.nowISO(),
    };
    if (purchase.paymentStatus === "Partial" && (purchase.amountPaid <= 0 || purchase.amountPaid >= totalCost)) {
      throw new Error("Enter a valid partial amount for this purchase");
    }
    state.purchases.push(purchase);
    addBatch(state, {
      productId: product.id,
      purchaseId: purchase.id,
      qty,
      costPerUnit,
      date: purchase.date,
      source: "purchase",
    });
    product.latestPurchaseCost = costPerUnit;
    recordMovement(state, {
      productId: product.id,
      type: "purchase",
      qtyChange: qty,
      reason: purchase.supplierName ? `Purchase from ${purchase.supplierName}` : "Stock purchase",
      refId: purchase.id,
      costImpact: totalCost,
    });
    return purchase;
  }

  function adjustStock(state, { productId, qtyChange, reason, type, costPerUnit }) {
    const product = state.products.find((p) => p.id === productId);
    if (!product) throw new Error("Product not found");
    const change = money(qtyChange);
    if (!change) throw new Error("Quantity change cannot be zero");
    let costImpact = 0;
    if (change > 0) {
      const unitCost = money(costPerUnit ?? displayPurchaseCost(state, productId));
      addBatch(state, {
        productId,
        purchaseId: null,
        qty: change,
        costPerUnit: unitCost,
        date: Utils.nowISO(),
        source: type || "adjustment",
      });
      costImpact = money(change * unitCost);
    } else {
      const consumed = consumeFIFO(state, productId, Math.abs(change));
      costImpact = money(-consumed.totalCost);
    }
    const movement = {
      productId,
      type: type || "adjustment",
      qtyChange: change,
      reason: reason || "Manual stock correction",
      costImpact,
    };
    recordMovement(state, movement);
    return movement;
  }

  function completedSales(state) {
    return (state.sales || []).filter((s) => s.status === "completed");
  }

  function salesInRange(state, from, to) {
    return completedSales(state).filter((s) => Utils.inRange(s.date, from, to));
  }

  function expensesInRange(state, from, to) {
    return (state.expenses || []).filter((e) => Utils.inRange(e.date, from, to));
  }

  function totalsForSales(sales) {
    return {
      revenue: money(sales.reduce((s, x) => s + Number(x.grandTotal), 0)),
      cashReceived: money(sales.reduce((s, x) => s + Number(x.cashReceived ?? (x.paymentMethod === "Credit" ? 0 : x.amountPaid)), 0)),
      cost: money(sales.reduce((s, x) => s + Number(x.costTotal), 0)),
      grossProfit: money(sales.reduce((s, x) => s + Number(x.grossProfit), 0)),
      items: sales.reduce((s, x) => s + x.items.reduce((n, i) => n + Number(i.qty), 0), 0),
      count: sales.length,
    };
  }

  function dashboardMetrics(state, date = new Date()) {
    const todayFrom = Utils.startOfDay(date);
    const todayTo = Utils.endOfDay(date);
    const todaySales = salesInRange(state, todayFrom, todayTo);
    const todayExpenses = expensesInRange(state, todayFrom, todayTo);
    const todayT = totalsForSales(todaySales);
    const expenseTotal = money(todayExpenses.reduce((s, e) => s + Number(e.amount), 0));
    const stockQty = state.products.reduce((s, p) => s + Number(p.currentStock || 0), 0);
    const lowStock = state.products.filter((p) => Number(p.currentStock) > 0 && Number(p.currentStock) <= Number(p.minStock));
    const outStock = state.products.filter((p) => Number(p.currentStock) <= 0);
    const inventoryValue = money(
      state.products.reduce((s, p) => s + inventoryValueForProduct(state, p.id), 0)
    );
    const udhaar = money(state.customers.reduce((s, c) => s + Number(c.outstanding || 0), 0));
    const purchasesToday = (state.purchases || []).filter((p) => Utils.inRange(p.date, todayFrom, todayTo));
    const purchaseTotalAll = money(state.purchases.reduce((s, p) => s + Number(p.totalCost), 0));
    return {
      todaySales: todayT.revenue,
      todayProfit: todayT.grossProfit,
      todayNetProfit: money(todayT.grossProfit - expenseTotal),
      todayExpenses: expenseTotal,
      todayCash: todayT.cashReceived,
      productCount: state.products.length,
      stockQty,
      lowStockCount: lowStock.length,
      outStockCount: outStock.length,
      inventoryValue,
      udhaar,
      purchasesToday: money(purchasesToday.reduce((s, p) => s + Number(p.totalCost), 0)),
      purchasesAll: purchaseTotalAll,
      lowStock,
    };
  }

  function profitReport(state, from, to) {
    const sales = salesInRange(state, from, to);
    const expenses = expensesInRange(state, from, to);
    const t = totalsForSales(sales);
    const operatingExpenses = money(expenses.reduce((s, e) => s + Number(e.amount), 0));
    return {
      ...t,
      operatingExpenses,
      netProfit: money(t.grossProfit - operatingExpenses),
      sales,
      expenses,
    };
  }

  function bestSellers(state, from, to, limit = 8) {
    const map = {};
    salesInRange(state, from, to).forEach((sale) => {
      sale.items.forEach((item) => {
        if (!map[item.productId]) {
          map[item.productId] = {
            productId: item.productId,
            name: item.name,
            qty: 0,
            revenue: 0,
            profit: 0,
          };
        }
        map[item.productId].qty += Number(item.qty);
        map[item.productId].revenue += Number(item.lineTotal);
        map[item.productId].profit += Number(item.profit);
      });
    });
    return Object.values(map)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, limit);
  }

  function chartSeries(state, range = "daily") {
    const sales = completedSales(state);
    const points = [];
    const now = new Date();
    if (range === "daily") {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const label = d.toLocaleDateString("en-GB", { weekday: "short" });
        const daySales = sales.filter((s) => Utils.inRange(s.date, Utils.startOfDay(d), Utils.endOfDay(d)));
        const t = totalsForSales(daySales);
        points.push({ label, sales: t.revenue, profit: t.grossProfit });
      }
    } else if (range === "weekly") {
      for (let i = 7; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i * 7);
        const from = Utils.startOfWeek(d);
        const to = new Date(from);
        to.setDate(from.getDate() + 6);
        const label = `${from.getDate()}/${from.getMonth() + 1}`;
        const weekSales = sales.filter((s) => Utils.inRange(s.date, from, to));
        const t = totalsForSales(weekSales);
        points.push({ label, sales: t.revenue, profit: t.grossProfit });
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const from = Utils.startOfMonth(d);
        const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const label = d.toLocaleDateString("en-GB", { month: "short" });
        const monthSales = sales.filter((s) => Utils.inRange(s.date, from, to));
        const t = totalsForSales(monthSales);
        points.push({ label, sales: t.revenue, profit: t.grossProfit });
      }
    }
    return points;
  }

  return {
    PAYMENT_METHODS,
    PURCHASE_PAYMENT,
    UNITS,
    EXPENSE_CATEGORIES,
    productStock,
    syncProductStock,
    displayPurchaseCost,
    inventoryValueForProduct,
    consumeFIFO,
    restoreFIFO,
    addBatch,
    nextSku,
    nextInvoice,
    completeSale,
    voidSale,
    createPurchase,
    adjustStock,
    recordCustomerPayment,
    upsertCustomer,
    completedSales,
    salesInRange,
    expensesInRange,
    totalsForSales,
    dashboardMetrics,
    profitReport,
    bestSellers,
    chartSeries,
    money,
  };
})();
