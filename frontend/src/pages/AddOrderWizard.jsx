import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronRight, Pencil, Plus as PlusIcon, Check, Calendar } from "lucide-react";
import FruitSelectorModal from "../components/FruitSelectorModal";
import { PLACES, renderFruitLabel, renderFruitDetails, getScrollDates } from "../utils/fruit";

// ── Constants ────────────────────────────────────────────────────────────────

const FRUIT_EMOJI = {
  pressec_groc: "🍑", pressec_barrejat: "🍑", pressec_vermell: "🍑",
  albercoc: "🟠", cirera: "🍒", melo: "🍈", sindria: "🍉",
};

const STEP_LABELS = ["Client", "Lloc", "Data", "Fruita", "Resum"];
const TOTAL_STEPS = 5;
const DIES = ["Diumenge","Dilluns","Dimarts","Dimecres","Dijous","Divendres","Dissabte"];

// ── Helpers (timezone-safe, always uses Europe/Madrid) ────────────────────────

function getMadridDateStr(offsetDays = 0) {
  const base = new Date().toLocaleDateString('sv', { timeZone: 'Europe/Madrid' });
  if (offsetDays === 0) return base;
  const [y, m, d] = base.split('-').map(Number);
  const r = new Date(Date.UTC(y, m - 1, d + offsetDays));
  return `${r.getUTCFullYear()}-${String(r.getUTCMonth()+1).padStart(2,'0')}-${String(r.getUTCDate()).padStart(2,'0')}`;
}

function todayStr()    { return getMadridDateStr(0); }
function tomorrowStr() { return getMadridDateStr(1); }


function formatDisplayDate(dateStr) {
  if (!dateStr) return "";
  const DIES  = ["Diumenge","Dilluns","Dimarts","Dimecres","Dijous","Divendres","Dissabte"];
  const MESOS = ["Gener","Febrer","Març","Abril","Maig","Juny","Juliol","Agost","Setembre","Octubre","Novembre","Desembre"];
  const date  = new Date(dateStr + "T00:00:00");
  const [, m, d] = dateStr.split("-");
  return `${DIES[date.getDay()]} ${parseInt(d)} de ${MESOS[parseInt(m) - 1]}`;
}

// ── Framer Motion ─────────────────────────────────────────────────────────────

const slideVariants = {
  enter:  (d) => ({ x: d > 0 ? "55%" : "-55%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (d) => ({ x: d > 0 ? "-55%" : "55%", opacity: 0 }),
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AddOrderWizard() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const prefill    = location.state || {};
  const returnPath = prefill.returnPath ?? "/";

  const [step, setStep] = useState(
    prefill.prefillCustomer && prefill.prefillCustomer.trim().length >= 2 ? 2 : 1
  );
  const [dir,  setDir]  = useState(1);
  const [order, setOrder] = useState({
    customer: prefill.prefillCustomer || "",
    place:    prefill.prefillPlace || "",
    date:     prefill.prefillDate  || "",
    fruits:   [],
    notes:    "",
  });
  const [customerError, setCustomerError] = useState("");
  const [showOtherDate, setShowOtherDate] = useState(false);
  const [openFruitModal, setOpenFruitModal]   = useState(false);
  const [editingFruit, setEditingFruit]       = useState(null);
  const [savedOrder, setSavedOrder]           = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState("");

  const otherDateRef   = useRef(null);
  const customerInputRef = useRef(null);

  const goTo = (nextStep, direction = 1) => {
    setDir(direction);
    setStep(nextStep);
    setShowOtherDate(false);
  };

  const goBack = () => step === 1 ? navigate(-1) : goTo(step - 1, -1);

  // Autofocus customer input on step 1
  useEffect(() => {
    if (step === 1) setTimeout(() => customerInputRef.current?.focus(), 120);
  }, [step]);

  // ── Step handlers ────────────────────────────────────────────────────────

  const handleCustomerNext = () => {
    if (order.customer.trim().length < 2) { setCustomerError("Mínim 2 caràcters"); return; }
    setCustomerError("");
    goTo(2);
  };

  const handlePlaceSelect = (place) => {
    setOrder(prev => ({ ...prev, place, date: "" }));
    goTo(3);
  };

  const handleDateOption = (value) => {
    if (value === "other") {
      setShowOtherDate(true);
      setTimeout(() => otherDateRef.current?.showPicker?.(), 80);
      return;
    }
    setOrder(prev => ({ ...prev, date: value }));
    goTo(4);
  };

  const handleOtherDateChange = (e) => {
    if (e.target.value) {
      setOrder(prev => ({ ...prev, date: e.target.value }));
      setShowOtherDate(false);
      goTo(4);
    }
  };

  const removeFruit = (id) => setOrder(prev => ({ ...prev, fruits: prev.fruits.filter(f => f.id !== id) }));

  const handleOpenAddFruit = () => { setEditingFruit(null); setOpenFruitModal(true); };
  const handleOpenEditFruit = (item) => { setEditingFruit(item); setOpenFruitModal(true); };
  const handleModalClose = () => { setOpenFruitModal(false); setEditingFruit(null); };

  const handleFruitSave = (item) => {
    if (editingFruit) {
      setOrder(prev => ({
        ...prev,
        fruits: prev.fruits.map(f => f.id === editingFruit.id ? { ...item, id: editingFruit.id } : f),
      }));
    } else {
      setOrder(prev => ({ ...prev, fruits: [...prev.fruits, item] }));
    }
    setEditingFruit(null);
  };

  const handleSubmit = async () => {
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: order.customer.trim(),
          date:     order.date,
          place:    order.place,
          notes:    order.notes,
          fruits:   order.fruits.map(f => ({
            fruit:  f.fruit,
            size:   f.size   ?? null,
            qty:    f.qty,
            weight: f.weight ?? null,
          })),
        }),
      });
      if (!res.ok) throw new Error();
      setSavedOrder(await res.json());
    } catch {
      setSaveError("Error en guardar. Torna-ho a intentar.");
    } finally {
      setSaving(false);
    }
  };

  // ── Saved confirmation ───────────────────────────────────────────────────

  if (savedOrder) {
    return (
      <div className="bg-stone-950 min-h-screen text-gray-100 font-sans flex flex-col">
        <div className="max-w-md w-full mx-auto px-5 pt-10 pb-10 flex flex-col gap-6">

          <div className="flex flex-col items-center gap-3 pt-2">
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 280, damping: 18 }}
              className="w-20 h-20 rounded-full bg-green-600 flex items-center justify-center shadow-xl shadow-green-950/60"
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <div className="text-2xl font-bold text-white">Comanda guardada</div>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-stone-900 rounded-2xl border border-stone-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-800">
              <div className="text-xl font-bold text-white">{savedOrder.customer}</div>
              <div className="text-sm text-stone-400 mt-1">{formatDisplayDate(savedOrder.date)} · {savedOrder.place}</div>
            </div>
            {savedOrder.fruits.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 px-5 py-3 border-b border-stone-800 last:border-b-0">
                <span className="text-2xl w-8 text-center flex-shrink-0">{FRUIT_EMOJI[item.fruit] || "🍓"}</span>
                <span className="text-sm text-stone-200 font-medium">{renderFruitDetails(item)}</span>
              </div>
            ))}
            {savedOrder.notes?.trim() && (
              <div className="px-5 py-3 border-t border-stone-800 text-xs text-stone-500 italic">{savedOrder.notes}</div>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
            className="flex flex-col gap-2.5">
            <button
              onClick={() => {
                setSavedOrder(null);
                setOrder({ customer: "", place: savedOrder.place, date: savedOrder.date, fruits: [], notes: "" });
                setStep(1);
              }}
              className="w-full rounded-xl py-3.5 font-semibold text-stone-900 flex items-center justify-center gap-2 active:scale-95 transition-all"
              style={{ backgroundColor: "#F59E0B" }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = "#D97706"}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = "#F59E0B"}
            >
              <PlusIcon className="w-4 h-4" /> Crear una altra
            </button>
            <div className="flex gap-2.5">
              <button onClick={() => navigate(`/edit/${savedOrder.id}`, { state: { returnPath } })}
                className="flex-1 rounded-xl bg-stone-800 border border-stone-700 py-3 text-sm font-medium hover:bg-stone-700 transition-colors flex items-center justify-center gap-1.5">
                <Pencil className="w-3.5 h-3.5 text-stone-400" /> Editar
              </button>
              <button onClick={() => navigate(returnPath)}
                className="flex-1 rounded-xl bg-stone-800 border border-stone-700 py-3 text-sm font-medium hover:bg-stone-700 transition-colors flex items-center justify-center gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5 text-stone-400" /> Tornar
              </button>
            </div>
          </motion.div>

        </div>
      </div>
    );
  }

  // ── Wizard ───────────────────────────────────────────────────────────────

  return (
    <div className="bg-stone-950 min-h-screen text-gray-100 font-sans flex flex-col">

      {/* ── Header / progress bar ── */}
      <div className="sticky top-0 z-10 bg-stone-950 border-b border-stone-800 px-4 pt-3 pb-3">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button
            onClick={goBack}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-stone-800 border border-stone-700 text-stone-300 hover:bg-stone-700 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex gap-1.5 mb-1.5">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <div
                  key={i}
                  className="h-1.5 rounded-full flex-1 transition-all duration-300"
                  style={{
                    backgroundColor: i < step ? "#F59E0B" : "#292524",
                    opacity: i < step ? 1 : 0.35,
                  }}
                />
              ))}
            </div>
            <p className="text-xs text-stone-400 leading-none">
              Pas <span className="font-semibold text-stone-200">{step}</span> de {TOTAL_STEPS}
              <span className="text-stone-600 mx-1.5">·</span>
              <span className="font-semibold text-stone-300">{STEP_LABELS[step - 1]}</span>
            </p>
          </div>
          <button
            onClick={() => navigate(returnPath)}
            className="text-stone-500 hover:text-stone-300 text-sm font-medium transition-colors flex-shrink-0 px-1"
          >
            Cancel·lar
          </button>
        </div>
      </div>

      {/* ── Step content ── */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="max-w-md mx-auto px-5 pt-8 pb-12">

              {/* ── Pas 1: Client ── */}
              {step === 1 && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">Qui fa la comanda?</h2>
                  <p className="text-stone-400 text-sm mb-6">Escriu el nom del client.</p>
                  <input
                    ref={customerInputRef}
                    type="text"
                    value={order.customer}
                    onChange={e => {
                      setOrder(prev => ({ ...prev, customer: e.target.value }));
                      if (customerError) setCustomerError("");
                    }}
                    onKeyDown={e => e.key === "Enter" && handleCustomerNext()}
                    placeholder="Nom del client..."
                    autoComplete="off"
                    autoCapitalize="words"
                    className="w-full rounded-2xl bg-stone-800 px-4 py-4 text-lg text-gray-100 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                    style={{ border: customerError ? "1.5px solid #EF4444" : "1.5px solid #44403C" }}
                  />
                  {customerError && (
                    <p className="text-red-400 text-sm mt-2 ml-1">{customerError}</p>
                  )}
                  <button
                    onClick={handleCustomerNext}
                    className="w-full mt-5 rounded-2xl py-4 font-semibold text-stone-900 text-base flex items-center justify-center gap-2 active:scale-95 transition-all"
                    style={{ backgroundColor: "#F59E0B" }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = "#D97706"}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = "#F59E0B"}
                  >
                    Següent <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* ── Pas 2: Lloc ── */}
              {step === 2 && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">On es fa l&apos;entrega?</h2>
                  <p className="text-stone-400 text-sm mb-6">
                    Comanda per a <span className="text-amber-400 font-medium">{order.customer}</span>.
                  </p>
                  <div className="flex flex-col gap-2.5">
                    {PLACES.map(place => {
                      const active = order.place === place;
                      return (
                        <button
                          key={place}
                          onClick={() => handlePlaceSelect(place)}
                          className="w-full rounded-2xl px-5 py-4 text-left font-semibold text-base transition-all active:scale-[0.98] flex items-center justify-between"
                          style={active
                            ? { backgroundColor: "#F59E0B", color: "#1C1917", border: "1.5px solid #F59E0B" }
                            : { backgroundColor: "#1C1917", color: "#D6D3D1", border: "1.5px solid #44403C" }
                          }
                        >
                          {place}
                          {active && <Check className="w-5 h-5 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Pas 3: Data ── */}
              {step === 3 && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">Quan és l&apos;entrega?</h2>
                  <p className="text-stone-400 text-sm mb-6">
                    Lloc: <span className="text-amber-400 font-medium">{order.place}</span>
                  </p>
                  <DateScrollList
                    place={order.place}
                    selectedDate={order.date}
                    onSelect={handleDateOption}
                  />
                  <AnimatePresence>
                    {showOtherDate && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                        animate={{ opacity: 1, height: "auto", marginTop: 12 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        className="overflow-hidden"
                      >
                        <input
                          ref={otherDateRef}
                          type="date"
                          value={order.date || ""}
                          onChange={handleOtherDateChange}
                          className="w-full rounded-2xl bg-stone-800 px-4 py-4 text-base text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
                          style={{ border: "1.5px solid #57534E" }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* ── Pas 4: Fruita ── */}
              {step === 4 && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">Quina fruita?</h2>
                  <p className="text-stone-400 text-sm mb-6">
                    Afegeix una o més fruites a la comanda.
                  </p>

                  {order.fruits.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-stone-700 bg-stone-900/40 py-10 flex flex-col items-center gap-3 mb-4">
                      <span className="text-5xl">🍑</span>
                      <p className="text-stone-500 text-sm">Cap fruita afegida</p>
                    </div>
                  ) : (
                    <ul className="space-y-2 mb-4">
                      {order.fruits.map(item => (
                        <li key={item.id}
                          className="flex items-center gap-3 rounded-2xl border border-stone-700 bg-stone-800/80 px-4 py-3.5">
                          <span className="text-2xl w-8 text-center flex-shrink-0">{FRUIT_EMOJI[item.fruit] || "🍓"}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm text-gray-100">{renderFruitLabel(item)}</div>
                            <div className="text-xs text-stone-400 mt-0.5">{renderFruitDetails(item)}</div>
                          </div>
                          <button
                            onClick={() => handleOpenEditFruit(item)}
                            className="w-8 h-8 flex items-center justify-center rounded-xl text-amber-400 hover:bg-stone-700 transition-colors"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => removeFruit(item.id)}
                            className="w-8 h-8 flex items-center justify-center rounded-xl text-stone-500 hover:text-red-400 hover:bg-stone-700 transition-colors text-lg leading-none"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <button
                    onClick={handleOpenAddFruit}
                    className="w-full rounded-2xl border border-stone-700 bg-stone-800 py-3.5 font-semibold text-stone-300 flex items-center justify-center gap-2 hover:bg-stone-700 transition-colors mb-4"
                  >
                    <PlusIcon className="w-4 h-4" /> Afegir fruita
                  </button>

                  <button
                    onClick={() => { if (order.fruits.length > 0) goTo(5); }}
                    disabled={order.fruits.length === 0}
                    className="w-full rounded-2xl py-4 font-semibold text-stone-900 text-base flex items-center justify-center gap-2 active:scale-95 transition-all"
                    style={{ backgroundColor: order.fruits.length > 0 ? "#F59E0B" : "#44403C", color: order.fruits.length > 0 ? "#1C1917" : "#78716C" }}
                  >
                    Següent <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* ── Pas 5: Resum ── */}
              {step === 5 && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">Resum de la comanda</h2>
                  <p className="text-stone-400 text-sm mb-6">Revisa les dades abans de guardar.</p>

                  <div className="space-y-3 mb-6">

                    {/* Client */}
                    <SummarySection
                      label="Client"
                      onEdit={() => goTo(1, -1)}
                    >
                      <p className="text-base font-bold text-white mt-1">{order.customer}</p>
                    </SummarySection>

                    {/* Lloc + Data */}
                    <div className="bg-stone-800 rounded-2xl border border-stone-700 overflow-hidden">
                      <div className="flex items-start justify-between gap-3 p-4 border-b border-stone-700">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-stone-500 font-medium">Lloc</p>
                          <p className="text-base font-bold text-white mt-1">{order.place}</p>
                        </div>
                        <EditBtn onClick={() => goTo(2, -1)} />
                      </div>
                      <div className="flex items-start justify-between gap-3 p-4">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-stone-500 font-medium">Data</p>
                          <p className="text-base font-bold text-white mt-1">{formatDisplayDate(order.date)}</p>
                        </div>
                        <EditBtn onClick={() => goTo(3, -1)} />
                      </div>
                    </div>

                    {/* Fruita */}
                    <div className="bg-stone-800 rounded-2xl border border-stone-700 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-700">
                        <p className="text-xs uppercase tracking-wide text-stone-500 font-medium">
                          Fruita <span className="text-stone-600">({order.fruits.length})</span>
                        </p>
                        <EditBtn onClick={() => goTo(4, -1)} />
                      </div>
                      {order.fruits.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 px-4 py-3 border-b border-stone-700 last:border-b-0">
                          <span className="text-xl w-7 text-center flex-shrink-0">{FRUIT_EMOJI[item.fruit] || "🍓"}</span>
                          <div className="min-w-0">
                            <span className="text-sm font-semibold text-stone-100">{renderFruitLabel(item)}</span>
                            <span className="text-xs text-stone-400 ml-2">{renderFruitDetails(item)}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Notes */}
                    <div className="bg-stone-800 rounded-2xl border border-stone-700 p-4">
                      <p className="text-xs uppercase tracking-wide text-stone-500 font-medium mb-2">Notes (opcional)</p>
                      <textarea
                        value={order.notes}
                        onChange={e => setOrder(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Observacions..."
                        rows={2}
                        className="w-full bg-transparent text-sm text-stone-200 placeholder-stone-600 focus:outline-none resize-none"
                      />
                    </div>
                  </div>

                  {saveError && (
                    <p className="text-red-400 text-sm mb-4 text-center">{saveError}</p>
                  )}

                  <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="w-full rounded-2xl py-4 font-bold text-stone-900 text-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
                    style={{ backgroundColor: saving ? "#92400e" : "#F59E0B", color: "#1C1917" }}
                    onMouseEnter={e => { if (!saving) e.currentTarget.style.backgroundColor = "#D97706"; }}
                    onMouseLeave={e => { if (!saving) e.currentTarget.style.backgroundColor = "#F59E0B"; }}
                  >
                    {saving ? "Guardant..." : "Guardar comanda"}
                  </button>
                </div>
              )}

            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <FruitSelectorModal
        key={editingFruit ? `edit-${editingFruit.id}` : 'new'}
        open={openFruitModal}
        onClose={handleModalClose}
        onAdd={handleFruitSave}
        editItem={editingFruit}
      />
    </div>
  );
}

// ── DateScrollList ────────────────────────────────────────────────────────────

const DIES_SCROLL = ["Diumenge","Dilluns","Dimarts","Dimecres","Dijous","Divendres","Dissabte"];

function DateScrollList({ place, selectedDate, onSelect }) {
  const dates = getScrollDates(place);
  const today    = new Date().toLocaleDateString('sv', { timeZone: 'Europe/Madrid' });
  const [ty, tm, td] = today.split('-').map(Number);
  const tomorrowDt = new Date(Date.UTC(ty, tm - 1, td + 1));
  const tomorrow = `${tomorrowDt.getUTCFullYear()}-${String(tomorrowDt.getUTCMonth()+1).padStart(2,'0')}-${String(tomorrowDt.getUTCDate()).padStart(2,'0')}`;

  const selectedRef = useRef(null);

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
  }, []);

  return (
    <div>
      <div
        className="overflow-y-auto rounded-2xl border border-stone-700"
        style={{ maxHeight: "320px", scrollSnapType: "y mandatory" }}
      >
        {dates.map((dateStr) => {
          const isSelected = dateStr === selectedDate;
          const dow = new Date(dateStr + "T00:00:00").getDay();
          const dowName = DIES_SCROLL[dow];
          const [, mm, dd] = dateStr.split('-');
          const datePart = `${parseInt(dd)}/${parseInt(mm)}`;

          let mainLabel;
          if (dateStr === today)
            mainLabel = `Aquest ${dowName.toLowerCase()} (Avui)`;
          else if (dateStr === tomorrow)
            mainLabel = `Aquest ${dowName.toLowerCase()} (Demà)`;
          else
            mainLabel = dowName;

          return (
            <button
              key={dateStr}
              ref={isSelected ? selectedRef : null}
              onClick={() => onSelect(dateStr)}
              className="w-full px-5 py-4 flex items-center justify-between border-b border-stone-800 last:border-b-0 transition-colors active:opacity-80"
              style={{
                scrollSnapAlign: 'start',
                backgroundColor: isSelected ? '#F59E0B' : 'transparent',
              }}
            >
              <span
                className="font-semibold text-base"
                style={{ color: isSelected ? '#1C1917' : '#A8A29E' }}
              >
                {mainLabel}
              </span>
              <span
                className="text-sm font-medium"
                style={{ color: isSelected ? '#292524' : '#57534E' }}
              >
                {datePart}
              </span>
            </button>
          );
        })}
      </div>
      <button
        onClick={() => onSelect("other")}
        className="w-full mt-2.5 rounded-2xl px-5 py-4 text-left font-semibold text-base transition-all active:scale-[0.98] flex items-center gap-2.5"
        style={{ backgroundColor: "transparent", color: "#A8A29E", border: "1.5px dashed #44403C" }}
      >
        <Calendar className="w-4 h-4 flex-shrink-0" />
        Altra data
      </button>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function EditBtn({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-medium mt-0.5 transition-colors"
    >
      <Pencil className="w-3 h-3" /> Editar
    </button>
  );
}

function SummarySection({ label, onEdit, children }) {
  return (
    <div className="bg-stone-800 rounded-2xl border border-stone-700 p-4 flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wide text-stone-500 font-medium">{label}</p>
        {children}
      </div>
      <EditBtn onClick={onEdit} />
    </div>
  );
}
