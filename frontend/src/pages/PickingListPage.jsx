import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, X, ChevronLeft, ChevronRight, ChevronDown, ArrowUp, Package } from "lucide-react";
import { renderFruitLabel, renderFruitDetails, PLACES, getPlacesForDate } from "../utils/fruit";
import PickupToast from "../components/PickupToast";

const FRUIT_EMOJI = {
  pressec_groc: "🍑", pressec_barrejat: "🍑", pressec_vermell: "🍑",
  albercoc: "🟠", cirera: "🍒", melo: "🍈", sindria: "🍉",
};

const DIES = ["Diumenge","Dilluns","Dimarts","Dimecres","Dijous","Divendres","Dissabte"];

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const result = new Date(Date.UTC(y, m - 1, d + n));
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth()+1).padStart(2,'0')}-${String(result.getUTCDate()).padStart(2,'0')}`;
}

function getShortDateLabel(dateStr) {
  if (!dateStr) return "Totes les dates";
  const [, m, d] = dateStr.split("-");
  const date = new Date(dateStr + "T00:00:00");
  return `${DIES[date.getDay()]} ${parseInt(d)}/${m}`;
}

function getFullDateLabel(dateStr) {
  if (!dateStr) return "Totes les dates";
  const t = new Date().toLocaleDateString('sv', { timeZone: 'Europe/Madrid' });
  const tm = addDays(t, 1);
  const yd = addDays(t, -1);
  const short = getShortDateLabel(dateStr);
  if (dateStr === t)  return `Avui · ${short}`;
  if (dateStr === tm) return `Demà · ${short}`;
  if (dateStr === yd) return `Ahir · ${short}`;
  return short;
}

const today = new Date().toLocaleDateString('sv', { timeZone: 'Europe/Madrid' });

export default function PickingListPage() {
  const navigate = useNavigate();

  const [filterDate, setFilterDate] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("pick_filters") || "{}").filterDate ?? today; } catch { return today; }
  });
  const [filterPlace, setFilterPlace] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("pick_filters") || "{}").filterPlace ?? ""; } catch { return ""; }
  });
  const [hideDone, setHideDone] = useState(() => {
    try {
      const v = JSON.parse(sessionStorage.getItem("pick_filters") || "{}").hideDone;
      return v !== undefined ? v : true;
    } catch { return true; }
  });

  const [search, setSearch]             = useState("");
  const [orders, setOrders]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState("");
  const [showContextModal, setShowContextModal] = useState(false);
  const [showSummary, setShowSummary]   = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const [pendingPickup, setPendingPickup] = useState(null);
  const pickupTimerRef = useRef(null);

  // ── Auto-select valid place for the current date ──────────────────────────

  useEffect(() => {
    const available = getPlacesForDate(filterDate);
    if (!available.includes(filterPlace)) {
      setFilterPlace(available[0]);
    }
  }, [filterDate]);

  // ── Persist filters ───────────────────────────────────────────────────────

  useEffect(() => {
    sessionStorage.setItem("pick_filters", JSON.stringify({ filterDate, filterPlace, hideDone }));
  }, [filterDate, filterPlace, hideDone]);

  // ── Fetch orders ──────────────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterDate)  params.set("date",  filterDate);
    if (filterPlace) params.set("place", filterPlace);
    fetch(`${import.meta.env.VITE_API_URL}/orders?${params}`)
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(data => { setOrders(data.filter(o => o.status !== "cancelled")); setLoading(false); })
      .catch(() => { setError("Error carregant comandes."); setLoading(false); });
  }, [filterDate, filterPlace]);

  // ── Scroll tracking ───────────────────────────────────────────────────────

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 180);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => { if (pickupTimerRef.current) clearTimeout(pickupTimerRef.current); };
  }, []);

  // ── Grouping ──────────────────────────────────────────────────────────────

  const grouped = {};
  for (const order of orders) {
    if (!grouped[order.customer]) grouped[order.customer] = [];
    grouped[order.customer].push(order);
  }
  const customers = Object.keys(grouped).sort();

  const visibleCustomers = customers.filter(c => {
    if (search && !c.toLowerCase().includes(search.toLowerCase())) return false;
    if (hideDone) {
      const allPickedUp = grouped[c].every(o => o.status === "picked_up");
      const hasPending = pendingPickup && grouped[c].some(o => pendingPickup.orderIds?.includes(o.id));
      return !allPickedUp || hasPending;
    }
    return true;
  });

  const totalCount     = customers.length;
  const deliveredCount = customers.filter(c => grouped[c].every(o => o.status === "picked_up")).length;
  const progressPct    = totalCount > 0 ? (deliveredCount / totalCount) * 100 : 0;

  // ── Pending summary ───────────────────────────────────────────────────────

  const pendingSummary = (() => {
    const pending = orders.filter(o => o.status !== "picked_up");
    const groups = {};
    const orderSeen = [];
    for (const order of pending) {
      for (const f of order.fruits) {
        if (!groups[f.fruit]) { groups[f.fruit] = []; orderSeen.push(f.fruit); }
        groups[f.fruit].push(f);
      }
    }
    return { groups, orderSeen };
  })();

  // ── Pickup handlers ───────────────────────────────────────────────────────

  const confirmPickupApi = (orderIds) => {
    Promise.all(orderIds.map(id =>
      fetch(`${import.meta.env.VITE_API_URL}/orders/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "picked_up" }),
      })
    ))
      .then(() => setOrders(prev => prev.map(o =>
        orderIds.includes(o.id) ? { ...o, status: "picked_up" } : o
      )))
      .catch(() => setError("Error en guardar."));
  };

  const handleMarkCustomerPickedUp = (cust) => {
    const orderIds = grouped[cust].filter(o => o.status !== "picked_up").map(o => o.id);
    if (!orderIds.length) return;

    if (pickupTimerRef.current) {
      clearTimeout(pickupTimerRef.current);
      if (pendingPickup) confirmPickupApi(pendingPickup.orderIds);
    }

    pickupTimerRef.current = setTimeout(() => {
      confirmPickupApi(orderIds);
      setPendingPickup(null);
      pickupTimerRef.current = null;
    }, 3000);

    const firstOrder = grouped[cust][0];
    setPendingPickup({
      id: Date.now(),
      orderIds,
      customerName: cust,
      message: "Marcat com a recollit",
      firstCustPlace: firstOrder?.place || filterPlace,
      firstCustDate:  firstOrder?.date  || filterDate,
    });
  };

  const handleUndoPickup = () => {
    clearTimeout(pickupTimerRef.current);
    pickupTimerRef.current = null;
    setPendingPickup(null);
  };

  const handleNewOrderSameName = () => {
    clearTimeout(pickupTimerRef.current);
    pickupTimerRef.current = null;
    if (!pendingPickup) return;
    confirmPickupApi(pendingPickup.orderIds);
    const { customerName, firstCustPlace, firstCustDate } = pendingPickup;
    setPendingPickup(null);
    navigate('/add', {
      state: { prefillCustomer: customerName, prefillPlace: firstCustPlace, prefillDate: firstCustDate, returnPath: '/picking' },
    });
  };

  const handleNewOrder = () => {
    navigate("/add", { state: { prefillPlace: filterPlace, prefillDate: filterDate, returnPath: "/picking" } });
  };

  const availablePlaces = getPlacesForDate(filterDate);
  const contextLabel    = `${getShortDateLabel(filterDate)}${filterPlace ? ` · ${filterPlace}` : ""}`;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FAFAF5" }}>

      {/* ── Fixed header ── */}
      <div className="no-print fixed top-0 inset-x-0 z-40 bg-white border-b border-stone-200 shadow-sm">
        <div className="max-w-lg mx-auto">

          {/* Row 1: Back + Context */}
          <div className="flex items-center gap-3 px-4 pt-3 pb-2">
            <button
              onClick={() => navigate("/")}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowContextModal(true)}
              className="flex-1 flex items-center gap-2 bg-stone-50 rounded-xl px-4 py-2.5 text-left hover:bg-stone-100 transition-colors border border-stone-200"
            >
              <span className="text-sm font-bold text-stone-900 flex-1 truncate">📍 {contextLabel}</span>
              <ChevronDown className="w-4 h-4 text-stone-400 flex-shrink-0" />
            </button>
          </div>

          {/* Row 2: Progress + Toggle */}
          <div className="px-4 pb-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-stone-500">
                Entregades: <span className="font-bold text-stone-700">{deliveredCount} / {totalCount}</span>
              </span>
              <div className="flex rounded-lg overflow-hidden border border-stone-200 text-xs font-semibold">
                <button
                  onClick={() => setHideDone(true)}
                  className={`px-3 py-1 transition-colors ${hideDone ? "bg-stone-800 text-white" : "text-stone-500 bg-white hover:bg-stone-50"}`}
                >
                  Pendents
                </button>
                <button
                  onClick={() => setHideDone(false)}
                  className={`px-3 py-1 transition-colors border-l border-stone-200 ${!hideDone ? "bg-stone-800 text-white" : "text-stone-500 bg-white hover:bg-stone-50"}`}
                >
                  Totes
                </button>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-400 transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          {/* Row 3: Search + Summary button */}
          <div className="px-4 pb-3 flex gap-2">
            <input
              type="text"
              placeholder="Busca un client..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 px-4 py-2 rounded-xl border border-stone-200 bg-stone-50 text-stone-800 placeholder-stone-400 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
            />
            <button
              onClick={() => setShowSummary(true)}
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 transition-colors flex-shrink-0"
              title="Resum de pendents"
            >
              <Package className="w-4.5 h-4.5 text-stone-500" style={{ width: 18, height: 18 }} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Print-only header ── */}
      <div className="hidden print:block px-4 pt-4 pb-3 border-b-2 border-black mb-2">
        <strong>Llista de Recollida · {contextLabel}</strong>
      </div>

      {/* ── Content ── */}
      <div className="max-w-lg mx-auto px-4 pb-24 print:pt-2" style={{ paddingTop: "176px" }}>
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16 text-stone-500">
            <div className="w-9 h-9 border-4 border-amber-200 border-t-amber-400 rounded-full animate-spin" />
            <span className="text-sm">Carregant...</span>
          </div>
        ) : error ? (
          <div className="text-center py-16 text-stone-500 text-sm">{error}</div>
        ) : visibleCustomers.length === 0 ? (
          <div className="text-center py-16 text-stone-500 text-sm">No hi ha comandes per mostrar</div>
        ) : (
          visibleCustomers.map(customer => {
            const custOrders  = grouped[customer];
            const allPickedUp = custOrders.every(o => o.status === "picked_up");
            const isPending   = !!(pendingPickup && custOrders.some(o => pendingPickup.orderIds?.includes(o.id)));

            return (
              <div
                key={customer}
                className={`bg-white rounded-2xl border mb-3 overflow-hidden shadow-sm print:shadow-none print:break-inside-avoid transition-all ${
                  allPickedUp ? "border-emerald-200" : isPending ? "border-amber-300" : "border-stone-200"
                }`}
              >
                <div className="p-4 pb-3">
                  <h2 className={`text-xl font-extrabold leading-tight mb-3 ${
                    allPickedUp ? "text-emerald-600 line-through decoration-emerald-300" : "text-stone-900"
                  }`}>
                    {customer}
                  </h2>
                  <div className="space-y-2.5">
                    {custOrders.flatMap((order, oi) =>
                      order.fruits.map((fruit, fi) => (
                        <div key={`${oi}-${fi}`} className="flex items-start gap-2.5">
                          <span className="text-lg flex-shrink-0 mt-0.5">{FRUIT_EMOJI[fruit.fruit] || "🍓"}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-stone-800 leading-snug">{renderFruitLabel(fruit)}</div>
                            <div className="text-xs text-stone-500 mt-0.5">{renderFruitDetails(fruit)}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <button
                  onClick={() => !allPickedUp && !isPending && handleMarkCustomerPickedUp(customer)}
                  disabled={allPickedUp || isPending}
                  className={`no-print w-full py-3.5 text-sm font-bold tracking-wide transition-all ${
                    allPickedUp   ? "bg-emerald-50 text-emerald-600 cursor-default"
                    : isPending   ? "bg-amber-50 text-amber-500 cursor-default"
                    : "bg-stone-900 text-white hover:bg-stone-700 active:scale-[0.99]"
                  }`}
                >
                  {allPickedUp ? "✓ ENTREGAT" : isPending ? "PENDENT DE CONFIRMAR…" : "MARCAR COM A ENTREGAT"}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* ── FAB: Scroll to top ── */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="no-print fixed bottom-20 left-4 w-11 h-11 rounded-full bg-white border border-stone-200 shadow-lg text-stone-600 flex items-center justify-center z-30 active:scale-95 transition-all hover:bg-stone-50"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      )}

      {/* ── FAB: Nova Comanda ── */}
      <button
        onClick={handleNewOrder}
        className="no-print fixed bottom-4 right-4 w-14 h-14 rounded-full text-white shadow-xl flex items-center justify-center z-30 transition-all active:scale-95 hover:brightness-110"
        style={{ backgroundColor: "#F59E0B" }}
        title={`Nova comanda${filterPlace ? ` — ${filterPlace}` : ""}`}
      >
        <Plus className="w-7 h-7" />
      </button>

      {/* ── Pickup undo toast ── */}
      <PickupToast
        pending={pendingPickup}
        onUndo={handleUndoPickup}
        onNewOrder={pendingPickup?.customerName ? handleNewOrderSameName : null}
      />

      {/* ── Pending summary modal ── */}
      {showSummary && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowSummary(false); }}
        >
          <div className="w-full max-w-lg bg-white rounded-t-3xl shadow-2xl flex flex-col" style={{ maxHeight: "80vh" }}>
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-stone-200" />
            </div>
            <div className="flex items-center justify-between px-5 py-2 flex-shrink-0">
              <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-500" /> Resum de Pendents
              </h2>
              <button onClick={() => setShowSummary(false)} className="w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 text-xl transition-colors">
                &times;
              </button>
            </div>
            <div className="px-5 pb-8 overflow-y-auto flex-1">
              {pendingSummary.orderSeen.length === 0 ? (
                <div className="text-center py-10 text-stone-400">
                  <div className="text-4xl mb-2">✓</div>
                  <p className="font-medium">Tot entregat!</p>
                </div>
              ) : (
                <PendingSummaryList groups={pendingSummary.groups} orderSeen={pendingSummary.orderSeen} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Context modal ── */}
      {showContextModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowContextModal(false); }}
        >
          <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-stone-900">Canviar context</h3>
              <button onClick={() => setShowContextModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <label className="block text-xs text-stone-400 uppercase tracking-wide font-medium mb-2">Data</label>
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setFilterDate(prev => addDays(prev || today, -1))} className="w-10 h-10 flex items-center justify-center rounded-xl border border-stone-200 hover:bg-stone-50 transition-colors flex-shrink-0">
                <ChevronLeft className="w-5 h-5 text-stone-600" />
              </button>
              <div className="flex-1 text-center font-semibold text-stone-900 text-sm">{getFullDateLabel(filterDate)}</div>
              <button onClick={() => setFilterDate(prev => addDays(prev || today, 1))} className="w-10 h-10 flex items-center justify-center rounded-xl border border-stone-200 hover:bg-stone-50 transition-colors flex-shrink-0">
                <ChevronRight className="w-5 h-5 text-stone-600" />
              </button>
            </div>

            <label className="block text-xs text-stone-400 uppercase tracking-wide font-medium mb-2">Lloc</label>
            <div className="flex flex-wrap gap-2">
              {availablePlaces.map(p => (
                <button
                  key={p}
                  onClick={() => setFilterPlace(p)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
                    filterPlace === p ? "bg-stone-900 text-white border-stone-900" : "bg-white text-stone-700 border-stone-300 hover:bg-stone-50"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Pending summary list component ────────────────────────────────────────────

function PendingSummaryList({ groups, orderSeen }) {
  return (
    <div className="space-y-4 pt-2">
      {orderSeen.map(fruitKey => {
        const items = groups[fruitKey];
        const emoji = { pressec_groc: "🍑", pressec_barrejat: "🍑", pressec_vermell: "🍑", albercoc: "🟠", cirera: "🍒", melo: "🍈", sindria: "🍉" }[fruitKey] || "🍓";

        if (fruitKey.startsWith("pressec_")) {
          const variant = fruitKey.split("_")[1];
          const label = `Pressec ${variant.charAt(0).toUpperCase() + variant.slice(1)}`;
          // Group by calibre
          const byCal = {};
          for (const it of items) {
            byCal[it.size] = (byCal[it.size] || 0) + it.qty;
          }
          const total = items.reduce((a, x) => a + x.qty, 0);
          return (
            <div key={fruitKey} className="bg-orange-50 rounded-2xl p-4 border border-orange-100">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-stone-900">{emoji} {label}</span>
                <span className="text-lg font-black text-amber-600">{total} <span className="text-xs font-semibold text-stone-500">{total === 1 ? "caixa" : "caixes"}</span></span>
              </div>
              <div className="space-y-1">
                {Object.entries(byCal).sort(([a],[b]) => Number(a)-Number(b)).map(([size, qty]) => (
                  <div key={size} className="flex justify-between text-sm text-stone-600">
                    <span>Cal. {size}</span>
                    <span className="font-semibold">{qty} {qty === 1 ? "caixa" : "caixes"}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        if (fruitKey === "albercoc" || fruitKey === "cirera") {
          const label = fruitKey === "albercoc" ? "Albercoc" : "Cirera";
          const by1 = items.filter(x => x.weight === 1).reduce((a, x) => a + x.qty, 0);
          const by2 = items.filter(x => x.weight === 2).reduce((a, x) => a + x.qty, 0);
          const kg  = by1 + by2 * 2;
          return (
            <div key={fruitKey} className="bg-yellow-50 rounded-2xl p-4 border border-yellow-100">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-stone-900">{emoji} {label}</span>
                <span className="text-lg font-black text-yellow-600">{kg} <span className="text-xs font-semibold text-stone-500">kg</span></span>
              </div>
              <div className="space-y-1">
                {by1 > 0 && <div className="flex justify-between text-sm text-stone-600"><span>Tarrines 1kg</span><span className="font-semibold">{by1} u</span></div>}
                {by2 > 0 && <div className="flex justify-between text-sm text-stone-600"><span>Caixes 2kg</span><span className="font-semibold">{by2} u</span></div>}
              </div>
            </div>
          );
        }

        if (fruitKey === "melo" || fruitKey === "sindria") {
          const label = fruitKey === "melo" ? "Meló" : "Síndria";
          const total = items.reduce((a, x) => a + x.qty, 0);
          return (
            <div key={fruitKey} className="bg-green-50 rounded-2xl p-4 border border-green-100">
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-900">{emoji} {label}</span>
                <span className="text-lg font-black text-green-700">{total} <span className="text-xs font-semibold text-stone-500">{total === 1 ? "peça" : "peces"}</span></span>
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
