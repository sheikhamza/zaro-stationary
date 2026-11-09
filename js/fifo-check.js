const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ctx = {
  console,
  localStorage: {
    _s: {},
    getItem(k) {
      return k in this._s ? this._s[k] : null;
    },
    setItem(k, v) {
      this._s[k] = String(v);
    },
    removeItem(k) {
      delete this._s[k];
    },
  },
  document: { addEventListener() {} },
};
vm.createContext(ctx);

const code = ["utils.js", "store.js", "finance.js"]
  .map((f) => fs.readFileSync(path.join(__dirname, f), "utf8"))
  .join("\n");

const test = `
const state = Store.emptyState();
state.products.push({
  id: "prd_pencil",
  name: "Pencil",
  sku: "STA-0001",
  categoryId: "c1",
  unit: "piece",
  sellingPrice: 20,
  currentStock: 0,
  minStock: 10,
});
Finance.createPurchase(state, { productId: "prd_pencil", quantity: 12, totalCost: 120, date: "2026-10-01", paymentStatus: "Paid" });
Finance.createPurchase(state, { productId: "prd_pencil", quantity: 50, totalCost: 400, date: "2026-10-20", paymentStatus: "Paid" });
const sale = Finance.completeSale(state, {
  items: [{ productId: "prd_pencil", qty: 1, unitPrice: 20 }],
  discount: 0,
  paymentMethod: "Cash",
  customerName: "Walk-in",
});
const batch1 = state.purchaseBatches.find((b) => b.qtyOriginal === 12);
console.log(JSON.stringify({
  cost: sale.costTotal,
  profit: sale.grossProfit,
  stock: state.products[0].currentStock,
  batch1: batch1.qtyRemaining,
  value: Finance.inventoryValueForProduct(state, "prd_pencil"),
}));
if (sale.costTotal !== 10 || sale.grossProfit !== 10) throw new Error("fifo fail");
if (state.products[0].currentStock !== 61) throw new Error("stock fail");
Finance.voidSale(state, sale.id);
if (state.products[0].currentStock !== 62) throw new Error("void fail");
const sale2 = Finance.completeSale(state, {
  items: [{ productId: "prd_pencil", qty: 12, unitPrice: 20 }],
  discount: 20,
  paymentMethod: "Cash",
  customerName: "Walk-in",
});
if (sale2.costTotal !== 120) throw new Error("should consume first batch only at Rs 10");
if (sale2.grossProfit !== 100) throw new Error("gross profit after discount should be 240-120-20=100");
console.log("FIFO checks passed");
`;

vm.runInContext(code + test, ctx);
