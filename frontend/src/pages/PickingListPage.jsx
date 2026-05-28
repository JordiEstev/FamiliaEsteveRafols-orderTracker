import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Printer, CheckCheck, RotateCcw, Plus } from "lucide-react";
import { renderFruitLabel, renderFruitDetails, PLACES } from "../utils/fruit";
import PickupToast from "../components/PickupToast";
import "./PickingListPage.css";

const FRUIT_EMOJI = {
  pressec_groc: "🍑",
  pressec_barrejat: "🍑",
  pressec_vermell: "🍑",
  albercoc: "🟠",
  cirera: "🍒",
  melo: "🍈",
  sindria: "🍉",
};

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const result = new Date(Date.UTC(y, m - 1, d + n));
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth()+1).padStart(2,'0')}-${String(result.getUTCDate()).padStart(2,'0')}`;
}

const DIES = ["Diumenge","Dilluns","Dimarts","Dimecres","Dijous","Divendres","Dissabte"];

function getDateLabel(dateStr) {
  if (!dateStr) return "Totes les dates";
  const t  = new Date().toLocaleDateString('sv', { timeZone: 'Europe/Madrid' });
  const tm = addDays(t, 1);
  const yd = addDays(t, -1);
  if (dateStr === t)  return "Avui";
  if (dateStr === tm) return "Demà";
  if (dateStr === yd) return "Ahir";
  const [, m, d] = dateStr.split("-");
  const date = new Date(dateStr + "T00:00:00");
  return `${DIES[date.getDay()]} ${d}/${m}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
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
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");
  const [checked, setChecked] = useState(new Set());
  const [hideDone, setHideDone] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("pick_filters") || "{}").hideDone ?? false; } catch { return false; }
  });
  const [saving, setSaving] = useState(false);

  // Pickup-undo toast
  const [pendingPickup, setPendingPickup] = useState(null);
  const pickupTimerRef = useRef(null);

  useEffect(() => {
    sessionStorage.setItem("pick_filters", JSON.stringify({ filterDate, filterPlace, hideDone }));
  }, [filterDate, filterPlace, hideDone]);

  useEffect(() => {
    setLoading(true);
    setChecked(new Set());
    const params = new URLSearchParams();
    if (filterDate) params.set("date", filterDate);
    if (filterPlace) params.set("place", filterPlace);
    fetch(`${import.meta.env.VITE_API_URL}/orders?${params}`)
      .then(res => { if (!res.ok) throw new Error("error"); return res.json(); })
      .then(data => {
        setOrders(data.filter(o => o.status !== "cancelled"));
        setLoading(false);
      })
      .catch(() => { setError("Error carregant comandes."); setLoading(false); });
  }, [filterDate, filterPlace]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (pickupTimerRef.current) clearTimeout(pickupTimerRef.current); };
  }, []);

  // ── Grouping & derived state ───────────────────────────────────────────────

  const grouped = {};
  for (const order of orders) {
    if (!grouped[order.customer]) grouped[order.customer] = [];
    grouped[order.customer].push(order);
  }
  const customers = Object.keys(grouped).sort();

  const itemKey = (orderId, idx) => `${orderId}-${idx}`;

  const allKeysForCustomer = (cust) =>
    grouped[cust].flatMap(order =>
      order.fruits.map((_, idx) => itemKey(order.id, idx))
    );

  const isCustomerDone = useCallback((cust) => {
    const keys = allKeysForCustomer(cust);
    return keys.length > 0 && keys.every(k => checked.has(k));
  }, [checked, grouped]);

  const visibleCustomers = hideDone
    ? customers.filter(c => {
        const allPickedUp = grouped[c].every(o => o.status === "picked_up");
        return !isCustomerDone(c) && !allPickedUp;
      })
    : customers;

  // ── Checkbox toggles ───────────────────────────────────────────────────────

  const toggleItem = (key) => {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleCustomer = (cust) => {
    const keys = allKeysForCustomer(cust);
    const done = keys.every(k => checked.has(k));
    setChecked(prev => {
      const next = new Set(prev);
      keys.forEach(k => done ? next.delete(k) : next.add(k));
      return next;
    });
  };

  const toggleAll = () => {
    const allKeys = visibleCustomers.flatMap(c => allKeysForCustomer(c));
    const allDone = allKeys.every(k => checked.has(k));
    setChecked(prev => {
      const next = new Set(prev);
      allKeys.forEach(k => allDone ? next.delete(k) : next.add(k));
      return next;
    });
  };

  // ── Pickup with undo toast ─────────────────────────────────────────────────

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

  const applyPickups = () => {
    const orderIds = [];
    const customerNames = [];
    for (const cust of customers) {
      if (!isCustomerDone(cust)) continue;
      customerNames.push(cust);
      for (const order of grouped[cust]) {
        if (order.status !== "picked_up") orderIds.push(order.id);
      }
    }
    if (!orderIds.length) return;

    // Replace any existing pending confirm
    if (pickupTimerRef.current) clearTimeout(pickupTimerRef.current);

    pickupTimerRef.current = setTimeout(() => {
      confirmPickupApi(orderIds);
      setPendingPickup(null);
      pickupTimerRef.current = null;
    }, 5000);

    const singleCustomer = customerNames.length === 1 ? customerNames[0] : null;
    const firstCustOrders = singleCustomer ? (grouped[singleCustomer] || []) : [];

    setPendingPickup({
      id: Date.now(),
      orderIds,
      customerName: singleCustomer,
      message: customerNames.length === 1
        ? "Marcat com a recollit"
        : `${customerNames.length} clients marcats com a recollits`,
      firstCustPlace: firstCustOrders[0]?.place || filterPlace,
      firstCustDate:  firstCustOrders[0]?.date  || filterDate,
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
      state: {
        prefillCustomer: customerName,
        prefillPlace:    firstCustPlace,
        prefillDate:     firstCustDate,
        returnPath:      '/picking',
      },
    });
  };

  const handleNewOrder = () => {
    navigate("/add", { state: { prefillPlace: filterPlace, prefillDate: filterDate, returnPath: "/picking" } });
  };

  // ── Derived counts ──────────────────────────────────────────────────────────

  const checkedCount = visibleCustomers.filter(c =>
    isCustomerDone(c) || grouped[c].every(o => o.status === "picked_up")
  ).length;
  const confirmableCount = visibleCustomers.filter(c =>
    isCustomerDone(c) && !grouped[c].every(o => o.status === "picked_up")
  ).length;
  const totalCount = visibleCustomers.length;

  const printTitle = [
    "Llista de Recollida",
    filterPlace || null,
    filterDate ? getDateLabel(filterDate) : null,
  ].filter(Boolean).join(" · ");

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="picking-root">
      {/* ── Screen header ── */}
      <div className="no-print picking-header">
        <div className="picking-header-left">
          <button onClick={() => navigate("/")} className="picking-back-btn">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="picking-title">Llista de Recollida</h1>
            <p className="picking-subtitle">{checkedCount}/{totalCount} clients marcats</p>
          </div>
        </div>
        <div className="picking-header-right">
          <button onClick={() => window.print()} className="picking-btn picking-btn-ghost">
            <Printer className="w-4 h-4" />
            <span>Imprimir</span>
          </button>
          <button
            onClick={applyPickups}
            disabled={saving || confirmableCount === 0}
            className="picking-btn picking-btn-primary"
          >
            <CheckCheck className="w-4 h-4" />
            <span>{saving ? "Guardant..." : "Confirmar"}</span>
          </button>
        </div>
      </div>

      {/* ── Date navigation ── */}
      <div className="no-print picking-date-nav">
        <button onClick={() => setFilterDate(prev => addDays(prev || today, -1))} className="picking-arrow">&#8249;</button>
        <div className="relative" style={{ flex: 1 }}>
          <button onClick={() => document.getElementById("pick-date").showPicker?.()} className="picking-date-btn">
            {filterDate ? getDateLabel(filterDate) : "Totes les dates"}
          </button>
          <input
            id="pick-date"
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            className="absolute opacity-0 pointer-events-none"
            style={{ top: 0, left: 0, width: "1px", height: "1px" }}
          />
        </div>
        <button onClick={() => setFilterDate(prev => addDays(prev || today, 1))} className="picking-arrow">&#8250;</button>
        <button
          onClick={() => setHideDone(p => !p)}
          className={"picking-toggle " + (hideDone ? "picking-toggle-on" : "picking-toggle-off")}
        >
          {hideDone ? "Pendents" : "Totes"}
        </button>
        <button onClick={toggleAll} className="picking-btn-sm picking-btn-ghost no-print">
          <RotateCcw className="w-3.5 h-3.5" />
          Sel. tot
        </button>
      </div>

      {/* ── Place chips ── */}
      <div className="no-print picking-place-row">
        <button
          onClick={() => setFilterPlace("")}
          className={"picking-place-chip " + (!filterPlace ? "picking-place-chip-on" : "")}
        >
          Tots els llocs
        </button>
        {PLACES.map(p => (
          <button
            key={p}
            onClick={() => setFilterPlace(prev => prev === p ? "" : p)}
            className={"picking-place-chip " + (filterPlace === p ? "picking-place-chip-on" : "")}
          >
            {p}
          </button>
        ))}
      </div>

      {/* ── Print header ── */}
      <div className="print-only picking-print-header">
        <strong>{printTitle}</strong>
      </div>

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

      {/* ── Content ── */}
      <div className="picking-content" style={{ paddingBottom: '5rem' }}>
        {loading ? (
          <div className="picking-loading">
            <div className="picking-spinner"></div>
            <span>Carregant...</span>
          </div>
        ) : error ? (
          <div className="picking-empty">{error}</div>
        ) : visibleCustomers.length === 0 ? (
          <div className="picking-empty">No hi ha comandes per mostrar</div>
        ) : (
          visibleCustomers.map(customer => {
            const custOrders = grouped[customer];
            const allPickedUp = custOrders.every(o => o.status === "picked_up");
            const done = isCustomerDone(customer) || allPickedUp;
            const allKeys = allKeysForCustomer(customer);
            const checkedKeys = allKeys.filter(k => checked.has(k));
            const partiallyDone = checkedKeys.length > 0 && !done;

            return (
              <div key={customer} className={"picking-card " + (done ? "picking-card-done" : "")}>
                <div className="picking-customer-header" onClick={() => toggleCustomer(customer)}>
                  <div className={"picking-checkbox picking-checkbox-lg " +
                    (done ? "picking-checkbox-checked" : partiallyDone ? "picking-checkbox-partial" : "")
                  }>
                    {done && <span className="picking-check-icon">&#10003;</span>}
                    {partiallyDone && <span className="picking-check-icon picking-dash">&#8722;</span>}
                  </div>
                  <div className="picking-customer-info">
                    <span className="picking-customer-name">{customer}</span>
                    <span className="picking-customer-meta">
                      {[...new Set(custOrders.map(o => o.place))].join(" · ")}
                      {" · "}
                      {formatDate(custOrders[0].date)}
                      {allPickedUp && (
                        <span className="picking-status-tag">Recollit</span>
                      )}
                      {custOrders.some(o => o.status === "ready") && !allPickedUp && (
                        <span className="picking-status-tag picking-status-ready">Preparat</span>
                      )}
                    </span>
                  </div>
                  <span className="picking-item-count no-print">
                    {done ? allKeys.length : checkedKeys.length}/{allKeys.length}
                  </span>
                </div>

                <div className="picking-items">
                  {custOrders.map(order =>
                    order.fruits.map((fruit, idx) => {
                      const key = itemKey(order.id, idx);
                      const isChecked = checked.has(key);
                      return (
                        <div
                          key={key}
                          className={"picking-item " + (isChecked ? "picking-item-done" : "")}
                          onClick={() => toggleItem(key)}
                        >
                          <div className={"picking-checkbox " + (isChecked ? "picking-checkbox-checked" : "")}>
                            {isChecked && <span className="picking-check-icon">&#10003;</span>}
                          </div>
                          <span className="picking-fruit-emoji">{FRUIT_EMOJI[fruit.fruit] || "🍓"}</span>
                          <div className="picking-fruit-text">
                            <span className="picking-fruit-name">{renderFruitLabel(fruit)}</span>
                            <span className="picking-fruit-detail">{renderFruitDetails(fruit)}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
