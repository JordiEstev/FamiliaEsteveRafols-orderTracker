import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import FruitSelectorModal from "../components/FruitSelectorModal"; // adjust if path differs

export default function EditOrderPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [form, setForm] = useState({
    customer: "",
    date: "",
    place: "Cantallops",
    notes: ""
  });
  const [fruits, setFruits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openFruitModal, setOpenFruitModal] = useState(false);

  // Fetch order by ID
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/orders`)
      .then(res => res.json())
      .then(data => {
        const order = data.find(o => o.id === parseInt(id));
        if (!order) throw new Error("Not found");
        setForm({
          customer: order.customer,
          date: order.date,
          place: order.place,
          notes: order.notes || ""
        });
        setFruits(order.fruits);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading order:", err);
        alert("No s'ha pogut carregar la comanda.");
        navigate("/");
      });
  }, [id]);

  const handleBasicChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!fruits.length) {
      alert("Afegiu almenys una fruita.");
      return;
    }
    const payload = {
      ...form,
      fruits: fruits.map(f => ({
        fruit: f.fruit,
        qty: f.qty,
        size: f.size ?? null,
        weight: f.weight ?? null
      }))
    };

    fetch(`${import.meta.env.VITE_API_URL}/orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to update");
        return res.json();
      })
      .then(() => {
        navigate("/");
      })
      .catch(err => {
        console.error("Error updating:", err);
        alert("Error en actualitzar la comanda.");
      });
  };

  const addFruit = (item) => setFruits(prev => [...prev, item]);
  const removeFruit = (fid) => setFruits(prev => prev.filter(f => f.id !== fid));

  if (loading) return <div className="p-5 text-white">Carregant comanda...</div>;

  return (
    <div className="bg-gray-950 min-h-screen text-gray-100 p-5 font-sans">
      <form
        onSubmit={handleSubmit}
        className="max-w-md mx-auto bg-gray-900 border border-gray-800 rounded-xl shadow p-5 space-y-5"
      >
        <h1 className="text-2xl font-bold flex items-center gap-2">
          ✏️ Editar Comanda
        </h1>

        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-gray-400">Client</label>
          <input
            name="customer"
            value={form.customer}
            onChange={handleBasicChange}
            className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm"
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
            className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-gray-400">Lloc</label>
          <select
            name="place"
            value={form.place}
            onChange={handleBasicChange}
            className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm"
          >
            <option>Sant Pau</option>
            <option>Cantallops</option>
            <option>Vilafranca</option>
            <option>La Girada</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-gray-400">Notes</label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleBasicChange}
            rows={2}
            className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm"
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
            <div className="text-sm text-gray-500 italic">Cap fruita afegida.</div>
          )}

          <ul className="space-y-2">
            {fruits.map(item => (
              <li
                key={item.id || `${item.fruit}-${item.size}-${item.qty}`}
                className="flex items-start justify-between rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm"
              >
                <div className="pr-2">
                  <div className="font-medium">{renderFruitLabel(item)}</div>
                  <div className="text-gray-400 text-xs">{renderFruitDetails(item)}</div>
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

        <FruitSelectorModal
          open={openFruitModal}
          onClose={() => setOpenFruitModal(false)}
          onAdd={addFruit}
        />

        <div className="pt-4 flex gap-3">
          <button
            type="submit"
            className="flex-1 rounded-md bg-violet-600 py-2 font-semibold hover:bg-violet-500"
          >
            Actualitzar
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
    </div>
  );
}

function renderFruitLabel(item) {
  if (item.fruit === "pressec_barrejat") {
  return "Pressec barrejat";
    }
    if (item.fruit.startsWith("pressec_")) {
    const variant = item.fruit.split("_")[1];
    return `Pressec ${variant}`;
    }

  const map = {
    albercoc: "Albercoc",
    cirera: "Cirera",
    melo: "Meló",
    sindria: "Síndria"
  };
  return map[item.fruit] || item.fruit;
}

function renderFruitDetails(item) {
  if (item.fruit.startsWith("pressec_")) {
    return `${item.qty} caixes · calibre ${item.size}`;
  }
  if (item.fruit === "albercoc" || item.fruit === "cirera") {
    const total = item.qty * item.weight;
    return `${item.qty} × ${item.weight} kg = ${total} kg`;
  }
  if (item.fruit === "melo" || item.fruit === "sindria") {
    return `${item.qty} peces${item.weight ? ` · ${item.weight} kg` : ''}`;
  }
  return "";
}