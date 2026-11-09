const Utils = (() => {
  const pad = (n, size = 4) => String(n).padStart(size, "0");

  function uid(prefix = "id") {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function todayISO(date = new Date()) {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function parseDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function startOfDay(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function endOfDay(date = new Date()) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  function startOfWeek(date = new Date()) {
    const d = startOfDay(date);
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - diff);
    return d;
  }

  function startOfMonth(date = new Date()) {
    const d = startOfDay(date);
    d.setDate(1);
    return d;
  }

  function startOfYear(date = new Date()) {
    const d = startOfDay(date);
    d.setMonth(0, 1);
    return d;
  }

  function inRange(dateValue, from, to) {
    const d = parseDate(dateValue);
    if (!d) return false;
    if (from && d < startOfDay(from)) return false;
    if (to && d > endOfDay(to)) return false;
    return true;
  }

  function roundMoney(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
  }

  function formatNumber(n, digits = 2) {
    return roundMoney(n).toLocaleString("en-PK", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  function formatMoney(n, settings) {
    const symbol = settings?.currencySymbol || "Rs";
    return `${symbol} ${formatNumber(n)}`;
  }

  function formatDate(value) {
    const d = parseDate(value);
    if (!d) return "—";
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }

  function formatDateTime(value) {
    const d = parseDate(value);
    if (!d) return "—";
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function debounce(fn, wait = 200) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  function nextSequence(list, field, prefix) {
    const nums = list
      .map((item) => {
        const match = String(item[field] || "").match(/(\d+)$/);
        return match ? Number(match[1]) : 0;
      });
    const max = nums.length ? Math.max(...nums) : 0;
    return `${prefix}${pad(max + 1)}`;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function searchMatch(haystack, query) {
    if (!query) return true;
    const q = query.trim().toLowerCase();
    return String(haystack || "").toLowerCase().includes(q);
  }

  function downloadFile(filename, content, mime = "application/json") {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function csvEscape(value) {
    const s = String(value ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function toCSV(headers, rows) {
    const head = headers.map(csvEscape).join(",");
    const body = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
    return `${head}\n${body}`;
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function qtyLabel(qty, unit = "pcs") {
    return `${Number(qty) || 0} ${unit}`;
  }

  return {
    uid,
    todayISO,
    nowISO,
    parseDate,
    startOfDay,
    endOfDay,
    startOfWeek,
    startOfMonth,
    startOfYear,
    inRange,
    roundMoney,
    formatNumber,
    formatMoney,
    formatDate,
    formatDateTime,
    debounce,
    nextSequence,
    escapeHtml,
    searchMatch,
    downloadFile,
    toCSV,
    clone,
    qtyLabel,
  };
})();
