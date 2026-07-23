import { useState } from "react";
import { v4 as uuid } from "uuid";
import FruitIcon from "./FruitIcon";

const FRUIT_TYPES = [
  { key: "pressec_groc",     label: "Pressec Groc",     group: "pressec" },
  { key: "pressec_barrejat", label: "Pressec Barrejat", group: "pressec" },
  { key: "pressec_vermell",  label: "Pressec Vermell",  group: "pressec" },
  { key: "albercoc",         label: "Albercoc" },
  { key: "cirera",           label: "Cirera" },
  { key: "melo",             label: "Meló" },
  { key: "sindria",          label: "Síndria" },
];

const PEACH_SIZES = [15, 16, 18, 20, 22, 24, 26];

function initFormFromItem(item) {
  if (!item) return {};
  if (item.fruit?.startsWith("pressec")) {
    const qty = item.qty ?? 1;
    const wholeQty = Math.floor(qty);
    const hasHalf = qty % 1 !== 0;
    return { size: item.size ?? null, qty: wholeQty, halfBox: hasHalf };
  }
  if (["albercoc", "cirera"].includes(item.fruit)) return { weight: item.weight ?? 1, qty: item.qty ?? 1 };
  return { qty: item.qty ?? 1, weight: item.weight ?? "" };
}

/**
 * editItem: null (add mode) | fruit item object (edit mode)
 * When editItem is provided, the modal starts in "form" step with values pre-filled.
 * The `key` prop on the parent call should change when switching between add/edit
 * to force a fresh mount and correct lazy initialisation.
 */
export default function FruitSelectorModal({ open, onClose, onAdd, editItem = null }) {
  const isEditing = Boolean(editItem);

  const [step, setStep] = useState(() => isEditing ? "form" : "grid");
  const [selection, setSelection] = useState(() =>
    isEditing ? (FRUIT_TYPES.find(f => f.key === editItem.fruit) || null) : null
  );
  const [form, setForm] = useState(() => initFormFromItem(editItem));
  const [sizeError, setSizeError] = useState("");

  if (!open) return null;

  const reset = () => {
    setStep("grid");
    setSelection(null);
    setForm({});
    setSizeError("");
  };

  const handleFruitClick = (f) => {
    setSelection(f);
    setSizeError("");
    if (f.group === "pressec") {
      setForm({ size: null, qty: 1, halfBox: false });
    } else if (["albercoc", "cirera"].includes(f.key)) {
      setForm({ weight: 1, qty: 1 });
    } else {
      setForm({ qty: 1, weight: "" });
    }
    setStep("form");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const setQty = (v) => {
    const numVal = Number(v) || 0.5;
    setForm(prev => ({ ...prev, qty: Math.max(0.5, numVal) }));
  };

  const handleSave = () => {
    if (!selection) return;

    if (selection.group === "pressec") {
      const sizeValue = Number(form.size);
      if (!Number.isFinite(sizeValue) || sizeValue <= 0) {
        setSizeError("Tria un calibre abans d'afegir");
        return;
      }
      setSizeError("");
    }

    let item;
    if (selection.group === "pressec") {
      const baseQty = Number(form.qty);
      const finalQty = form.halfBox ? baseQty + 0.5 : baseQty;
      item = { id: uuid(), fruit: selection.key, size: Number(form.size), qty: finalQty, weight: null };
    } else if (["albercoc", "cirera"].includes(selection.key)) {
      item = { id: uuid(), fruit: selection.key, qty: Number(form.qty), weight: Number(form.weight) };
    } else {
      item = {
        id: uuid(),
        fruit: selection.key,
        qty: Number(form.qty),
        weight: form.weight !== "" && form.weight !== null ? Number(form.weight) : null,
      };
    }
    onAdd(item);
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-stone-900 border border-stone-700 p-5 shadow-2xl">

        {/* Header */}
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-base font-bold text-gray-100">
            {step === "grid" ? "Selecciona fruita" : (
              <span className="flex items-center gap-2">
                {selection && <FruitIcon fruit={selection.key} size={22} />}
                <span>{selection?.label}</span>
                {isEditing && <span className="text-xs text-amber-400 font-normal ml-1">· Editant</span>}
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

        {/* Fruit grid */}
        {step === "grid" && (
          <div className="grid grid-cols-2 gap-2.5">
            {FRUIT_TYPES.map(f => (
              <button
                key={f.key}
                onClick={() => handleFruitClick(f)}
                className="rounded-xl border border-stone-700 bg-stone-800 p-3 text-sm font-medium text-gray-100 hover:border-amber-500 hover:bg-stone-700 transition-all flex items-center gap-2"
              >
                <FruitIcon fruit={f.key} size={28} />
                <span className="text-left leading-tight">{f.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Form */}
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
                        onClick={() => {
                          setForm(prev => ({ ...prev, size: s }));
                          setSizeError("");
                        }}
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
                  <div className="mt-2 text-center text-xs text-amber-400">
                    {sizeError || (form.size ? "" : "Tria un calibre per continuar")}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-stone-400 uppercase tracking-wide font-medium mb-2">Caixes</label>
                  <div className="flex items-stretch gap-2 overflow-hidden">
                    <div className="flex-1 flex items-stretch overflow-hidden rounded-xl border border-stone-600">
                      <button
                        type="button"
                        onClick={() => setQty(Math.max(0.5, form.qty - 1))}
                        className="bg-stone-800 px-4 text-xl text-stone-200 hover:bg-stone-700 transition-colors font-light"
                      >
                        &minus;
                      </button>
                      <input
                        type="number"
                        min={0.5}
                        step={0.5}
                        value={form.qty}
                        onChange={(e) => setQty(Number(e.target.value) || 0.5)}
                        className="w-full bg-stone-900 text-center text-gray-100 text-sm font-semibold focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setQty(form.qty + 1)}
                        className="bg-stone-800 px-4 text-xl text-stone-200 hover:bg-stone-700 transition-colors font-light"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, halfBox: !prev.halfBox }))}
                      className="px-4 py-2.5 rounded-xl border-2 font-semibold text-sm transition-all flex items-center justify-center"
                      style={form.halfBox || false
                        ? { backgroundColor: "#F59E0B", borderColor: "#F59E0B", color: "#1C1917" }
                        : { backgroundColor: "#292524", borderColor: "#44403C", color: "#D6D3D1" }
                      }
                      title="Afegir mitja caixa"
                    >
                      + 1/2
                    </button>
                  </div>
                  <div className="mt-2 text-center text-xs text-stone-400">
                    Total: <span className="font-semibold text-stone-200">{(form.qty + (form.halfBox ? 0.5 : 0)).toFixed(1)}</span> caixes
                  </div>
                </div>
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
                onClick={handleSave}
                disabled={selection?.group === "pressec" && (!form.size || Number.isNaN(Number(form.size)))}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-stone-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: "#F59E0B" }}
              >
                {isEditing ? "Actualitzar" : "Afegir"}
              </button>
              <button
                type="button"
                onClick={() => isEditing ? (reset(), onClose()) : setStep("grid")}
                className="flex-1 rounded-xl bg-stone-700 px-4 py-2.5 text-sm font-medium text-stone-200 hover:bg-stone-600 transition-colors"
              >
                {isEditing ? "Cancel·lar" : "← Tornar"}
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
