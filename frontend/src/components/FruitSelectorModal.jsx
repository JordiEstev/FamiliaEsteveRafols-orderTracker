import { useState } from "react";
import { v4 as uuid } from "uuid";

const FRUIT_TYPES = [
  { key: "pressec-groc", label: "Pressec Groc", cat: "pressec", variant: "groc" },
  { key: "pressec-vermell", label: "Pressec Vermell", cat: "pressec", variant: "vermell" },
  { key: "albercoc", label: "Albercoc" },
  { key: "cirera", label: "Cirera" },
  { key: "melo", label: "Meló" },
  { key: "sindria", label: "Síndria" }
];

const PEACH_SIZES = [16,18,20,22,24,26];

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
    // initialize form depending on type
    if (f.cat === "pressec") {
      setForm({ size: 22, qty: 1 });
    } else if (["albercoc","cirera"].includes(f.key)) {
      setForm({ weightPerUnit: 1, qty: 1 });
    } else {
      // melo / sindria
      setForm({ qty: 1, avgWeight: "" });
    }
    setStep("form");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const inc = (field) => setForm(prev => ({ ...prev, [field]: Number(prev[field]||0)+1 }));
  const dec = (field) => setForm(prev => ({ ...prev, [field]: Math.max(1, Number(prev[field]||1)-1) }));

  const handleAdd = () => {
    if (!selection) return;
    let item;
    if (selection.cat === "pressec") {
      item = {
        id: uuid(),
        fruit: "pressec",
        variant: selection.variant,
        size: Number(form.size),
        qty: Number(form.qty),
        unit: "caixa"
      };
    } else if (["albercoc","cirera"].includes(selection.key)) {
      item = {
        id: uuid(),
        fruit: selection.key,
        weightPerUnit: Number(form.weightPerUnit),
        qty: Number(form.qty),
        unit: "kg"
      };
    } else {
      item = {
        id: uuid(),
        fruit: selection.key,
        qty: Number(form.qty),
        avgWeight: form.avgWeight ? Number(form.avgWeight) : undefined,
        unit: "peça"
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
            {step === "grid" ? "Selecciona fruita" : "Configura"}
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
          <div className="space-y-4">
            <div className="text-gray-200 font-medium">
              {selection.label}
            </div>

            {selection.cat === "pressec" && (
              <>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Mida (calibre)</label>
                  <select
                    name="size"
                    value={form.size}
                    onChange={handleChange}
                    className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {PEACH_SIZES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <NumberStepper
                  label="Caixes"
                  value={form.qty}
                  setValue={v => setForm(prev => ({ ...prev, qty: v }))}
                />
              </>
            )}

            {["albercoc","cirera"].includes(selection.key) && (
              <>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Pes per unitat</label>
                  <div className="flex gap-2">
                    {[1,2].map(w => (
                      <button
                        key={w}
                        onClick={() => setForm(prev => ({ ...prev, weightPerUnit: w }))}
                        className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                          form.weightPerUnit === w
                            ? "bg-violet-600 border-violet-500 text-white"
                            : "bg-gray-800 border-gray-600 text-gray-200 hover:bg-gray-700"
                        }`}
                      >
                        {w} kg
                      </button>
                    ))}
                  </div>
                </div>
                <NumberStepper
                  label="Quantitat (unitats d'aquest pes)"
                  value={form.qty}
                  setValue={v => setForm(prev => ({ ...prev, qty: v }))}
                />
              </>
            )}

            {["melo","sindria"].includes(selection.key) && (
              <>
                <NumberStepper
                  label="Nombre de peces"
                  value={form.qty}
                  setValue={v => setForm(prev => ({ ...prev, qty: v }))}
                />
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Pes mitjà per peça (opcional, kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    name="avgWeight"
                    value={form.avgWeight}
                    onChange={handleChange}
                    className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="p. ex. 3.2"
                  />
                </div>
              </>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleAdd}
                className="flex-1 rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
              >
                Afegir
              </button>
              <button
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

/* Helper component for quantity */
function NumberStepper({ label, value, setValue }) {
  const inc = () => setValue(Number(value || 0) + 1);
  const dec = () => setValue(Math.max(1, Number(value || 1) - 1));
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <div className="flex items-stretch rounded-md overflow-hidden border border-gray-600">
        <button
          type="button"
          onClick={dec}
          className="bg-gray-800 px-3 text-lg text-gray-200 hover:bg-gray-700"
        >−</button>
        <input
          type="number"
            className="w-full bg-gray-900 text-center text-gray-100 text-sm focus:outline-none"
          value={value}
          onChange={e => setValue(Number(e.target.value))}
          min={1}
        />
        <button
          type="button"
          onClick={inc}
          className="bg-gray-800 px-3 text-lg text-gray-200 hover:bg-gray-700"
        >+</button>
      </div>
    </div>
  );
}