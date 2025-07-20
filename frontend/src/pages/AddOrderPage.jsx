import { useState } from "react";
import { useNavigate } from "react-router-dom";
import FruitSelectorModal from "../components/FruitSelectorModal";

export default function AddOrderPage() {
  const navigate = useNavigate();
  const [openFruitModal, setOpenFruitModal] = useState(false);

  const [form, setForm] = useState({
    customer: "",
    date: "",
    place: "Cantallops", // or Store 1 etc.
    notes: ""
  });

  const [fruits, setFruits] = useState([]);

  const handleBasicChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const addFruit = (item) => {
    setFruits(prev => [...prev, item]);
  };

  const removeFruit = (id) => {
    setFruits(prev => prev.filter(f => f.id !== id));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!fruits.length) {
      alert("Afegiu almenys una fruita.");
      return;
    }
    const payload = { ...form, fruits };
    console.log("Submit payload:", payload);
    // TODO: POST to backend
    navigate("/");
  };

  return (
    <div className="bg-gray-950 min-h-screen text-gray-100 p-5 font-sans">
      <form
        onSubmit={handleSubmit}
        className="max-w-md mx-auto bg-gray-900 border border-gray-800 rounded-xl shadow p-5 space-y-5"
      >
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="text-violet-500 text-3xl">+</span> Nova Comanda
        </h1>

        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-gray-400">Client</label>
          <input
            name="customer"
            placeholder="Nom del client"
            value={form.customer}
            onChange={handleBasicChange}
            className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-gray-400">Data</label>
          <input
            type="date"
            name="date"
            value={form.date}
            onChange={handleBasicChange}
            className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-gray-400">Lloc</label>
            <select
            name="place"
            value={form.place}
            onChange={handleBasicChange}
            className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option>Cantallops</option>
            <option>Magatzem</option>
            <option>Botiga Centre</option>
            <option>Botiga Nord</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-gray-400">Notes</label>
          <textarea
            name="notes"
            placeholder="Observacions..."
            value={form.notes}
            onChange={handleBasicChange}
            rows={2}
            className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs uppercase tracking-wide text-gray-400">
              Fruita ({fruits.length})
            </label>
            <button
              type="button"
              onClick={() => setOpenFruitModal(true)}
              className="text-xs font-semibold px-3 py-1 rounded-md bg-violet-600 hover:bg-violet-500"
            >
              Afegir fruita
            </button>
          </div>

          {fruits.length === 0 && (
            <div className="text-sm text-gray-500 italic">
              Encara no hi ha fruita afegida.
            </div>
          )}

          <ul className="space-y-2">
            {fruits.map(item => (
              <li
                key={item.id}
                className="flex items-start justify-between rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm"
              >
                <div className="pr-2">
                  <div className="font-medium">
                    {renderFruitLabel(item)}
                  </div>
                  <div className="text-gray-400 text-xs">
                    {renderFruitDetails(item)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeFruit(item.id)}
                  className="text-red-400 hover:text-red-300 text-xs"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="pt-4 flex gap-3">
          <button
            type="submit"
            className="flex-1 rounded-md bg-violet-600 py-2 font-semibold hover:bg-violet-500"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex-1 rounded-md bg-gray-700 py-2 font-medium hover:bg-gray-600"
          >
            Cancel·lar
          </button>
        </div>
      </form>

      <FruitSelectorModal
        open={openFruitModal}
        onClose={() => setOpenFruitModal(false)}
        onAdd={addFruit}
      />
    </div>
  );
}

function renderFruitLabel(item) {
  if (item.fruit === "pressec") {
    return `Pressec ${item.variant}`;
  }
  if (["albercoc","cirera","melo","sindria"].includes(item.fruit)) {
    const map = {
      albercoc: "Albercoc",
      cirera: "Cirera",
      melo: "Meló",
      sindria: "Síndria"
    };
    return map[item.fruit];
  }
  return item.fruit;
}

function renderFruitDetails(item) {
  if (item.fruit === "pressec") {
    return `${item.qty} caixes · calibre ${item.size}`;
  }
  if (["albercoc","cirera"].includes(item.fruit)) {
    return `${item.qty} × ${item.weightPerUnit} kg (${item.qty * item.weightPerUnit} kg total)`;
  }
  if (["melo","sindria"].includes(item.fruit)) {
    return `${item.qty} peces${item.avgWeight ? ` · ${item.avgWeight} kg/peça (~${(item.avgWeight*item.qty).toFixed(1)} kg)` : ""}`;
  }
  return "";
}