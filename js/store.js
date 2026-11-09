const Store = (() => {
  const STORAGE_KEY = "zaro_sta_app_v1";
  const SCHEMA_VERSION = 1;

  const DEFAULT_SETTINGS = {
    shopName: "Zaro Stationery",
    shopAddress: "Main Bazaar, Shop #12",
    shopPhone: "0300-0000000",
    currency: "PKR",
    currencySymbol: "Rs",
    receiptFooter: "Thank you for shopping with us!",
    lowStockDefault: 10,
    demoDataLoaded: false,
  };

  function emptyState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      products: [],
      categories: [],
      purchases: [],
      purchaseBatches: [],
      sales: [],
      expenses: [],
      customers: [],
      customerPayments: [],
      stockMovements: [],
      settings: { ...DEFAULT_SETTINGS },
    };
  }

  function migrate(raw) {
    const state = { ...emptyState(), ...(raw || {}) };
    state.schemaVersion = SCHEMA_VERSION;
    state.settings = { ...DEFAULT_SETTINGS, ...(state.settings || {}) };
    const collections = [
      "products",
      "categories",
      "purchases",
      "purchaseBatches",
      "sales",
      "expenses",
      "customers",
      "customerPayments",
      "stockMovements",
    ];
    collections.forEach((key) => {
      if (!Array.isArray(state[key])) state[key] = [];
    });
    return state;
  }

  let firstBoot = false;

  function readRaw() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      console.error("Failed to read storage", err);
      return null;
    }
  }

  function writeRaw(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function getState() {
    const raw = readRaw();
    if (!raw) {
      firstBoot = true;
      const fresh = emptyState();
      writeRaw(fresh);
      return Utils.clone(fresh);
    }
    return migrate(raw);
  }

  function setState(next) {
    const migrated = migrate(next);
    writeRaw(migrated);
    return migrated;
  }

  function update(mutator) {
    const current = getState();
    const draft = Utils.clone(current);
    const result = mutator(draft);
    const next = result || draft;
    return setState(next);
  }

  function get(collection) {
    return getState()[collection] || [];
  }

  function getById(collection, id) {
    return get(collection).find((item) => item.id === id) || null;
  }

  function insert(collection, item) {
    let saved = null;
    update((state) => {
      saved = { ...item };
      if (!saved.id) saved.id = Utils.uid(collection.slice(0, 3));
      state[collection].push(saved);
    });
    return saved;
  }

  function patch(collection, id, changes) {
    let saved = null;
    update((state) => {
      const idx = state[collection].findIndex((item) => item.id === id);
      if (idx === -1) return;
      state[collection][idx] = { ...state[collection][idx], ...changes, updatedAt: Utils.nowISO() };
      saved = state[collection][idx];
    });
    return saved;
  }

  function remove(collection, id) {
    update((state) => {
      state[collection] = state[collection].filter((item) => item.id !== id);
    });
  }

  function settings() {
    return getState().settings;
  }

  function saveSettings(changes) {
    update((state) => {
      state.settings = { ...state.settings, ...changes };
    });
    return settings();
  }

  function exportJSON() {
    return JSON.stringify(getState(), null, 2);
  }

  function importJSON(payload) {
    const parsed = typeof payload === "string" ? JSON.parse(payload) : payload;
    if (!parsed || typeof parsed !== "object") throw new Error("Invalid backup file");
    const next = migrate(parsed);
    writeRaw(next);
    return next;
  }

  function reset() {
    const fresh = emptyState();
    writeRaw(fresh);
    return fresh;
  }

  return {
    STORAGE_KEY,
    SCHEMA_VERSION,
    DEFAULT_SETTINGS,
    emptyState,
    getState,
    setState,
    update,
    get,
    getById,
    insert,
    patch,
    remove,
    settings,
    saveSettings,
    exportJSON,
    importJSON,
    reset,
    wasFirstBoot: () => firstBoot,
  };
})();
