import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Package, Pencil, Trash2, Sheet, Printer, ClockArrowDown, ClockArrowUp,
  ClipboardList, ChevronDown, Copy, Check, ArrowUp,
} from "lucide-react";
import PickupToast from "../components/PickupToast";
import * as XLSX from 'xlsx';
import './OrderListPage.css';
import { motion, AnimatePresence } from "framer-motion";
import { renderFruitExportLine, PLACES } from "../utils/fruit";

const CURRENT_YEAR = new Date().getFullYear();

const DIES  = ["Diumenge","Dilluns","Dimarts","Dimecres","Dijous","Divendres","Dissabte"];
const MESOS = ["Gener","Febrer","Març","Abril","Maig","Juny","Juliol","Agost","Setembre","Octubre","Novembre","Desembre"];

const STATUS_CONFIG = {
  pending:   { color: "#F59E0B", bg: "#FFFBEB", label: "Pendent",    next: "ready" },
  ready:     { color: "#3B82F6", bg: "#EFF6FF", label: "Preparat",   next: "picked_up" },
  picked_up: { color: "#10B981", bg: "#ECFDF5", label: "Recollit",   next: null },
  cancelled: { color: "#78716C", bg: "#F5F5F4", label: "Cancel·lat", next: null },
};

const FRUIT_CARD_STYLE = {
  pressec:  { bg: "#FFF7ED", border: "#FED7AA", numColor: "#D97706" },
  albercoc: { bg: "#FEFCE8", border: "#FEF08A", numColor: "#CA8A04" },
  cirera:   { bg: "#FFF1F2", border: "#FECDD3", numColor: "#BE123C" },
  melo:     { bg: "#F0FDF4", border: "#BBF7D0", numColor: "#15803D" },
  sindria:  { bg: "#FFF1F2", border: "#FECDD3", numColor: "#E11D48" },
};

// ── Date helpers ──────────────────────────────────────────────────────────────

function getTodayMadrid() {
  return new Date().toLocaleDateString('sv', { timeZone: 'Europe/Madrid' });
}

function getDateLabelFull(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  const date = new Date(dateStr + "T00:00:00");
  const yearSuffix = parseInt(y) < CURRENT_YEAR ? ` ${y}` : '';
  return `${DIES[date.getDay()]} ${parseInt(d)} de ${MESOS[parseInt(m) - 1].toLowerCase()}${yearSuffix}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const [y, mm, dd] = dateStr.split("-");
  if (parseInt(y) < CURRENT_YEAR) return `${dd}/${mm}/${String(y).slice(2)}`;
  return `${dd}/${mm}`;
}

function formatFullDate(isoStr) {
  if (!isoStr) return "";
  const date = new Date(isoStr);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const day    = parts.find(p => p.type === 'day')?.value ?? '??';
  const month  = parts.find(p => p.type === 'month')?.value ?? '??';
  const hour   = parts.find(p => p.type === 'hour')?.value ?? '??';
  const minute = parts.find(p => p.type === 'minute')?.value ?? '??';
  const yearInMadrid = parseInt(
    new Intl.DateTimeFormat('en', { timeZone: 'Europe/Madrid', year: 'numeric' }).format(date)
  );
  const yearSuffix = yearInMadrid < CURRENT_YEAR ? `/${String(yearInMadrid).slice(2)}` : '';
  return `${day}/${month}${yearSuffix} ${hour}:${minute}`;
}

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── Component ─────────────────────────────────────────────────────────────────

function OrderListPage() {
  const navigate = useNavigate();
  const today    = getTodayMadrid();

  const [orders, setOrders]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");

  const [search, setSearch] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("olist_filters") || "{}").search ?? ""; } catch { return ""; }
  });
  const [filterDate, setFilterDate] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("olist_filters") || "{}").filterDate ?? today; } catch { return today; }
  });
  const [filterPlace, setFilterPlace] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("olist_filters") || "{}").filterPlace ?? "Tots els llocs"; } catch { return "Tots els llocs"; }
  });
  const [sortNewestFirst, setSortNewestFirst] = useState(() => {
    try { const v = JSON.parse(sessionStorage.getItem("olist_filters") || "{}").sortNewestFirst; return v ?? true; } catch { return true; }
  });
  const [hidePicked, setHidePicked] = useState(false);

  const [showSummary, setShowSummary]     = useState(false);
  const [expandedFruits, setExpandedFruits] = useState(new Set());
  const [copySuccess, setCopySuccess]     = useState(false);

  const [showSuccess, setShowSuccess]     = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [sortMessage, setSortMessage]     = useState("");
  // Pickup-undo toast state
  const [pendingPickup, setPendingPickup] = useState(null);
  const pickupTimerRef = useRef(null);

  // Delete-undo toast state
  const [pendingDelete, setPendingDelete] = useState(null);
  const deleteTimerRef = useRef(null);

  // Scroll-based FABs
  const [showScrollTop, setShowScrollTop] = useState(false);

  // ── Scroll tracking ────────────────────────────────────────────────────────

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 220);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Data fetching ──────────────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterDate) params.set("date", filterDate);
    if (filterPlace !== "Tots els llocs") params.set("place", filterPlace);
    fetch(`${import.meta.env.VITE_API_URL}/orders?${params}`)
      .then(res => { if (!res.ok) throw new Error(`Server returned ${res.status}`); return res.json(); })
      .then(data => { setOrders(data); setLoading(false); })
      .catch(err => { console.error(err); setError("Error carregant comandes."); setLoading(false); });
  }, [filterDate, filterPlace]);

  // ── Session & notification effects ────────────────────────────────────────

  useEffect(() => {
    const raw = sessionStorage.getItem("pendingMsg");
    if (raw) {
      try { const { text } = JSON.parse(raw); setSuccessMessage(text); setShowSuccess(true); } catch {}
      sessionStorage.removeItem("pendingMsg");
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem("olist_filters", JSON.stringify({ search, filterDate, filterPlace, sortNewestFirst }));
  }, [search, filterDate, filterPlace, sortNewestFirst]);

  useEffect(() => {
    if (sortMessage) { const t = setTimeout(() => setSortMessage(""), 2000); return () => clearTimeout(t); }
  }, [sortMessage]);

  useEffect(() => {
    if (showSuccess) { const t = setTimeout(() => setShowSuccess(false), 1500); return () => clearTimeout(t); }
  }, [showSuccess]);

  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(""), 2500); return () => clearTimeout(t); }
  }, [error]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pickupTimerRef.current) clearTimeout(pickupTimerRef.current);
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    };
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const confirmPickupNow = (orderId) => {
    fetch(`${import.meta.env.VITE_API_URL}/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "picked_up" }),
    })
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(updated => setOrders(prev => prev.map(o =>
        o.id === updated.id ? { ...o, status: "picked_up", _pendingPickup: false } : o
      )))
      .catch(() => {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, _pendingPickup: false } : o));
        setError("Error actualitzant l'estat.");
      });
  };

  const handleMarkPickedUp = (order) => {
    // If there's already a pending one, confirm it immediately before starting a new one
    if (pendingPickup) {
      clearTimeout(pickupTimerRef.current);
      pickupTimerRef.current = null;
      confirmPickupNow(pendingPickup.orderId);
    }

    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, _pendingPickup: true, status: "picked_up" } : o));

    pickupTimerRef.current = setTimeout(() => {
      confirmPickupNow(order.id);
      setPendingPickup(null);
      pickupTimerRef.current = null;
    }, 3000);

    setPendingPickup({ id: order.id, orderId: order.id, customerName: order.customer, place: order.place, date: order.date, originalStatus: order.status });
  };

  const handleUndoPickup = () => {
    clearTimeout(pickupTimerRef.current);
    pickupTimerRef.current = null;
    setOrders(prev => prev.map(o =>
      o.id === pendingPickup.orderId ? { ...o, _pendingPickup: false, status: pendingPickup.originalStatus } : o
    ));
    setPendingPickup(null);
  };

  const handleNewOrderSameName = () => {
    clearTimeout(pickupTimerRef.current);
    pickupTimerRef.current = null;
    confirmPickupNow(pendingPickup.orderId);
    const { customerName, place, date } = pendingPickup;
    setPendingPickup(null);
    navigate('/add', { state: { prefillCustomer: customerName, prefillPlace: place, prefillDate: date, returnPath: '/' } });
  };

  const handleStatusUpdate = (orderId, newStatus) => {
    fetch(`${import.meta.env.VITE_API_URL}/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
      .then(res => { if (!res.ok) throw new Error("Error"); return res.json(); })
      .then(updated => setOrders(prev => prev.map(o => o.id === updated.id ? { ...o, status: updated.status } : o)))
      .catch(() => setError("Error actualitzant l'estat."));
  };

  const confirmDeleteNow = (orderId) => {
    fetch(`${import.meta.env.VITE_API_URL}/orders/${orderId}`, { method: "DELETE" })
      .catch(() => setError("Error eliminant la comanda."));
  };

  const handleDelete = (order) => {
    if (pendingDelete) {
      clearTimeout(deleteTimerRef.current);
      confirmDeleteNow(pendingDelete.orderId);
    }
    setOrders(prev => prev.filter(o => o.id !== order.id));
    deleteTimerRef.current = setTimeout(() => {
      confirmDeleteNow(order.id);
      setPendingDelete(null);
      deleteTimerRef.current = null;
    }, 3000);
    setPendingDelete({ id: Date.now(), orderId: order.id, customerName: order.customer, orderData: order });
  };

  const handleUndoDelete = () => {
    clearTimeout(deleteTimerRef.current);
    deleteTimerRef.current = null;
    setOrders(prev => [...prev, pendingDelete.orderData]);
    setPendingDelete(null);
  };

  const toggleFruit  = (key) => setExpandedFruits(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const openSummary  = () => { setExpandedFruits(new Set()); setCopySuccess(false); setShowSummary(true); };

  // ── Computed data ──────────────────────────────────────────────────────────

  const filteredOrders = orders
    .filter(order => {
      const matchesName  = order.customer.toLowerCase().includes(search.toLowerCase());
      const matchesDate  = filterDate === "" || order.date === filterDate;
      const matchesPlace = filterPlace === "Tots els llocs" || order.place === filterPlace;
      return matchesName && matchesDate && matchesPlace;
    })
    .filter(order => !hidePicked || (order.status !== "picked_up" && order.status !== "cancelled"))
    .sort((a, b) => sortNewestFirst
      ? new Date(b.created_at) - new Date(a.created_at)
      : new Date(a.created_at) - new Date(b.created_at)
    );

  const fruitSummary = {
    pressecs: {}, pressecsGrouped: {},
    albercoc: { "1": [], "2": [] },
    cirera:   { "1": [], "2": [] },
    melo: [], sindria: [],
  };
  for (const order of filteredOrders) {
    for (const item of order.fruits) {
      const { fruit, size, qty, weight } = item;
      const customer = order.customer;
      if (fruit.startsWith("pressec")) {
        const variant = fruit.split("_")[1];
        const key = `${variant}-${size}`;
        if (!fruitSummary.pressecs[key]) fruitSummary.pressecs[key] = [];
        fruitSummary.pressecs[key].push({ customer, qty });
        if (!fruitSummary.pressecsGrouped[variant]) fruitSummary.pressecsGrouped[variant] = {};
        if (!fruitSummary.pressecsGrouped[variant][size]) fruitSummary.pressecsGrouped[variant][size] = [];
        fruitSummary.pressecsGrouped[variant][size].push({ customer, qty });
      }
      if ((fruit === "albercoc" || fruit === "cirera") && (weight === 1 || weight === 2))
        fruitSummary[fruit][weight].push({ customer, qty });
      if (fruit === "melo")    fruitSummary.melo.push({ customer, qty, weight });
      if (fruit === "sindria") fruitSummary.sindria.push({ customer, qty, weight });
    }
  }

  const hasAnything =
    Object.keys(fruitSummary.pressecsGrouped).length > 0 ||
    fruitSummary.albercoc["1"].length + fruitSummary.albercoc["2"].length > 0 ||
    fruitSummary.cirera["1"].length + fruitSummary.cirera["2"].length > 0 ||
    fruitSummary.melo.length > 0 || fruitSummary.sindria.length > 0;

  // ── Export ────────────────────────────────────────────────────────────────

  function handleExport() {
    const rows = [];
    const customerOrders = {};
    for (const order of filteredOrders) {
      const customer = order.customer;
      if (!customerOrders[customer]) customerOrders[customer] = [];
      for (const item of order.fruits) customerOrders[customer].push(renderFruitExportLine(item));
    }
    for (const [customer, items] of Object.entries(customerOrders))
      items.forEach(item => rows.push({ Client: customer, Producte: item }));
    rows.push({});
    rows.push({ Client: "Resum" });
    let totalPressec = 0;
    Object.entries(fruitSummary.pressecsGrouped).forEach(([type, sizes]) => {
      rows.push({ Client: `Pressec ${type}` });
      let typeTotal = 0;
      Object.entries(sizes).forEach(([size, list]) => {
        const subtotal = list.reduce((acc, x) => acc + x.qty, 0);
        typeTotal += subtotal;
        rows.push({ Client: `  ${size}`, Producte: `${subtotal} caixes` });
      });
      totalPressec += typeTotal;
      rows.push({ Producte: `Total: ${typeTotal} caixes` });
    });
    rows.push({ Producte: `Total pressecs: ${totalPressec} caixes` });
    ["albercoc", "cirera"].forEach(fruit => {
      const l1 = fruitSummary[fruit]["1"], l2 = fruitSummary[fruit]["2"];
      const c1 = l1.reduce((a, x) => a + x.qty, 0), c2 = l2.reduce((a, x) => a + x.qty, 0);
      const kg = c1 + c2 * 2;
      if (c1 > 0 || c2 > 0) {
        rows.push({ Client: capitalize(fruit), Producte: `${kg} kg total` });
        if (c1 > 0) rows.push({ Client: "  Tarrina (1kg)", Producte: `${c1} u → ${c1} kg` });
        if (c2 > 0) rows.push({ Client: "  Caixa (2kg)",   Producte: `${c2} u → ${c2 * 2} kg` });
      }
    });
    ["melo", "sindria"].forEach(fruit => {
      const total = fruitSummary[fruit].reduce((acc, x) => acc + x.qty, 0);
      if (total > 0) rows.push({ Client: capitalize(fruit), Producte: `${total} peces` });
    });
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook  = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Resum");
    let filename = "resum_fruita.xlsx";
    if (filterDate && filterPlace !== "Tots els llocs") filename = `resum_${filterPlace.replace(/\s+/g,"")}_${filterDate}.xlsx`;
    else if (filterDate) filename = `resum_${filterDate}.xlsx`;
    else if (filterPlace !== "Tots els llocs") filename = `resum_${filterPlace.replace(/\s+/g,"")}.xlsx`;
    XLSX.writeFile(workbook, filename);
  }

  // ── Summary copy text (with Kg for albercoc/cirera) ──────────────────────

  const getSummaryText = () => {
    const lines = [];
    const ctx = [
      filterPlace !== "Tots els llocs" ? filterPlace : null,
      filterDate ? getDateLabelFull(filterDate) : null,
    ].filter(Boolean).join(" · ");
    lines.push(`*Resum${ctx ? ` — ${ctx}` : ""}*`);
    lines.push("");

    Object.entries(fruitSummary.pressecsGrouped).forEach(([variant, sizes]) => {
      const total = Object.values(sizes).flat().reduce((a, x) => a + x.qty, 0);
      lines.push(`🍑 Pressec ${variant} — *${total} ${total === 1 ? "caixa" : "caixes"}*`);
      Object.entries(sizes).sort(([a], [b]) => parseInt(a) - parseInt(b)).forEach(([size, list]) => {
        const sub = list.reduce((a, x) => a + x.qty, 0);
        lines.push(`  Cal.${size}: ${sub} ${sub === 1 ? "caixa" : "caixes"}`);
      });
      lines.push("");
    });

    const ab1 = fruitSummary.albercoc["1"], ab2 = fruitSummary.albercoc["2"];
    const ab1c = ab1.reduce((a, x) => a + x.qty, 0), ab2c = ab2.reduce((a, x) => a + x.qty, 0);
    const abKg = ab1c + ab2c * 2;
    if (abKg > 0) {
      lines.push(`🟠 Albercoc — *${abKg} kg*`);
      if (ab1c > 0) lines.push(`  Tarrina 1kg: ${ab1c} u (${ab1c} kg)`);
      if (ab2c > 0) lines.push(`  Caixa 2kg: ${ab2c} u (${ab2c * 2} kg)`);
      lines.push("");
    }

    const ci1 = fruitSummary.cirera["1"], ci2 = fruitSummary.cirera["2"];
    const ci1c = ci1.reduce((a, x) => a + x.qty, 0), ci2c = ci2.reduce((a, x) => a + x.qty, 0);
    const ciKg = ci1c + ci2c * 2;
    if (ciKg > 0) {
      lines.push(`🍒 Cirera — *${ciKg} kg*`);
      if (ci1c > 0) lines.push(`  Tarrina 1kg: ${ci1c} u (${ci1c} kg)`);
      if (ci2c > 0) lines.push(`  Caixa 2kg: ${ci2c} u (${ci2c * 2} kg)`);
      lines.push("");
    }

    const meloTotal = fruitSummary.melo.reduce((a, x) => a + x.qty, 0);
    if (meloTotal > 0) { lines.push(`🍈 Meló — *${meloTotal} ${meloTotal === 1 ? "peça" : "peces"}*`); lines.push(""); }

    const sindriaTotal = fruitSummary.sindria.reduce((a, x) => a + x.qty, 0);
    if (sindriaTotal > 0) { lines.push(`🍉 Síndria — *${sindriaTotal} ${sindriaTotal === 1 ? "peça" : "peces"}*`); lines.push(""); }

    return lines.join("\n").trimEnd();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getSummaryText()).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    });
  };

  // ── getDateLabel (for filter button) ─────────────────────────────────────

  function getDateLabel(dateStr) {
    const t  = getTodayMadrid();
    const tm = addDays(t, 1);
    const yd = addDays(t, -1);
    const [y, m, d] = dateStr.split('-');
    const date = new Date(dateStr + 'T00:00:00');
    const diaSemana = DIES[date.getDay()];
    const dia = parseInt(d);
    const mes = MESOS[parseInt(m) - 1];
    const yearSuffix = parseInt(y) < CURRENT_YEAR ? ` ${y}` : '';
    if (dateStr === t)  return `Avui · ${diaSemana} ${dia} ${mes}${yearSuffix}`;
    if (dateStr === tm) return `Demà · ${diaSemana} ${dia} ${mes}${yearSuffix}`;
    if (dateStr === yd) return `Ahir · ${diaSemana} ${dia} ${mes}${yearSuffix}`;
    return `${diaSemana} ${dia} ${mes}${yearSuffix}`;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Notification toasts ── */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div key="success" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
            className="fixed inset-0 flex items-center justify-center z-[60] pointer-events-none">
            <div className="popup-message success">{successMessage}</div>
          </motion.div>
        )}
        {error && (
          <motion.div key="error" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
            className="fixed inset-0 flex items-center justify-center z-[60] pointer-events-none">
            <div className="popup-message error">{error}</div>
          </motion.div>
        )}
        {sortMessage && (
          <motion.div key="sort" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
            className="fixed inset-0 flex items-center justify-center z-[60] pointer-events-none">
            <div className="popup-message info">{sortMessage}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Fixed top navbar ── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white border-b border-stone-100 shadow-sm print:hidden">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <img src="/logopressec1.png" alt="Logo" className="h-9 w-9 object-contain" />
          <div className="flex items-center">
            <button
              onClick={openSummary}
              className="p-2.5 rounded-xl hover:bg-stone-50 transition-colors"
              title="Resum">
              <Package className="w-5 h-5" style={{ color: "#F59E0B" }} />
            </button>
            <button
              onClick={() => window.print()}
              className="p-2.5 rounded-xl hover:bg-stone-50 transition-colors"
              title="Imprimir">
              <Printer className="w-5 h-5 text-stone-400" />
            </button>
            <button
              onClick={handleExport}
              className="p-2.5 rounded-xl hover:bg-stone-50 transition-colors"
              title="Exportar">
              <Sheet className="w-5 h-5 text-emerald-500" />
            </button>
            <button
              onClick={() => navigate("/picking")}
              className="p-2.5 rounded-xl hover:bg-stone-50 transition-colors"
              title="Mode Parada">
              <ClipboardList className="w-5 h-5 text-stone-500" />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Main content ── */}
      <div className="min-h-screen pt-14 print:pt-0 print:bg-white" style={{ backgroundColor: "#FAFAF5" }}>
        <div className="max-w-md mx-auto px-4 pt-3 pb-28 print:px-4 print:pt-0 print:pb-0 print:max-w-full">

          {/* ── Print-only document header ── */}
          <div className="order-print-header">
            📋 Llista de Comandes{filterDate ? ` · ${getDateLabel(filterDate)}` : ""}{filterPlace && filterPlace !== "Tots els llocs" ? ` · ${filterPlace}` : ""}
          </div>

          {/* ── Filter section (non-sticky, gray bg) ── */}
          <div className="bg-gray-50 rounded-2xl p-3 mb-4 border border-stone-100 space-y-2 print:hidden">
            {/* Search */}
            <input
              type="text"
              placeholder="Busca un client..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-4 py-2.5 border rounded-xl bg-white text-stone-800 placeholder-stone-400 shadow-sm focus:outline-none transition-all"
              style={{ borderColor: "#E7E5E4" }}
              onFocus={e => e.target.style.borderColor = "#F59E0B"}
              onBlur={e => e.target.style.borderColor = "#E7E5E4"}
            />

            {/* Date picker */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setFilterDate(prev => addDays(prev || today, -1))}
                className="p-2.5 rounded-xl bg-white border border-stone-200 hover:bg-stone-50 shadow-sm text-stone-600 leading-none text-lg font-medium transition-colors flex-shrink-0">
                &lsaquo;
              </button>
              <div className="flex-1 relative">
                <button
                  onClick={() => document.getElementById("date-picker").showPicker?.()}
                  className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl shadow-sm text-sm font-semibold text-stone-700 text-center hover:bg-stone-50 transition-colors">
                  {filterDate ? getDateLabel(filterDate) : "Totes les dates"}
                </button>
                <input
                  id="date-picker"
                  type="date"
                  value={filterDate}
                  onChange={e => setFilterDate(e.target.value)}
                  className="absolute opacity-0 pointer-events-none"
                  style={{ top: 0, left: 0, width: "1px", height: "1px" }}
                />
              </div>
              <button
                onClick={() => setFilterDate(prev => addDays(prev || today, 1))}
                className="p-2.5 rounded-xl bg-white border border-stone-200 hover:bg-stone-50 shadow-sm text-stone-600 leading-none text-lg font-medium transition-colors flex-shrink-0">
                &rsaquo;
              </button>
            </div>

            {/* Place chips */}
            <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {["Tots els llocs", ...PLACES].map(place => (
                <button
                  key={place}
                  onClick={() => setFilterPlace(place)}
                  className="px-3 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap border transition-all flex-shrink-0"
                  style={filterPlace === place
                    ? { backgroundColor: "#F59E0B", borderColor: "#F59E0B", color: "#1C1917" }
                    : { backgroundColor: "white", borderColor: "#E7E5E4", color: "#57534E" }
                  }
                >
                  {place === "Tots els llocs" ? "Tots" : place}
                </button>
              ))}
            </div>

            {/* Sort + hide toggles */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setSortNewestFirst(prev => !prev); setSortMessage(sortNewestFirst ? "Mes antics primer" : "Mes nous primer"); }}
                className="bg-white border border-stone-200 text-stone-600 px-3 py-2 rounded-xl flex items-center shadow-sm hover:bg-stone-50 transition-colors"
                title="Canviar ordre">
                {sortNewestFirst ? <ClockArrowDown className="w-4 h-4" /> : <ClockArrowUp className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setHidePicked(prev => !prev)}
                className="px-3 py-2 rounded-xl border text-xs font-semibold shadow-sm transition-colors"
                style={hidePicked
                  ? { backgroundColor: "#F59E0B", borderColor: "#F59E0B", color: "#1c1917" }
                  : { backgroundColor: "white", borderColor: "#E7E5E4", color: "#78716C" }
                }
                title={hidePicked ? "Mostrar totes" : "Amagar recollides"}
              >
                {hidePicked ? "Pendents" : "Totes"}
              </button>
            </div>
          </div>

          {/* ── Order list ── */}
          {loading ? (
            <div className="flex flex-col items-center justify-center mt-20">
              <div className="w-10 h-10 border-4 border-amber-100 border-t-amber-400 rounded-full animate-spin mb-3"></div>
              <p className="text-sm text-stone-400">Carregant comandes...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center mt-20 text-center">
              <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-3">
                <Package className="w-7 h-7 text-stone-300" />
              </div>
              <p className="text-stone-500 font-medium">No hi ha comandes</p>
              <p className="text-xs text-stone-400 mt-1">Afegeix la primera comanda del dia</p>
            </div>
          ) : (
            <motion.div layout>
              <AnimatePresence mode="popLayout">
                {filteredOrders.map(order => (
                  <motion.div
                    key={order.id} layout
                    initial={{ opacity: 0, y: sortNewestFirst ? 16 : -16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 80, damping: 15 }}
                    className="order-card bg-white rounded-2xl shadow-sm mb-3 overflow-hidden"
                    style={{ border: "1px solid #F5F5F4", borderLeft: `4px solid ${(STATUS_CONFIG[order.status] || STATUS_CONFIG.pending).color}` }}
                  >
                    <div className="order-card-inner p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="order-card-check" />
                          <span className="order-card-customer font-bold text-stone-900 text-base leading-tight truncate">{order.customer}</span>
                        </div>
                        <span className="order-card-date text-xs text-stone-400 whitespace-nowrap mt-0.5 shrink-0">{formatFullDate(order.created_at)}</span>
                      </div>
                      <div className="order-card-fruits space-y-0.5 mb-2">
                        {order.fruits.map((fruit, idx) => (
                          <div key={idx} className="order-card-fruit-item text-sm text-stone-600 truncate">{renderFruitDetails(fruit)}</div>
                        ))}
                      </div>
                      <div className="order-card-meta flex items-center gap-2 mb-3 flex-wrap">
                        {(() => {
                          const s = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                          return (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: s.bg, color: s.color }}>
                              {s.label}
                            </span>
                          );
                        })()}
                        <span className="text-xs text-stone-400">{formatDate(order.date)} &middot; {order.place}</span>
                      </div>
                      {order.notes?.trim() && (
                        <div className="order-card-notes mb-3 text-xs text-stone-500 italic bg-stone-50 rounded-lg px-3 py-2 border border-stone-100 line-clamp-2">{order.notes.trim()}</div>
                      )}
                      <div className="order-card-actions flex gap-2">
                        <button onClick={() => navigate(`/edit/${order.id}`, { state: { returnPath: "/" } })}
                          className="bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200 px-3 py-2 rounded-xl text-sm flex items-center justify-center gap-1.5 transition-colors font-medium">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {(() => {
                          const s = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                          if (!s.next) return null;
                          const nextCfg = STATUS_CONFIG[s.next];
                          return (
                            <button
                              onClick={() => s.next === 'picked_up'
                                ? handleMarkPickedUp(order)
                                : handleStatusUpdate(order.id, s.next)
                              }
                              className="flex-1 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors"
                              style={{ backgroundColor: nextCfg.bg, color: nextCfg.color, borderColor: nextCfg.color + "40" }}
                            >
                              Marcar: {nextCfg.label}
                            </button>
                          );
                        })()}
                        {order.status !== "cancelled" && order.status !== "picked_up" && (
                          <button
                            onClick={() => handleStatusUpdate(order.id, "cancelled")}
                            className="bg-stone-50 hover:bg-stone-100 text-stone-400 hover:text-stone-600 border border-stone-200 px-3 py-2 rounded-xl text-sm flex items-center transition-colors"
                            title="Cancel·lar"
                          >
                            &times;
                          </button>
                        )}
                        <button onClick={() => handleDelete(order)}
                          className="bg-stone-50 hover:bg-red-50 text-stone-400 hover:text-red-500 border border-stone-200 hover:border-red-200 px-3 py-2 rounded-xl text-sm flex items-center transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ── Print-only summary ── */}
          <PrintSummary fruitSummary={fruitSummary} />

        </div>
      </div>

      {/* ── Summary bottom sheet ── */}
      <AnimatePresence>
        {showSummary && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
              onClick={() => setShowSummary(false)}
            />
            <motion.div
              key="sheet"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 38 }}
              className="fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-3xl flex flex-col shadow-2xl"
              style={{ maxHeight: "88vh" }}
            >
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-stone-200" />
              </div>
              <div className="flex items-center justify-between px-5 py-2 flex-shrink-0">
                <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                  <Package className="w-5 h-5" style={{ color: "#F59E0B" }} /> Resum
                </h2>
                <button onClick={() => setShowSummary(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 text-xl transition-colors">
                  &times;
                </button>
              </div>
              {(filterPlace !== "Tots els llocs" || filterDate) && (
                <div className="mx-4 mb-2 px-4 py-2.5 rounded-xl flex-shrink-0"
                  style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
                  <p className="text-sm font-semibold text-stone-800">
                    {[filterPlace !== "Tots els llocs" ? filterPlace : null, filterDate ? getDateLabelFull(filterDate) : null].filter(Boolean).join(" · ")}
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {filteredOrders.filter(o => o.status !== "cancelled").length} comandes
                  </p>
                </div>
              )}

              <div className="overflow-y-auto flex-1 px-4 pb-3 space-y-2.5">
                {/* Pressec */}
                {Object.entries(fruitSummary.pressecsGrouped).map(([variant, sizes]) => {
                  const total = Object.values(sizes).flat().reduce((a, x) => a + x.qty, 0);
                  const key   = `pressec_${variant}`;
                  const isExp = expandedFruits.has(key);
                  const st    = FRUIT_CARD_STYLE.pressec;
                  return (
                    <div key={key} className="rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${st.border}` }}>
                      <button onClick={() => toggleFruit(key)}
                        className="w-full flex items-center gap-3 px-4 py-4 text-left"
                        style={{ backgroundColor: st.bg }}>
                        <span className="text-xl flex-shrink-0">🍑</span>
                        <span className="flex-1 font-bold text-stone-900 capitalize">Pressec {variant}</span>
                        <span className="text-4xl font-black leading-none tabular-nums" style={{ color: st.numColor }}>{total}</span>
                        <span className="text-xs text-stone-500 w-9 text-left">{total === 1 ? "caixa" : "caixes"}</span>
                        <ChevronDown className={`w-4 h-4 text-stone-400 flex-shrink-0 transition-transform ${isExp ? "rotate-180" : ""}`} />
                      </button>
                      {isExp && (
                        <div className="bg-white px-4 py-3 border-t space-y-3" style={{ borderColor: st.border }}>
                          {Object.entries(sizes).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([size, list]) => {
                            const sub = list.reduce((a, x) => a + x.qty, 0);
                            return (
                              <div key={size}>
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-sm font-semibold text-stone-700">Cal.{size}</span>
                                  <span className="text-sm font-bold" style={{ color: st.numColor }}>{sub} {sub === 1 ? "caixa" : "caixes"}</span>
                                </div>
                                <div className="space-y-1 pl-2">
                                  {list.map((e, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs text-stone-500">
                                      <span>{e.customer}</span>
                                      <span className="font-medium">{e.qty} {e.qty === 1 ? "caixa" : "caixes"}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Albercoc — mostra Kg totals */}
                {(() => {
                  const l1 = fruitSummary.albercoc["1"], l2 = fruitSummary.albercoc["2"];
                  const c1 = l1.reduce((a, x) => a + x.qty, 0), c2 = l2.reduce((a, x) => a + x.qty, 0);
                  const totalKg = c1 + c2 * 2;
                  if (totalKg === 0) return null;
                  const key = "albercoc"; const isExp = expandedFruits.has(key); const st = FRUIT_CARD_STYLE.albercoc;
                  return (
                    <div className="rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${st.border}` }}>
                      <button onClick={() => toggleFruit(key)} className="w-full flex items-center gap-3 px-4 py-4 text-left" style={{ backgroundColor: st.bg }}>
                        <span className="text-xl flex-shrink-0">🟠</span>
                        <span className="flex-1 font-bold text-stone-900">Albercoc</span>
                        <span className="text-4xl font-black leading-none tabular-nums" style={{ color: st.numColor }}>{totalKg}</span>
                        <span className="text-xs text-stone-500 w-9 text-left">kg</span>
                        <ChevronDown className={`w-4 h-4 text-stone-400 flex-shrink-0 transition-transform ${isExp ? "rotate-180" : ""}`} />
                      </button>
                      {isExp && (
                        <div className="bg-white px-4 py-3 border-t space-y-3" style={{ borderColor: st.border }}>
                          {c1 > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-sm font-semibold text-stone-700">Tarrina (1 kg)</span>
                                <span className="text-sm font-bold" style={{ color: st.numColor }}>{c1} u · {c1} kg</span>
                              </div>
                              <div className="space-y-1 pl-2">
                                {l1.map((e, i) => <div key={i} className="flex items-center justify-between text-xs text-stone-500"><span>{e.customer}</span><span className="font-medium">{e.qty} u</span></div>)}
                              </div>
                            </div>
                          )}
                          {c2 > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-sm font-semibold text-stone-700">Caixa (2 kg)</span>
                                <span className="text-sm font-bold" style={{ color: st.numColor }}>{c2} u · {c2 * 2} kg</span>
                              </div>
                              <div className="space-y-1 pl-2">
                                {l2.map((e, i) => <div key={i} className="flex items-center justify-between text-xs text-stone-500"><span>{e.customer}</span><span className="font-medium">{e.qty} u</span></div>)}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Cirera — mostra Kg totals */}
                {(() => {
                  const l1 = fruitSummary.cirera["1"], l2 = fruitSummary.cirera["2"];
                  const c1 = l1.reduce((a, x) => a + x.qty, 0), c2 = l2.reduce((a, x) => a + x.qty, 0);
                  const totalKg = c1 + c2 * 2;
                  if (totalKg === 0) return null;
                  const key = "cirera"; const isExp = expandedFruits.has(key); const st = FRUIT_CARD_STYLE.cirera;
                  return (
                    <div className="rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${st.border}` }}>
                      <button onClick={() => toggleFruit(key)} className="w-full flex items-center gap-3 px-4 py-4 text-left" style={{ backgroundColor: st.bg }}>
                        <span className="text-xl flex-shrink-0">🍒</span>
                        <span className="flex-1 font-bold text-stone-900">Cirera</span>
                        <span className="text-4xl font-black leading-none tabular-nums" style={{ color: st.numColor }}>{totalKg}</span>
                        <span className="text-xs text-stone-500 w-9 text-left">kg</span>
                        <ChevronDown className={`w-4 h-4 text-stone-400 flex-shrink-0 transition-transform ${isExp ? "rotate-180" : ""}`} />
                      </button>
                      {isExp && (
                        <div className="bg-white px-4 py-3 border-t space-y-3" style={{ borderColor: st.border }}>
                          {c1 > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-sm font-semibold text-stone-700">Tarrina (1 kg)</span>
                                <span className="text-sm font-bold" style={{ color: st.numColor }}>{c1} u · {c1} kg</span>
                              </div>
                              <div className="space-y-1 pl-2">
                                {l1.map((e, i) => <div key={i} className="flex items-center justify-between text-xs text-stone-500"><span>{e.customer}</span><span className="font-medium">{e.qty} u</span></div>)}
                              </div>
                            </div>
                          )}
                          {c2 > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-sm font-semibold text-stone-700">Caixa (2 kg)</span>
                                <span className="text-sm font-bold" style={{ color: st.numColor }}>{c2} u · {c2 * 2} kg</span>
                              </div>
                              <div className="space-y-1 pl-2">
                                {l2.map((e, i) => <div key={i} className="flex items-center justify-between text-xs text-stone-500"><span>{e.customer}</span><span className="font-medium">{e.qty} u</span></div>)}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Meló */}
                {(() => {
                  const list = fruitSummary.melo;
                  const total = list.reduce((a, x) => a + x.qty, 0);
                  if (total === 0) return null;
                  const key = "melo"; const isExp = expandedFruits.has(key); const st = FRUIT_CARD_STYLE.melo;
                  return (
                    <div className="rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${st.border}` }}>
                      <button onClick={() => toggleFruit(key)} className="w-full flex items-center gap-3 px-4 py-4 text-left" style={{ backgroundColor: st.bg }}>
                        <span className="text-xl flex-shrink-0">🍈</span>
                        <span className="flex-1 font-bold text-stone-900">Meló</span>
                        <span className="text-4xl font-black leading-none tabular-nums" style={{ color: st.numColor }}>{total}</span>
                        <span className="text-xs text-stone-500 w-9 text-left">{total === 1 ? "peça" : "peces"}</span>
                        <ChevronDown className={`w-4 h-4 text-stone-400 flex-shrink-0 transition-transform ${isExp ? "rotate-180" : ""}`} />
                      </button>
                      {isExp && (
                        <div className="bg-white px-4 py-3 border-t space-y-1" style={{ borderColor: st.border }}>
                          {list.map((e, i) => (
                            <div key={i} className="flex items-center justify-between text-xs text-stone-500">
                              <span>{e.customer}</span>
                              <span className="font-medium">{e.qty} {e.qty === 1 ? "peça" : "peces"}{e.weight ? ` · ${e.weight} kg` : ""}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Síndria */}
                {(() => {
                  const list = fruitSummary.sindria;
                  const total = list.reduce((a, x) => a + x.qty, 0);
                  if (total === 0) return null;
                  const key = "sindria"; const isExp = expandedFruits.has(key); const st = FRUIT_CARD_STYLE.sindria;
                  return (
                    <div className="rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${st.border}` }}>
                      <button onClick={() => toggleFruit(key)} className="w-full flex items-center gap-3 px-4 py-4 text-left" style={{ backgroundColor: st.bg }}>
                        <span className="text-xl flex-shrink-0">🍉</span>
                        <span className="flex-1 font-bold text-stone-900">Síndria</span>
                        <span className="text-4xl font-black leading-none tabular-nums" style={{ color: st.numColor }}>{total}</span>
                        <span className="text-xs text-stone-500 w-9 text-left">{total === 1 ? "peça" : "peces"}</span>
                        <ChevronDown className={`w-4 h-4 text-stone-400 flex-shrink-0 transition-transform ${isExp ? "rotate-180" : ""}`} />
                      </button>
                      {isExp && (
                        <div className="bg-white px-4 py-3 border-t space-y-1" style={{ borderColor: st.border }}>
                          {list.map((e, i) => (
                            <div key={i} className="flex items-center justify-between text-xs text-stone-500">
                              <span>{e.customer}</span>
                              <span className="font-medium">{e.qty} {e.qty === 1 ? "peça" : "peces"}{e.weight ? ` · ${e.weight} kg` : ""}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {!hasAnything && (
                  <div className="text-center py-12">
                    <span className="text-4xl block mb-2">🍑</span>
                    <p className="text-stone-400">Cap fruita per mostrar</p>
                  </div>
                )}
              </div>

              <div className="px-4 py-4 border-t border-stone-100 flex-shrink-0">
                <button
                  onClick={handleCopy}
                  className="w-full py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                  style={copySuccess
                    ? { backgroundColor: "#D1FAE5", color: "#059669", border: "1.5px solid #A7F3D0" }
                    : { backgroundColor: "#F5F5F4", color: "#374151", border: "1.5px solid #E7E5E4" }
                  }
                >
                  {copySuccess ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copySuccess ? "Resum copiat!" : "Copiar resum"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Pickup undo toast ── */}
      <div className="print:hidden">
        <PickupToast
          pending={pendingPickup}
          onUndo={handleUndoPickup}
          onNewOrder={handleNewOrderSameName}
        />
        <PickupToast
          pending={pendingDelete ? { ...pendingDelete, message: "Comanda eliminada" } : null}
          onUndo={handleUndoDelete}
          onNewOrder={null}
        />
      </div>

      {/* ── FAB: scroll to top ── */}
      <AnimatePresence>
        {showScrollTop && !pendingPickup && (
          <motion.button
            key="fab-up"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-20 right-4 w-11 h-11 rounded-full bg-white border border-stone-200 shadow-lg text-stone-600 flex items-center justify-center z-30 active:scale-95 print:hidden"
          >
            <ArrowUp className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── FAB: add order ── */}
      <button
        onClick={() => navigate("/add", { state: { prefillDate: addDays(today, 7), returnPath: "/" } })}
        className="fixed bottom-4 right-4 w-14 h-14 rounded-full text-white shadow-xl flex items-center justify-center z-30 transition-all active:scale-95 hover:brightness-110 print:hidden"
        style={{ backgroundColor: "#F59E0B" }}
        title="Afegir comanda"
      >
        <Plus className="w-7 h-7" />
      </button>
    </>
  );
}

// ── Fruit detail renderer (for order cards) ──────────────────────────────────

function renderFruitDetails(item) {
  if (item.fruit.startsWith("pressec_")) {
    const variant = item.fruit.split("_")[1];
    const label = item.qty === 1 ? "caixa" : "caixes";
    return `Pressec ${variant}: ${item.qty} ${label} cal.${item.size}`;
  }
  if (item.fruit === "albercoc") {
    const label = item.qty > 1 ? (item.weight === 1 ? "Tarrines" : "Caixes") : (item.weight === 1 ? "Tarrina" : "Caixa");
    return `Albercoc: ${item.qty} ${label} (${item.weight}kg)`;
  }
  if (item.fruit === "cirera") {
    const label = item.qty > 1 ? (item.weight === 1 ? "Tarrines" : "Caixes") : (item.weight === 1 ? "Tarrina" : "Caixa");
    return `Cirera: ${item.qty} ${label} (${item.weight}kg)`;
  }
  if (item.fruit === "melo")    return `Melo: ${item.qty} peces${item.weight ? ` - ${item.weight} kg` : ""}`;
  if (item.fruit === "sindria") return `Sindria: ${item.qty} peces${item.weight ? ` - ${item.weight} kg` : ""}`;
  return `${capitalize(item.fruit)}: ${item.qty}`;
}

// ── Print-only fruit summary ──────────────────────────────────────────────────

function PrintSummary({ fruitSummary }) {
  const pressecEntries = Object.entries(fruitSummary.pressecsGrouped);
  const ab1 = fruitSummary.albercoc["1"].reduce((a, x) => a + x.qty, 0);
  const ab2 = fruitSummary.albercoc["2"].reduce((a, x) => a + x.qty, 0);
  const ci1 = fruitSummary.cirera["1"].reduce((a, x) => a + x.qty, 0);
  const ci2 = fruitSummary.cirera["2"].reduce((a, x) => a + x.qty, 0);
  const meloTotal    = fruitSummary.melo.reduce((a, x) => a + x.qty, 0);
  const sindriaTotal = fruitSummary.sindria.reduce((a, x) => a + x.qty, 0);
  const abKg = ab1 + ab2 * 2;
  const ciKg = ci1 + ci2 * 2;

  if (!pressecEntries.length && !abKg && !ciKg && !meloTotal && !sindriaTotal) return null;

  return (
    <div className="hidden print:block mt-8 pt-6 border-t-2 border-black">
      <h2 className="text-base font-bold mb-3">Resum de Fruita</h2>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.85rem" }}>
        <tbody>
          {pressecEntries.map(([variant, sizes]) => {
            const total = Object.values(sizes).reduce((a, list) => a + list.reduce((s, x) => s + x.qty, 0), 0);
            return (
              <tr key={variant}>
                <td style={{ padding: "3px 8px 3px 0", fontWeight: 600 }}>🍑 Pressec {variant}</td>
                <td style={{ padding: "3px 8px" }}>
                  {Object.entries(sizes).map(([size, list]) => {
                    const sub = list.reduce((a, x) => a + x.qty, 0);
                    return `Cal.${size}: ${sub}`;
                  }).join(" · ")}
                </td>
                <td style={{ padding: "3px 0", fontWeight: 700, textAlign: "right" }}>{total} caixes</td>
              </tr>
            );
          })}
          {abKg > 0 && (
            <tr>
              <td style={{ padding: "3px 8px 3px 0", fontWeight: 600 }}>🟠 Albercoc</td>
              <td style={{ padding: "3px 8px" }}>
                {ab1 > 0 && `${ab1} tarrines 1kg`}{ab1 > 0 && ab2 > 0 && " · "}{ab2 > 0 && `${ab2} caixes 2kg`}
              </td>
              <td style={{ padding: "3px 0", fontWeight: 700, textAlign: "right" }}>{abKg} kg</td>
            </tr>
          )}
          {ciKg > 0 && (
            <tr>
              <td style={{ padding: "3px 8px 3px 0", fontWeight: 600 }}>🍒 Cirera</td>
              <td style={{ padding: "3px 8px" }}>
                {ci1 > 0 && `${ci1} tarrines 1kg`}{ci1 > 0 && ci2 > 0 && " · "}{ci2 > 0 && `${ci2} caixes 2kg`}
              </td>
              <td style={{ padding: "3px 0", fontWeight: 700, textAlign: "right" }}>{ciKg} kg</td>
            </tr>
          )}
          {meloTotal > 0 && (
            <tr>
              <td style={{ padding: "3px 8px 3px 0", fontWeight: 600 }}>🍈 Meló</td>
              <td style={{ padding: "3px 8px" }}></td>
              <td style={{ padding: "3px 0", fontWeight: 700, textAlign: "right" }}>{meloTotal} peces</td>
            </tr>
          )}
          {sindriaTotal > 0 && (
            <tr>
              <td style={{ padding: "3px 8px 3px 0", fontWeight: 600 }}>🍉 Síndria</td>
              <td style={{ padding: "3px 8px" }}></td>
              <td style={{ padding: "3px 0", fontWeight: 700, textAlign: "right" }}>{sindriaTotal} peces</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default OrderListPage;
