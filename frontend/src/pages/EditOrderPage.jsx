import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Pencil, ArrowLeft, ChevronDown } from "lucide-react";
import { v4 as uuid } from "uuid";
import FruitSelectorModal from "../components/FruitSelectorModal";
import DateScrollList from "../components/DateScrollList";
import { PLACES, PLACE_WEEKDAYS, getScrollDates, renderFruitLabel, renderFruitDetails } from "../utils/fruit";
import { enqueue } from "../utils/offlineQueue";

const FRUIT_EMOJI = {
  pressec_groc: "🍑", pressec_barrejat: "🍑", pressec_vermell: "🍑",
  albercoc: "🟠", cirera: "🍒", melo: "🍈", sindria: "🍉",
};

const STATUS_OPTIONS = [
  { value: "pending",   label: "Pendent" },
  { value: "ready",     label: "Preparat" },
  { value: "picked_up", label: "Recollit" },
  { value: "cancelled", label: "Cancel·lat" },
];

function formatDisplayDate(dateStr) {
  if (!dateStr) return "";
  const DIES  = ["Diumenge","Dilluns","Dimarts","Dimecres","Dijous","Divendres","Dissabte"];
  const MESOS = ["Gener","Febrer","Març","Abril","Maig","Juny","Juliol","Agost","Setembre","Octubre","Novembre","Desembre"];
  const date  = new Date(dateStr + "T00:00:00");
  const [, m, d] = dateStr.split("-");
  return `${DIES[date.getDay()]} ${parseInt(d)} de ${MESOS[parseInt(m) - 1]}`;
}

export default function EditOrderPage() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const returnPath = location.state?.returnPath ?? "/";
  const prefillOrder = location.state?.order ?? null;
  const { id }     = useParams();

  const [form, setForm] = useState({
    customer: "", date: "", place: "", notes: "", status: "pending",
  });
  const [fruits, setFruits]           = useState([]);
  // Si venim de la llista, ja tenim la comanda: l'editem sense esperar cap fetch
  // (clau per poder editar sense cobertura).
  const [loading, setLoading]         = useState(!prefillOrder);
  const [openFruitModal, setOpenFruitModal] = useState(false);
  const [editingFruit, setEditingFruit]     = useState(null);
  const [errorMessage, setErrorMessage]     = useState("");
  const [savedOrder, setSavedOrder]         = useState(null);
  const [saving, setSaving]                 = useState(false);
  const [showOtherDate, setShowOtherDate]   = useState(false);
  const [dateOpen, setDateOpen]             = useState(false);
  const otherDateRef = useRef(null);

  // Carrega la comanda. Si la llista ens l'ha passada per state, l'usem
  // directament i evitem el fetch (funciona sense cobertura, sense spinner).
  useEffect(() => {
    const hydrate = (order) => {
      setForm({
        customer: order.customer,
        date:     order.date,
        place:    order.place,
        notes:    order.notes || "",
        status:   order.status || "pending",
      });
      setFruits(order.fruits.map(f => ({ ...f, id: f.id ?? uuid() })));
      // Si la data desada no és cap de les opcions habituals del lloc (p. ex. una
      // comanda antiga), obrim el camp d'"Altra data" perquè es vegi i es pugui editar.
      setShowOtherDate(!!order.date && !getScrollDates(order.place).includes(order.date));
      setLoading(false);
    };

    if (prefillOrder) {
      hydrate(prefillOrder);
      return;
    }

    fetch(`${import.meta.env.VITE_API_URL}/orders`)
      .then(res => res.json())
      .then(data => {
        const order = data.find(o => o.id === parseInt(id));
        if (!order) throw new Error("Not found");
        hydrate(order);
      })
      .catch(() => {
        setLoading(false);
        setErrorMessage("No s'ha pogut carregar la comanda.");
        setTimeout(() => navigate("/"), 2000);
      });
  }, [id]);

  const handleBasicChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  // Una data és vàlida per a un lloc si cau en un dels seus dies de repartiment.
  const isDateValidForPlace = (dateStr, place) => {
    if (!dateStr || !place) return false;
    const validDays = PLACE_WEEKDAYS[place] ?? [0, 1, 2, 3, 4, 5, 6];
    return validDays.includes(new Date(dateStr + "T00:00:00").getDay());
  };

  const handlePlaceChange = (e) => {
    const place = e.target.value;
    // La data depèn del lloc: si la que hi ha ja no és vàlida, l'esborrem i obrim
    // la roda perquè se'n triï una de nova.
    const keepDate = isDateValidForPlace(form.date, place);
    setForm(prev => ({ ...prev, place, date: keepDate ? prev.date : "" }));
    setShowOtherDate(false);
    if (!keepDate) setDateOpen(true);
  };

  const handleDateSelect = (value) => {
    if (value === "other") {
      setShowOtherDate(true);
      setTimeout(() => otherDateRef.current?.showPicker?.(), 80);
      return;
    }
    setForm(prev => ({ ...prev, date: value }));
    setShowOtherDate(false);
  };

  const handleOtherDateChange = (e) => {
    if (e.target.value) setForm(prev => ({ ...prev, date: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.customer.trim().length < 2) { setErrorMessage("El client ha de tenir mínim 2 caràcters."); return; }
    if (!form.place) { setErrorMessage("Cal triar un lloc."); return; }
    if (!form.date)  { setErrorMessage("Cal triar una data."); return; }
    if (!fruits.length) { setErrorMessage("Afegiu almenys una fruita."); return; }
    setSaving(true);
    setErrorMessage("");

    const payload = {
      ...form,
      fruits: fruits.map(f => ({
        fruit: f.fruit, qty: f.qty, size: f.size ?? null, weight: f.weight ?? null,
      })),
    };

    fetch(`${import.meta.env.VITE_API_URL}/orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(data => { setSavedOrder(data); })
      .catch(err => {
        // Una fallada de xarxa (sense cobertura) fa que fetch rebutgi amb un
        // TypeError: encuem el PUT localment i el reenviarem quan torni la
        // connexió. Un error HTTP del servidor llança un Error normal -> error real.
        if (err instanceof TypeError) {
          enqueue({ method: "PUT", url: `${import.meta.env.VITE_API_URL}/orders/${id}`, body: payload });
          setSavedOrder({ ...payload, offline: true });
          return;
        }
        setErrorMessage("Error en actualitzar la comanda.");
      })
      .finally(() => setSaving(false));
  };

  const handleFruitSave = (item) => {
    if (editingFruit) {
      setFruits(prev => prev.map(f => f.id === editingFruit.id ? { ...item, id: editingFruit.id } : f));
    } else {
      setFruits(prev => [...prev, item]);
    }
    setEditingFruit(null);
  };
  const handleModalClose = () => { setOpenFruitModal(false); setEditingFruit(null); };
  const handleOpenEditFruit = (item) => { setEditingFruit(item); setOpenFruitModal(true); };
  const removeFruit = (fid) => setFruits(prev => prev.filter(f => f.id !== fid));

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="bg-stone-950 min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-amber-800 border-t-amber-400 rounded-full animate-spin" />
    </div>
  );

  // ── Confirmation screen ──────────────────────────────────────────────────

  if (savedOrder) {
    return (
      <div className="bg-stone-950 min-h-screen text-gray-100 font-sans flex flex-col">
        <div className="max-w-md w-full mx-auto px-5 pt-10 pb-10 flex flex-col gap-6">

          <div className="flex flex-col items-center gap-3 pt-2">
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 280, damping: 18 }}
              className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl ${savedOrder.offline ? "bg-amber-500 shadow-amber-950/60" : "bg-green-600 shadow-green-950/60"}`}
            >
              {savedOrder.offline ? (
                <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <polyline points="12 7 12 12 15 14" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="text-center">
              <div className="text-2xl font-bold text-white">
                {savedOrder.offline ? "Canvis encuats" : "Comanda actualitzada"}
              </div>
              {savedOrder.offline && (
                <div className="text-sm text-amber-300/90 mt-1.5 max-w-xs mx-auto leading-snug">
                  Sense cobertura. Es desarà automàticament quan tornis a tenir connexió.
                </div>
              )}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-stone-900 rounded-2xl border border-stone-800 overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-stone-800">
              <div className="text-xl font-bold text-white leading-tight">{savedOrder.customer}</div>
              <div className="text-sm text-stone-400 mt-1">
                {formatDisplayDate(savedOrder.date)} · {savedOrder.place}
              </div>
            </div>
            {savedOrder.fruits.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 px-5 py-3 border-b border-stone-800 last:border-b-0">
                <span className="text-2xl w-8 text-center flex-shrink-0">{FRUIT_EMOJI[item.fruit] || "🍓"}</span>
                <span className="text-sm text-stone-200 font-medium">{renderFruitDetails(item)}</span>
              </div>
            ))}
            {savedOrder.notes?.trim() && (
              <div className="px-5 py-3 border-t border-stone-800 text-xs text-stone-500 italic">
                {savedOrder.notes}
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
            className="flex flex-col gap-2.5"
          >
            <button
              onClick={() => navigate(returnPath)}
              className="w-full rounded-xl py-3.5 font-semibold text-stone-900 flex items-center justify-center gap-2 active:scale-95 transition-all"
              style={{ backgroundColor: "#F59E0B" }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = "#D97706"}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = "#F59E0B"}
            >
              <ArrowLeft className="w-4 h-4" /> Tornar a la llista
            </button>
            <button
              onClick={() => setSavedOrder(null)}
              className="w-full rounded-xl bg-stone-800 border border-stone-700 py-3 text-sm font-medium hover:bg-stone-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <Pencil className="w-3.5 h-3.5 text-stone-400" /> Continuar editant
            </button>
          </motion.div>

        </div>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────

  return (
    <div className="bg-stone-950 min-h-screen text-gray-100 p-5 font-sans">

      {errorMessage && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-red-600 text-white px-10 py-8 rounded-3xl shadow-2xl text-center max-w-xs">
            <div className="text-4xl mb-3">✕</div>
            <div className="text-xl font-bold leading-snug">{errorMessage}</div>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="max-w-md mx-auto bg-stone-900 border border-stone-800 rounded-2xl shadow-xl p-5 space-y-5"
      >
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Pencil className="w-6 h-6 text-amber-400" />
          Editar Comanda
        </h1>

        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wide text-stone-400 font-medium">Client</label>
          <input
            name="customer"
            value={form.customer}
            onChange={handleBasicChange}
            className="w-full rounded-xl border border-stone-700 bg-stone-800 px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wide text-stone-400 font-medium">Lloc</label>
          <select
            name="place"
            value={form.place}
            onChange={handlePlaceChange}
            className="w-full rounded-xl border border-stone-700 bg-stone-800 px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
          >
            {PLACES.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wide text-stone-400 font-medium">Data</label>
          {form.place ? (
            <>
              {/* Camp tancat amb la data triada; la roda apareix en clicar-hi. */}
              <button
                type="button"
                onClick={() => setDateOpen(o => !o)}
                className="w-full flex items-center justify-between rounded-xl border border-stone-700 bg-stone-800 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
              >
                <span className={form.date ? "text-gray-100 font-medium" : "text-stone-500"}>
                  {form.date ? formatDisplayDate(form.date) : "Tria una data"}
                </span>
                <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${dateOpen ? "rotate-180" : ""}`} />
              </button>
              {dateOpen && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
                  onClick={() => setDateOpen(false)}
                >
                  <div
                    className="w-full max-w-md rounded-2xl bg-stone-900 border border-stone-700 p-5 shadow-2xl"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-base font-bold text-gray-100">Tria una data</h3>
                      <button
                        type="button"
                        onClick={() => setDateOpen(false)}
                        className="w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-200 hover:bg-stone-700 transition-colors text-lg"
                      >
                        &times;
                      </button>
                    </div>
                    <DateScrollList place={form.place} selectedDate={form.date} onSelect={handleDateSelect} />
                    {showOtherDate && (
                      <input
                        ref={otherDateRef}
                        type="date"
                        value={form.date || ""}
                        onChange={handleOtherDateChange}
                        className="w-full mt-2.5 rounded-xl border border-stone-700 bg-stone-800 px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setDateOpen(false)}
                      className="w-full mt-4 rounded-xl py-3 font-semibold text-stone-900"
                      style={{ backgroundColor: "#F59E0B" }}
                    >
                      Fet
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-stone-500 italic py-1">Tria primer un lloc.</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wide text-stone-400 font-medium">Notes</label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleBasicChange}
            rows={2}
            className="w-full rounded-xl border border-stone-700 bg-stone-800 px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all resize-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wide text-stone-400 font-medium">Estat</label>
          <select
            name="status"
            value={form.status}
            onChange={handleBasicChange}
            className="w-full rounded-xl border border-stone-700 bg-stone-800 px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
          >
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs uppercase tracking-wide text-stone-400 font-medium">
              Fruita ({fruits.length})
            </label>
            <button
              type="button"
              onClick={() => setOpenFruitModal(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-stone-900 transition-all"
              style={{ backgroundColor: "#F59E0B" }}
            >
              + Afegir fruita
            </button>
          </div>

          {fruits.length === 0 && (
            <div className="text-sm text-stone-500 italic py-2">Cap fruita afegida.</div>
          )}

          <ul className="space-y-2">
            {fruits.map(item => (
              <li
                key={item.id || `${item.fruit}-${item.size}-${item.qty}`}
                className="flex items-center gap-3 rounded-xl border border-stone-700 bg-stone-800 px-3 py-2.5 text-sm"
              >
                <span className="text-xl w-7 text-center flex-shrink-0">{FRUIT_EMOJI[item.fruit] || "🍓"}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-100">{renderFruitLabel(item)}</div>
                  <div className="text-stone-400 text-xs mt-0.5">{renderFruitDetails(item)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenEditFruit(item)}
                  className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-amber-400 transition-colors rounded-lg hover:bg-stone-700"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeFruit(item.id)}
                  className="w-7 h-7 flex items-center justify-center text-stone-500 hover:text-red-400 transition-colors rounded-lg hover:bg-stone-700 text-base leading-none"
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        </div>

        <FruitSelectorModal
          key={editingFruit ? `edit-${editingFruit.id}` : "new"}
          open={openFruitModal}
          onClose={handleModalClose}
          onAdd={handleFruitSave}
          editItem={editingFruit}
        />

        <div className="pt-2 flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-xl py-2.5 font-semibold text-stone-900 transition-all"
            style={{ backgroundColor: saving ? "#92400e" : "#F59E0B" }}
            onMouseEnter={e => { if (!saving) e.currentTarget.style.backgroundColor = "#D97706"; }}
            onMouseLeave={e => { if (!saving) e.currentTarget.style.backgroundColor = saving ? "#92400e" : "#F59E0B"; }}
          >
            {saving ? "Guardant..." : "Actualitzar"}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex-1 rounded-xl bg-stone-700 py-2.5 font-medium hover:bg-stone-600 transition-colors"
          >
            Cancel·lar
          </button>
        </div>
      </form>
    </div>
  );
}
