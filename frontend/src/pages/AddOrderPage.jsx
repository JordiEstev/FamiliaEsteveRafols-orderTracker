import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import FruitSelectorModal from "../components/FruitSelectorModal";
import { motion } from "framer-motion";
import { Pencil, ArrowLeft, Plus as PlusIcon } from "lucide-react";

import { FRUIT_TYPES, PEACH_SIZES, renderFruitLabel, renderFruitDetails } from "../utils/fruit";

const FRUIT_EMOJI = {
  pressec_groc: "🍑", pressec_barrejat: "🍑", pressec_vermell: "🍑",
  albercoc: "🟠", cirera: "🍒", melo: "🍈", sindria: "🍉",
};

function formatDate(dateStr) {
  if (!dateStr) return "";
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

function formatFullDate(dateStr) {
  if (!dateStr) return "";
  const DIES = ["Diumenge", "Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres", "Dissabte"];
  const MESOS = ["Gener", "Febrer", "Març", "Abril", "Maig", "Juny", "Juliol", "Agost", "Setembre", "Octubre", "Novembre", "Desembre"];
  const date = new Date(dateStr);
  const [, m, d] = dateStr.split("-");
  return `${DIES[date.getDay()]} ${parseInt(d)} ${MESOS[parseInt(m) - 1]}`;
}

export default function AddOrderPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = location.state || {};

  const [openFruitModal, setOpenFruitModal] = useState(false);
  const [formError, setFormError] = useState("");
  const [showError, setShowError] = useState(false);
  const [fruits, setFruits] = useState([]);
  const [savedOrder, setSavedOrder] = useState(null);

  const [form, setForm] = useState({
    customer: "",
    date: prefill.prefillDate || "",
    place: prefill.prefillPlace || "",
    notes: ""
  });

  function flashError(message) {
    setFormError(message);
    setShowError(true);
    setTimeout(() => setShowError(false), 1500);
  }

  const handleBasicChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const addFruit = (item) => setFruits(prev => [...prev, item]);
  const removeFruit = (id) => setFruits(prev => prev.filter(f => f.id !== id));

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!form.place) {
      flashError("Cal triar un lloc");
      return;
    }
    if (!fruits.length) {
      flashError("Afegiu almenys una fruita");
      return;
    }

    const payload = {
      customer: form.customer,
      date: form.date,
      place: form.place,
      notes: form.notes,
      fruits: fruits.map(f => ({
        fruit: f.fruit,
        size: f.size ?? null,
        qty: f.qty,
        weight: f.weight ?? null
      }))
    };

    fetch(`${import.meta.env.VITE_API_URL}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to save order");
        return res.json();
      })
      .then(data => {
        setSavedOrder(data);
      })
      .catch(err => {
        console.error("Error saving order:", err);
        flashError("Hi ha hagut un error en guardar la comanda.");
      });
  };

  const returnPath = prefill.returnPath ?? "/";

  if (savedOrder) {
    return (
      <div className="bg-stone-950 min-h-screen text-gray-100 font-sans flex flex-col">
        <div className="max-w-md w-full mx-auto px-5 pt-10 pb-10 flex flex-col gap-6">

          {/* Hero */}
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
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.2 }}
              className="text-center"
            >
              <div className="text-2xl font-bold text-white">Comanda guardada</div>
            </motion.div>
          </div>

          {/* Order card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.25 }}
            className="bg-stone-900 rounded-2xl border border-stone-800 overflow-hidden"
          >
            {/* Customer + meta */}
            <div className="px-5 py-4 border-b border-stone-800">
              <div className="text-xl font-bold text-white leading-tight">{savedOrder.customer}</div>
              <div className="text-sm text-stone-400 mt-1 flex items-center gap-1.5">
                <span>{formatFullDate(savedOrder.date)}</span>
                <span className="text-stone-600">·</span>
                <span>{savedOrder.place}</span>
              </div>
            </div>

            {/* Fruit rows */}
            <div>
              {savedOrder.fruits.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 px-5 py-3 border-b border-stone-800 last:border-b-0"
                >
                  <span className="text-2xl leading-none w-8 text-center flex-shrink-0">
                    {FRUIT_EMOJI[item.fruit] || "🍓"}
                  </span>
                  <span className="text-sm text-stone-200 font-medium">
                    {renderFruitDetails(item)}
                  </span>
                </div>
              ))}
            </div>

            {/* Notes */}
            {savedOrder.notes?.trim() && (
              <div className="px-5 py-3 border-t border-stone-800 text-xs text-stone-500 italic">
                {savedOrder.notes}
              </div>
            )}
          </motion.div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.2 }}
            className="flex flex-col gap-2.5"
          >
            <button
              onClick={() => {
                setSavedOrder(null);
                setFruits([]);
                setForm({ customer: "", date: savedOrder.date, place: savedOrder.place, notes: "" });
              }}
              className="w-full rounded-xl py-3.5 font-semibold text-stone-900 flex items-center justify-center gap-2 transition-all active:scale-95"
              style={{ backgroundColor: "#F59E0B" }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = "#D97706"}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = "#F59E0B"}
            >
              <PlusIcon className="w-4 h-4" />
              Crear una altra
            </button>
            <div className="flex gap-2.5">
              <button
                onClick={() => navigate(`/edit/${savedOrder.id}`, { state: { returnPath } })}
                className="flex-1 rounded-xl bg-stone-800 border border-stone-700 py-3 font-medium text-sm hover:bg-stone-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <Pencil className="w-3.5 h-3.5 text-stone-400" />
                Editar
              </button>
              <button
                onClick={() => navigate(returnPath)}
                className="flex-1 rounded-xl bg-stone-800 border border-stone-700 py-3 font-medium text-sm hover:bg-stone-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-stone-400" />
                Tornar
              </button>
            </div>
          </motion.div>

        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.3 }}
    >
      <div className="bg-stone-950 min-h-screen text-gray-100 p-5 font-sans">
        {showError && (
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-red-500 text-white px-10 py-8 rounded-3xl shadow-2xl text-center max-w-xs">
              <div className="text-4xl mb-3">✕</div>
              <div className="text-xl font-bold leading-snug">{formError}</div>
            </div>
          </div>
        )}
        <form
          onSubmit={handleSubmit}
          className="max-w-md mx-auto bg-stone-900 border border-stone-800 rounded-2xl shadow-xl p-5 space-y-5"
        >

          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="text-amber-400 text-3xl font-light">+</span> Nova Comanda
          </h1>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wide text-stone-400 font-medium">Client</label>
            <input
              name="customer"
              placeholder="Nom del client"
              value={form.customer}
              onChange={handleBasicChange}
              className="w-full rounded-xl border border-stone-700 bg-stone-800 px-3 py-2.5 text-sm text-gray-100 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wide text-stone-400 font-medium">Data</label>
            <input
              type="date"
              name="date"
              value={form.date}
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
              onChange={handleBasicChange}
              className="w-full rounded-xl border border-stone-700 bg-stone-800 px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
            >
              <option value="" disabled hidden className="text-stone-400">
                Tria un lloc
              </option>
              <option>Sant Pau</option>
              <option>Cantallops</option>
              <option>La Girada</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wide text-stone-400 font-medium">Notes</label>
            <textarea
              name="notes"
              placeholder="Observacions..."
              value={form.notes}
              onChange={handleBasicChange}
              rows={2}
              className="w-full rounded-xl border border-stone-700 bg-stone-800 px-3 py-2.5 text-sm text-gray-100 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all resize-none"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-wide text-stone-400 font-medium">
                Fruita ({fruits.length})
              </label>
              <button
                type="button"
                onClick={() => setOpenFruitModal(true)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg text-stone-900"
                style={{ backgroundColor: "#F59E0B" }}
              >
                + Afegir fruita
              </button>
            </div>

            {fruits.length === 0 && (
              <div className="text-sm text-stone-500 italic py-2">
                Encara no hi ha fruita afegida.
              </div>
            )}

            <ul className="space-y-2">
              {fruits.map(item => (
                <li
                  key={item.id}
                  className="flex items-start justify-between rounded-xl border border-stone-700 bg-stone-800 px-3 py-2.5 text-sm"
                >
                  <div className="pr-2">
                    <div className="font-medium text-gray-100">
                      {renderFruitLabel(item)}
                    </div>
                    <div className="text-stone-400 text-xs mt-0.5">
                      {renderFruitDetails(item)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFruit(item.id)}
                    className="text-stone-500 hover:text-red-400 text-base leading-none transition-colors"
                  >
                    &times;
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <FruitSelectorModal
            open={openFruitModal}
            onClose={() => setOpenFruitModal(false)}
            onAdd={addFruit}
          />

          <div className="pt-2 flex gap-3">
            <button
              type="submit"
              className="flex-1 rounded-xl py-2.5 font-semibold text-stone-900 transition-all"
              style={{ backgroundColor: "#F59E0B" }}
            >
              Guardar
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
    </motion.div>
  );
}
