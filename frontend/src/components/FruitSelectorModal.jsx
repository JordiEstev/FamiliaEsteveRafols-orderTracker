import { useState } from "react";
import { v4 as uuid } from "uuid";

const FRUIT_TYPES = [
  { key: "pressec_groc", label: "Pressec Groc", group: "pressec" },
  { key: "pressec_barrejat", label: "Pressec Barrejat", group: "pressec" },
  { key: "pressec_vermell", label: "Pressec Vermell", group: "pressec" },
  { key: "albercoc", label: "Albercoc" },
  { key: "cirera", label: "Cirera" },
  { key: "melo", label: "Meló" },
  { key: "sindria", label: "Síndria" }
];

const PEACH_SIZES = [16, 18, 20, 22, 24, 26];

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
      setForm({ size: 22, qty: 1 });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl bg-gray-900 border border-gray-700 p-5 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-100">
            {step === "grid" ? "Selecciona fruita" : selection?.label}
          </h3>
          <button
            onClick={() => { reset(); onClose(); }}
            className="text-gray-400 hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        {step === "grid" && (
          <div className="grid grid-cols-2 gap-3">
            {FRUIT_TYPES.map(f => (
              <button
                key={f.key}
                onClick={() => handleFruitClick(f)}
                className="rounded-lg border border-gray-600 bg-gray-800 p-3 text-sm font-medium text-gray-100 hover:border-violet-500 hover:bg-gray-700 transition"
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {step === "form" && selection && (
          <div className="space-y-5">

            {selection.group === "pressec" && (
              <>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Calibre</label>
                  <select
                    name="size"
                    value={form.size}
                    onChange={handleChange}
                    className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {PEACH_SIZES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <QtyStepper qty={form.qty} setQty={setQty} label="Caixes" />
              </>
            )}

            {["albercoc", "cirera"].includes(selection.key) && (
              <>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Pes per unitat</label>
                  <div className="flex gap-2">
                    {[1, 2].map(w => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, weight: w }))}
                        className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                          form.weight === w
                            ? "bg-violet-600 border-violet-500 text-white"
                            : "bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700"
                        }`}
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
                  <label className="block text-xs text-gray-400 mb-1">
                    Pes total (kg, opcional)
                  </label>
                  <input
                    name="weight"
                    type="number"
                    step="0.1"
                    value={form.weight}
                    onChange={handleChange}
                    placeholder="Ex: 13.5"
                    className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleAdd}
                className="flex-1 rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
              >
                Afegir
              </button>
              <button
                type="button"
                onClick={() => setStep("grid")}
                className="flex-1 rounded-md bg-gray-700 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-600"
              >
                ← Tornar
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
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <div className="flex items-stretch overflow-hidden rounded-md border border-gray-600">
        <button
          type="button"
          onClick={() => setQty(qty > 1 ? qty - 1 : 1)}
          className="bg-gray-800 px-3 text-lg text-gray-200 hover:bg-gray-700"
        >−</button>
        <input
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(Number(e.target.value) || 1)}
          className="w-full bg-gray-900 text-center text-gray-100 text-sm focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setQty(qty + 1)}
          className="bg-gray-800 px-3 text-lg text-gray-200 hover:bg-gray-700"
        >+</button>
      </div>
    </div>
  );
}
