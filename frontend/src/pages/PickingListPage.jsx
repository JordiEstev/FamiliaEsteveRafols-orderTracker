import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Printer, CheckCheck, RotateCcw, Plus } from "lucide-react";
import { renderFruitLabel, renderFruitDetails, PLACES } from "../utils/fruit";
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
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function getDateLabel(dateStr) {
  const t = new Date().toISOString().split("T")[0];
  const tm = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const yd = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  if (dateStr === t) return "Avui";
  if (dateStr === tm) return "Dema";
  if (dateStr === yd) return "Ahir";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

const today = new Date().toISOString().split("T")[0];

export default function PickingListPage() {
  const navigate = useNavigate();
  const [filterDate, setFilterDate] = useState(() => addDays(today, 7));
  const [filterPlace, setFilterPlace] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("pick_filters") || "{}").filterPlace ?? ""; } catch { return ""; }
  });
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState(new Set());
  const [hideDone, setHideDone] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("pick_filters") || "{}").hideDone ?? false; } catch { return false; }
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    sessionStorage.setItem("pick_filters", JSON.stringify({ filterPlace, hideDone }));
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

  const grouped = {};
  for (const order of orders) {
    if (!grouped[order.customer]) grouped[order.customer] = [];
    grouped[order.customer].push(order);
  }
  const customers = Object.keys(grouped).sort();

  const visibleCustomers = hideDone
    ? customers.filter(c => !grouped[c].every(o => o.status === "picked_up"))
    : customers;

  const itemKey = (orderId, idx) => `${orderId}-${idx}`;

  const allKeysForCustomer = (cust) =>
    grouped[cust].flatMap(order =>
      order.fruits.map((_, idx) => itemKey(order.id, idx))
    );

  const isCustomerDone = useCallback((cust) => {
    const keys = allKeysForCustomer(cust);
    return keys.length > 0 && keys.every(k => checked.has(k));
  }, [checked, grouped]);

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

  const applyPickups = async () => {
    const orderIds = [];
    for (const cust of customers) {
      if (!isCustomerDone(cust)) continue;
      for (const order of grouped[cust]) {
        if (order.status !== "picked_up") orderIds.push(order.id);
      }
    }
    if (!orderIds.length) return;
    setSaving(true);
    try {
      await Promise.all(orderIds.map(id =>
        fetch(`${import.meta.env.VITE_API_URL}/orders/${id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "picked_up" }),
        })
      ));
      setOrders(prev => prev.map(o =>
        orderIds.includes(o.id) ? { ...o, status: "picked_up" } : o
      ));
      setSaveMsg(`${orderIds.length} comanda${orderIds.length > 1 ? "es" : ""} marcada${orderIds.length > 1 ? "es" : ""} com a recollides`);
      setTimeout(() => setSaveMsg(""), 3000);
    } catch {
      setSaveMsg("Error en guardar.");
    } finally {
      setSaving(false);
    }
  };

  const handleNewOrder = () => {
    navigate("/add", { state: { prefillPlace: filterPlace, prefillDate: filterDate, returnPath: "/picking" } });
  };

  const checkedCount = visibleCustomers.filter(c => isCustomerDone(c)).length;
  const totalCount = visibleCustomers.length;

  const printTitle = [
    "Llista de Recollida",
    filterPlace || null,
    filterDate ? getDateLabel(filterDate) : null,
  ].filter(Boolean).join(" · ");

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
            disabled={saving || checkedCount === 0}
            className="picking-btn picking-btn-primary"
          >
            <CheckCheck className="w-4 h-4" />
            <span>{saving ? "Guardant..." : "Confirmar"}</span>
          </button>
        </div>
      </div>

      {/* ── Date navigation ── */}
      <div className="no-print picking-date-nav">
        <button onClick={() => setFilterDate(prev => addDays(prev, -1))} className="picking-arrow">&#8249;</button>
        <div className="relative">
          <button onClick={() => document.getElementById("pick-date").showPicker?.()} className="picking-date-btn">
            {getDateLabel(filterDate)}
          </button>
          <input id="pick-date" type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer" />
        </div>
        <button onClick={() => setFilterDate(prev => addDays(prev, 1))} className="picking-arrow">&#8250;</button>
        <div className="picking-date-nav-spacer" />
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

      {/* ── Nova Comanda ── */}
      <div className="no-print picking-new-order-row">
        <button onClick={handleNewOrder} className="picking-new-order-btn">
          <Plus className="w-4 h-4" />
          Nova comanda{filterPlace ? ` — ${filterPlace}` : ""}
        </button>
      </div>

      {/* ── Save message ── */}
      {saveMsg && (
        <div className="no-print picking-save-msg">{saveMsg}</div>
      )}

      {/* ── Print header ── */}
      <div className="print-only picking-print-header">
        <strong>{printTitle}</strong>
      </div>

      {/* ── Content ── */}
      <div className="picking-content">
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
            const done = isCustomerDone(customer);
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
                      {custOrders.some(o => o.status === "picked_up") && (
                        <span className="picking-status-tag">Recollit</span>
                      )}
                      {custOrders.some(o => o.status === "ready") && !custOrders.some(o => o.status === "picked_up") && (
                        <span className="picking-status-tag picking-status-ready">Preparat</span>
                      )}
                    </span>
                  </div>
                  <span className="picking-item-count no-print">
                    {checkedKeys.length}/{allKeys.length}
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
