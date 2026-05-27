import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Package, Pencil, Trash2, Sheet, ClockArrowDown, ClockArrowUp, ClipboardList } from "lucide-react";
import * as XLSX from 'xlsx';
import './OrderListPage.css';
import { motion, AnimatePresence } from "framer-motion";
import { renderFruitExportLine, PLACES } from "../utils/fruit";

const STATUS_CONFIG = {
  pending:   { color: "#F59E0B", bg: "#FFFBEB", label: "Pendent",    next: "ready" },
  ready:     { color: "#3B82F6", bg: "#EFF6FF", label: "Preparat",   next: "picked_up" },
  picked_up: { color: "#10B981", bg: "#ECFDF5", label: "Recollit",   next: null },
  cancelled: { color: "#78716C", bg: "#F5F5F4", label: "Cancel·lat", next: null },
};

function OrderListPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const today = new Date().toISOString().split("T")[0];
  const [search, setSearch] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("olist_filters") || "{}").search ?? ""; } catch { return ""; }
  });
  const [filterDate, setFilterDate] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("olist_filters") || "{}").filterDate ?? today; } catch { return today; }
  });
  const [filterPlace, setFilterPlace] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("olist_filters") || "{}").filterPlace ?? "Tots els llocs"; } catch { return "Tots els llocs"; }
  });
  const [hidePicked, setHidePicked] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [sortNewestFirst, setSortNewestFirst] = useState(() => {
    try { const v = JSON.parse(sessionStorage.getItem("olist_filters") || "{}").sortNewestFirst; return v ?? true; } catch { return true; }
  });
  const [sortMessage, setSortMessage] = useState("");
  const [loading, setLoading] = useState(true);

const DIES = ["Diumenge", "Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres", "Dissabte"];
const MESOS = ["Gener", "Febrer", "Març", "Abril", "Maig", "Juny", "Juliol", "Agost", "Setembre", "Octubre", "Novembre", "Desembre"];

function getDateLabel(dateStr) {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  
  const [y, m, d] = dateStr.split('-');
  const date = new Date(dateStr);
  const diaSemana = DIES[date.getDay()];
  const dia = parseInt(d);
  const mes = MESOS[parseInt(m) - 1];

  if (dateStr === today) return `Avui · ${diaSemana} ${dia} ${mes}`;
  if (dateStr === tomorrow) return `Demà · ${diaSemana} ${dia} ${mes}`;
  if (dateStr === yesterday) return `Ahir · ${diaSemana} ${dia} ${mes}`;
  return `${diaSemana} ${dia} ${mes}`;
}

  function addDays(dateStr, n) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + n);
    return d.toISOString().split("T")[0];
  }

  function handleExport() {
    const rows = [];
    const customerOrders = {};
    for (const order of filteredOrders) {
      const customer = order.customer;
      if (!customerOrders[customer]) customerOrders[customer] = [];
      for (const item of order.fruits) {
        customerOrders[customer].push(renderFruitExportLine(item));
      }
    }
    for (const [customer, items] of Object.entries(customerOrders)) {
      items.forEach(item => rows.push({ Client: customer, Producte: item }));
    }
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
      if (l1.length > 0 || l2.length > 0) {
        rows.push({ Client: capitalize(fruit) });
        if (l1.length > 0) rows.push({ Client: "  Tarrina (1kg)", Producte: `${l1.reduce((a,x)=>a+x.qty,0)}` });
        if (l2.length > 0) rows.push({ Client: "  Caixa (2kg)", Producte: `${l2.reduce((a,x)=>a+x.qty,0)}` });
      }
    });
    ["melo", "sindria"].forEach(fruit => {
      const total = fruitSummary[fruit].reduce((acc, x) => acc + x.qty, 0);
      if (total > 0) rows.push({ Client: capitalize(fruit), Producte: `${total} peces` });
    });
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Resum");
    let filename = "resum_fruita.xlsx";
    if (filterDate && filterPlace !== "Tots els llocs") filename = `resum_${filterPlace.replace(/\s+/g,"")}_${filterDate}.xlsx`;
    else if (filterDate) filename = `resum_${filterDate}.xlsx`;
    else if (filterPlace !== "Tots els llocs") filename = `resum_${filterPlace.replace(/\s+/g,"")}.xlsx`;
    XLSX.writeFile(workbook, filename);
  }

  function formatFullDate(isoDateStr) {
    const date = new Date(isoDateStr);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}/${month} ${hours}:${minutes}`;
  }

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

  useEffect(() => {
    if (sortMessage) { const t = setTimeout(() => setSortMessage(""), 2000); return () => clearTimeout(t); }
  }, [sortMessage]);

  useEffect(() => {
    const raw = sessionStorage.getItem("pendingMsg");
    if (raw) {
      try {
        const { text } = JSON.parse(raw);
        setSuccessMessage(text);
        setShowSuccess(true);
      } catch {}
      sessionStorage.removeItem("pendingMsg");
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem("olist_filters", JSON.stringify({ search, filterDate, filterPlace, sortNewestFirst }));
  }, [search, filterDate, filterPlace, sortNewestFirst]);

  useEffect(() => {
    if (showSuccess) { const t = setTimeout(() => setShowSuccess(false), 1500); return () => clearTimeout(t); }
  }, [showSuccess]);

  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(""), 2000); return () => clearTimeout(t); }
  }, [error]);

  const confirmDelete = () => {
    if (!orderToDelete) return;
    fetch(`${import.meta.env.VITE_API_URL}/orders/${orderToDelete}`, { method: "DELETE" })
      .then(res => { if (!res.ok) throw new Error("Error deleting"); setOrders(prev => prev.filter(o => o.id !== orderToDelete)); setOrderToDelete(null); setShowConfirm(false); })
      .catch(err => { console.error("Delete error:", err); setError("Error eliminant la comanda."); setShowConfirm(false); });
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

  const handleDelete = (orderId) => { setShowConfirm(true); setOrderToDelete(orderId); };

  const filteredOrders = orders
    .filter(order => {
      const matchesName = order.customer.toLowerCase().includes(search.toLowerCase());
      const matchesDate = filterDate === "" || order.date === filterDate;
      const matchesPlace = filterPlace === "Tots els llocs" || order.place === filterPlace;
      return matchesName && matchesDate && matchesPlace;
    })
    .filter(order => !hidePicked || (order.status !== "picked_up" && order.status !== "cancelled"))
    .sort((a, b) => sortNewestFirst ? new Date(b.created_at) - new Date(a.created_at) : new Date(a.created_at) - new Date(b.created_at));

  const fruitSummary = { pressecs: {}, pressecsGrouped: {}, albercoc: { "1": [], "2": [] }, cirera: { "1": [], "2": [] }, melo: [], sindria: [] };
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
      if ((fruit === "albercoc" || fruit === "cirera") && (weight === 1 || weight === 2)) fruitSummary[fruit][weight].push({ customer, qty });
      if (fruit === "melo") fruitSummary.melo.push({ customer, qty });
      if (fruit === "sindria") fruitSummary.sindria.push({ customer, qty });
    }
  }

  return (
    <>
      <AnimatePresence>
        {showSuccess && (
          <motion.div key="success" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
            className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="popup-message success">{successMessage}</div>
          </motion.div>
        )}
        {error && (
          <motion.div key="error" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
            className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="popup-message error">{error}</div>
          </motion.div>
        )}
        {sortMessage && (
          <motion.div key="sort" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
            className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="popup-message info">{sortMessage}</div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-screen" style={{ backgroundColor: "#FAFAF5" }}>
        <div className="max-w-md mx-auto px-4 pt-6 pb-10">

          <div className="flex items-center gap-3 mb-6">
            <img src="/logopressec1.png" alt="Logo" className="h-12 w-12 object-contain" />
            <div>
              <h1 className="text-lg font-bold text-stone-900 leading-tight">Família Esteve Ràfols</h1>
            </div>
          </div>

          <button
            onClick={() => navigate("/add", { state: { prefillDate: addDays(today, 7), returnPath: "/" } })}
            className="w-full py-3 rounded-xl mb-2 flex items-center justify-center font-semibold text-white shadow-md transition-all active:scale-95"
            style={{ backgroundColor: "#F59E0B" }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = "#D97706"}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = "#F59E0B"}
          >
            <Plus className="w-5 h-5 mr-2" /> Afegir Comanda
          </button>

          <button
            onClick={() => navigate("/picking")}
            className="w-full py-2.5 rounded-xl mb-4 flex items-center justify-center font-semibold text-stone-700 bg-white border border-stone-200 shadow-sm hover:bg-stone-50 transition-all active:scale-95 gap-2 text-sm"
          >
            <ClipboardList className="w-4 h-4 text-stone-500" />
            Llista de Recollida
          </button>

          <div className="mb-3">
            <input
              type="text"
              placeholder="Busca un client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2.5 border rounded-xl bg-white text-stone-800 placeholder-stone-400 shadow-sm focus:outline-none transition-all"
              style={{ borderColor: "#E7E5E4" }}
              onFocus={e => e.target.style.borderColor = "#F59E0B"}
              onBlur={e => e.target.style.borderColor = "#E7E5E4"}
            />
          </div>

          <div className="flex items-center gap-1.5 mb-3">
            <button onClick={() => setFilterDate(prev => prev ? addDays(prev, -1) : today)}
              className="p-2.5 rounded-xl bg-white border border-stone-200 hover:bg-stone-50 shadow-sm text-stone-600 leading-none text-lg font-medium transition-colors">
              &lsaquo;
            </button>
            <div className="relative flex-1">
              <button onClick={() => document.getElementById("date-picker").showPicker?.()}
                className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl shadow-sm text-sm font-semibold text-stone-700 text-center hover:bg-stone-50 transition-colors">
                {filterDate ? getDateLabel(filterDate) : "Totes les dates"}
              </button>
              <input id="date-picker" type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
                className="absolute inset-0 opacity-0 w-full cursor-pointer" />
            </div>
            <button onClick={() => setFilterDate(prev => prev ? addDays(prev, 1) : today)}
              className="p-2.5 rounded-xl bg-white border border-stone-200 hover:bg-stone-50 shadow-sm text-stone-600 leading-none text-lg font-medium transition-colors">
              &rsaquo;
            </button>
          </div>
          {/* Lloc filter */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3" style={{ scrollbarWidth: "none" }}>
            {["Tots els llocs", "Sant Pau", "La Girada", "Cantallops", "El Pla", "Puigdalber"].map(place => (
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
          <div className="flex gap-2 mb-5">
            <button onClick={() => setShowSummary(true)}
              className="flex-1 bg-white border border-stone-200 text-stone-700 px-3 py-2.5 rounded-xl flex items-center justify-center shadow-sm hover:bg-stone-50 text-sm font-medium transition-colors gap-1.5">
              <Package className="w-4 h-4" style={{ color: "#F59E0B" }} /> Resum
            </button>
            <button onClick={handleExport}
              className="flex-1 bg-white border border-stone-200 text-stone-700 px-3 py-2.5 rounded-xl flex items-center justify-center shadow-sm hover:bg-stone-50 text-sm font-medium transition-colors gap-1.5">
              <Sheet className="w-4 h-4 text-emerald-500" /> Exportar
            </button>
            <button
              onClick={() => { setSortNewestFirst(prev => !prev); setSortMessage(sortNewestFirst ? "Mes antics primer" : "Mes nous primer"); }}
              className="bg-white border border-stone-200 text-stone-600 px-3 py-2.5 rounded-xl flex items-center shadow-sm hover:bg-stone-50 transition-colors"
              title="Canviar ordre">
              {sortNewestFirst ? <ClockArrowDown className="w-4 h-4" /> : <ClockArrowUp className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setHidePicked(prev => !prev)}
              className="px-3 py-2.5 rounded-xl border text-xs font-semibold shadow-sm transition-colors"
              style={hidePicked
                ? { backgroundColor: "#F59E0B", borderColor: "#F59E0B", color: "#1c1917" }
                : { backgroundColor: "white", borderColor: "#E7E5E4", color: "#78716C" }
              }
              title={hidePicked ? "Mostrar totes" : "Amagar recollides"}
            >
              {hidePicked ? "Pendents" : "Totes"}
            </button>
          </div>

          <AnimatePresence>
            {showSummary && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 flex items-center justify-center z-50 p-4"
                style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
                onClick={e => { if (e.target === e.currentTarget) setShowSummary(false); }}>
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl">
                  <div className="sticky top-0 bg-white border-b border-stone-100 px-5 py-4 rounded-t-2xl flex items-center justify-between">
                    <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                      <Package className="w-4 h-4" style={{ color: "#F59E0B" }} />
                      Resum
                      {filterPlace !== "Tots els llocs" && <span className="text-stone-500 font-normal">&middot; {filterPlace}</span>}
                      {filterDate && <span className="text-stone-500 font-normal">&middot; {formatDate(filterDate)}</span>}
                    </h2>
                    <button onClick={() => setShowSummary(false)}
                      className="w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors text-lg">
                      &times;
                    </button>
                  </div>
                  <div className="px-5 py-4 space-y-4 text-sm text-stone-700">
                    {Object.keys(fruitSummary.pressecsGrouped).length > 0 && (
                      <div>
                        <div className="font-semibold text-stone-900 mb-2">Pressecs</div>
                        {Object.entries(fruitSummary.pressecsGrouped).map(([type, sizes]) => {
                          let typeTotal = 0;
                          return (
                            <div key={type} className="ml-3 mb-3">
                              <div className="font-medium capitalize text-stone-800 mb-1">{type}</div>
                              {Object.entries(sizes).sort(([a],[b])=>parseInt(a)-parseInt(b)).map(([size, list]) => {
                                const subtotal = list.reduce((sum,x)=>sum+x.qty,0);
                                typeTotal += subtotal;
                                return (
                                  <details key={size} className="ml-3 mb-1">
                                    <summary className="cursor-pointer text-stone-600 hover:text-stone-900 select-none">
                                      Cal.{size}: <strong>{subtotal}</strong> {subtotal===1?"caixa":"caixes"}
                                    </summary>
                                    <ul className="ml-4 mt-1 space-y-0.5 text-stone-500 list-disc">
                                      {list.map((entry,i) => <li key={i}>{entry.qty}x {entry.customer}</li>)}
                                    </ul>
                                  </details>
                                );
                              })}
                              <div className="ml-3 text-xs font-semibold text-stone-400 mt-1">Total {type}: {typeTotal} {typeTotal===1?"caixa":"caixes"}</div>
                            </div>
                          );
                        })}
                        {(() => {
                          const t = Object.values(fruitSummary.pressecs).flat().reduce((acc,x)=>acc+x.qty,0);
                          return <div className="font-bold text-stone-800 border-t border-stone-100 pt-2">Total pressecs: {t} {t===1?"caixa":"caixes"}</div>;
                        })()}
                      </div>
                    )}
                    {["albercoc","cirera"].map(fruit => {
                      const l1=fruitSummary[fruit]["1"], l2=fruitSummary[fruit]["2"];
                      const t1=l1.reduce((a,x)=>a+x.qty,0), t2=l2.reduce((a,x)=>a+x.qty,0);
                      if (!l1.length && !l2.length) return null;
                      return (
                        <div key={fruit}>
                          <div className="font-semibold text-stone-900 mb-2">{capitalize(fruit)}</div>
                          {l1.length>0 && <details className="ml-3 mb-1"><summary className="cursor-pointer text-stone-600 hover:text-stone-900 select-none">Tarrina (1kg): <strong>{t1}</strong></summary><ul className="ml-4 mt-1 space-y-0.5 text-stone-500 list-disc">{l1.map((e,i)=><li key={i}>{e.qty}x {e.customer}</li>)}</ul></details>}
                          {l2.length>0 && <details className="ml-3 mb-1"><summary className="cursor-pointer text-stone-600 hover:text-stone-900 select-none">Caixa (2kg): <strong>{t2}</strong></summary><ul className="ml-4 mt-1 space-y-0.5 text-stone-500 list-disc">{l2.map((e,i)=><li key={i}>{e.qty}x {e.customer}</li>)}</ul></details>}
                        </div>
                      );
                    })}
                    {["melo","sindria"].map(fruit => (
                      fruitSummary[fruit].length>0 && (
                        <div key={fruit}>
                          <div className="font-semibold text-stone-900 mb-2">{capitalize(fruit)}</div>
                          <details className="ml-3 mb-1">
                            <summary className="cursor-pointer text-stone-600 hover:text-stone-900 select-none">
                              {(() => { const t=fruitSummary[fruit].reduce((a,x)=>a+x.qty,0); return <><strong>{t}</strong> {t===1?"peca":"peces"}</>; })()}
                            </summary>
                            <ul className="ml-4 mt-1 space-y-0.5 text-stone-500 list-disc">{fruitSummary[fruit].map((e,i)=><li key={i}>{e.qty}x {e.customer}</li>)}</ul>
                          </details>
                        </div>
                      )
                    ))}
                    {!Object.keys(fruitSummary.pressecsGrouped).length && !fruitSummary.albercoc["1"].length && !fruitSummary.albercoc["2"].length && !fruitSummary.cirera["1"].length && !fruitSummary.cirera["2"].length && !fruitSummary.melo.length && !fruitSummary.sindria.length && (
                      <div className="text-center text-stone-400 py-6">Cap fruita per mostrar</div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

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
                {filteredOrders.map((order) => (
                  <motion.div
                    key={order.id} layout
                    initial={{ opacity: 0, y: sortNewestFirst ? 16 : -16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 80, damping: 15 }}
                    className="bg-white rounded-2xl shadow-sm mb-3 overflow-hidden"
                    style={{ border: "1px solid #F5F5F4", borderLeft: `4px solid ${(STATUS_CONFIG[order.status] || STATUS_CONFIG.pending).color}` }}
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="font-bold text-stone-900 text-base leading-tight">{order.customer}</span>
                        <span className="text-xs text-stone-400 whitespace-nowrap mt-0.5 shrink-0">{formatFullDate(order.created_at)}</span>
                      </div>
                      <div className="space-y-0.5 mb-2">
                        {order.fruits.map((fruit, idx) => (
                          <div key={idx} className="text-sm text-stone-600">{renderFruitDetails(fruit)}</div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
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
                        <div className="mb-3 text-xs text-stone-500 italic bg-stone-50 rounded-lg px-3 py-2 border border-stone-100">{order.notes.trim()}</div>
                      )}
                      <div className="flex gap-2">
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
                              onClick={() => handleStatusUpdate(order.id, s.next)}
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
                        <button onClick={() => handleDelete(order.id)}
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

          <AnimatePresence>
            {showConfirm && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 flex items-center justify-center z-50 p-4"
                style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                  <div className="flex flex-col items-center text-center mb-5">
                    <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-3">
                      <Trash2 className="w-6 h-6 text-red-400" />
                    </div>
                    <h3 className="font-bold text-stone-900 mb-1">Eliminar comanda</h3>
                    <p className="text-sm text-stone-500">Segur que vols esborrar aquesta comanda?</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => { setShowConfirm(false); setOrderToDelete(null); }}
                      className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium text-sm transition-colors">
                      Cancel
                    </button>
                    <button onClick={confirmDelete}
                      className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition-colors">
                      Esborrar
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </>
  );
}

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
  if (item.fruit === "melo") return `Melo: ${item.qty} peces${item.weight ? ` - ${item.weight} kg` : ""}`;
  if (item.fruit === "sindria") return `Sindria: ${item.qty} peces${item.weight ? ` - ${item.weight} kg` : ""}`;
  return `${capitalize(item.fruit)}: ${item.qty}`;
}

function formatDate(dateStr) {
  const [yyyy, mm, dd] = dateStr.split("-");
  return `${dd}/${mm}`;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default OrderListPage;
