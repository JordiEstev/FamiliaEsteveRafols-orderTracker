import { useState } from "react";
import { v4 as uuid } from "uuid";

const FRUIT_TYPES = [
  { key: "pressec_groc", label: "Pressec Groc", emoji: "🍑", group: "pressec" },
  { key: "pressec_barrejat", label: "Pressec Barrejat", emoji: "🍑", group: "pressec" },
  { key: "pressec_vermell", label: "Pressec Vermell", emoji: "🍑", group: "pressec" },
  { key: "albercoc", label: "Albercoc", emoji: "🟠" },
  { key: "cirera", label: "Cirera", emoji: "🍒" },
  { key: "melo", label: "Meló", emoji: "🍈" },
  { key: "sindria", label: "Síndria", emoji: "🍉" },
];

const PEACH_SIZES = [15, 16, 18, 20, 22, 24, 26];

export default function FruitSelectorModal({ open, onClose, onAdd }) {
  const [step, setStep] = useState("grid"); // grid | form
  const [selection, setSelection] = useState(null);
  const [form, setForm] = useState({});

  if (!open) return null;

  const reset = () => {
    setStep("grid");
    setSelection(null);
    setForm({});
  };

  const handleFruitClick = (f) => {
    setSelection(f);
    if (f.group === "pressec") {
      setForm({ size: 15, qty: 1 });
    } else if (["albercoc", "cirera"].includes(f.key)) {
      setForm({ weight: 1, qty: 1 });     // weight = per-unit (1 or 2)
    } else {
      // melo / sindria
      setForm({ qty: 1, weight: "" });    // weight = total optional
    }
    setStep("form");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const setQty = (v) =>
    setForm(prev => ({ ...prev, qty: Math.max(1, Number(v) || 1) }));

  const inc = () => setQty((form.qty || 1) + 1);
  const dec = () => setQty((form.qty || 1) - 1);

  const handleAdd = () => {
    if (!selection) return;
    let item;
    if (selection.group === "pressec") {
      item = {
        id: uuid(),
        fruit: selection.key,        // pressec_groc / pressec_vermell
        size: Number(form.size),
        qty: Number(form.qty),
        weight: null
      };
    } else if (["albercoc", "cirera"].includes(selection.key)) {
      item = {
        id: uuid(),
        fruit: selection.key,
        qty: Number(form.qty),
        weight: Number(form.weight)   // 1 or 2
      };
    } else {
      // melo / sindria
      item = {
        id: uuid(),
        fruit: selection.key,
        qty: Number(form.qty),
        weight: form.weight !== "" && form.weight !== null
          ? Number(form.weight)
          : null // optional
      };
    }
    onAdd(item);
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-stone-900 border border-stone-700 p-5 shadow-2xl">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-base font-bold text-gray-100">
            {step === "grid" ? "Selecciona fruita" : (
              <span className="flex items-center gap-2">
                <span>{selection?.emoji}</span>
                <span>{selection?.label}</span>
              </span>
            )}
          </h3>
          <button
            onClick={() => { reset(); onClose(); }}
            className="w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-200 hover:bg-stone-700 transition-colors text-lg"
          >
            &times;
          </button>
        </div>

        {step === "grid" && (
          <div className="grid grid-cols-2 gap-2.5">
            {FRUIT_TYPES.map(f => (
              <button
                key={f.key}
                onClick={() => handleFruitClick(f)}
                className="rounded-xl border border-stone-700 bg-stone-800 p-3 text-sm font-medium text-gray-100 hover:border-amber-500 hover:bg-stone-700 transition-all flex items-center gap-2"
              >
                <span className="text-xl">{f.emoji}</span>
                <span className="text-left leading-tight">{f.label}</span>
              </button>
            ))}
          </div>
        )}

        {step === "form" && selection && (
          <div className="space-y-5">

            {selection.group === "pressec" && (
              <>
                <div>
                  <label className="block text-xs text-stone-400 uppercase tracking-wide font-medium mb-2">Calibre</label>
                  <div className="grid grid-cols-4 gap-2">
                    {PEACH_SIZES.map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, size: s }))}
                        className="rounded-xl border py-2.5 text-sm font-semibold transition-all"
                        style={form.size === s
                          ? { backgroundColor: "#F59E0B", borderColor: "#F59E0B", color: "#1C1917" }
                          : { backgroundColor: "#292524", borderColor: "#44403C", color: "#D6D3D1" }
                        }
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <QtyStepper qty={form.qty} setQty={setQty} label="Caixes" />
              </>
            )}

            {["albercoc", "cirera"].includes(selection.key) && (
              <>
                <div>
                  <label className="block text-xs text-stone-400 uppercase tracking-wide font-medium mb-2">Pes per unitat</label>
                  <div className="flex gap-2">
                    {[1, 2].map(w => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, weight: w }))}
                        className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                          form.weight === w
                            ? "text-stone-900 border-amber-400"
                            : "bg-stone-800 border-stone-600 text-stone-300 hover:bg-stone-700"
                        }`}
                        style={form.weight === w ? { backgroundColor: "#F59E0B" } : {}}
                      >
                        {w} kg
                      </button>
                    ))}
                  </div>
                </div>
                <QtyStepper qty={form.qty} setQty={setQty} label="Unitats" />
              </>
            )}

            {["melo", "sindria"].includes(selection.key) && (
              <>
                <QtyStepper qty={form.qty} setQty={setQty} label="Peces" />
                <div>
                  <label className="block text-xs text-stone-400 uppercase tracking-wide font-medium mb-2">
                    Pes total (kg, opcional)
                  </label>
                  <input
                    name="weight"
                    type="number"
                    step="0.1"
                    value={form.weight}
                    onChange={handleChange}
                    placeholder="Ex: 13.5"
                    className="w-full rounded-xl border border-stone-700 bg-stone-800 px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                  />
                </div>
              </>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleAdd}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-stone-900 transition-all"
                style={{ backgroundColor: "#F59E0B" }}
              >
                Afegir
              </button>
              <button
                type="button"
                onClick={() => setStep("grid")}
                className="flex-1 rounded-xl bg-stone-700 px-4 py-2.5 text-sm font-medium text-stone-200 hover:bg-stone-600 transition-colors"
              >
                &larr; Tornar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function QtyStepper({ qty, setQty, label }) {
  return (
    <div>
      <label className="block text-xs text-stone-400 uppercase tracking-wide font-medium mb-2">{label}</label>
      <div className="flex items-stretch overflow-hidden rounded-xl border border-stone-600">
        <button
          type="button"
          onClick={() => setQty(qty > 1 ? qty - 1 : 1)}
          className="bg-stone-800 px-4 text-xl text-stone-200 hover:bg-stone-700 transition-colors font-light"
        >
          &minus;
        </button>
        <input
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(Number(e.target.value) || 1)}
          className="w-full bg-stone-900 text-center text-gray-100 text-sm font-semibold focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setQty(qty + 1)}
          className="bg-stone-800 px-4 text-xl text-stone-200 hover:bg-stone-700 transition-colors font-light"
        >
          +
        </button>
      </div>
    </div>
  );
}
