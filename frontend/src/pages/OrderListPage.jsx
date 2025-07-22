import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Package, Pencil, Trash2 } from "lucide-react";
import * as XLSX from 'xlsx';



function OrderListPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterPlace, setFilterPlace] = useState("Tots els llocs");
  const [showSummary, setShowSummary] = useState(false);

  function handleExport() {
  const rows = [];

  // Add Pressecs
  Object.entries(fruitSummary.pressecs).forEach(([key, qty]) => {
    const [type, size] = key.split("-");
    rows.push({
      Fruit: `Pressec ${type}`,
      Calibre: size,
      Quantitat: `${qty} caixes`
    });
  });

  // Albercoc and Cirera
  ["albercoc", "cirera"].forEach(fruit => {
    Object.entries(fruitSummary[fruit]).forEach(([weight, count]) => {
      if (count > 0) {
        rows.push({
          Fruit: capitalize(fruit),
          Pes: `${weight}kg`,
          Quantitat: `${count} comandes`
        });
      }
    });
  });

  // Melo & Sindria
  if (fruitSummary.melo > 0) {
    rows.push({ Fruit: "Meló", Quantitat: `${fruitSummary.melo} peces` });
  }
  if (fruitSummary.sindria > 0) {
    rows.push({ Fruit: "Síndria", Quantitat: `${fruitSummary.sindria} peces` });
  }

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Resum");

  XLSX.writeFile(workbook, "resum_fruita.xlsx");
}
  


  useEffect(() => {
    fetch("http://localhost:8000/orders")
      .then(res => res.json())
      .then(data => setOrders(data))
      .catch(err => {
        console.error("Error fetching orders:", err);
        alert("No s'han pogut carregar les comandes.");
      });
  }, []);

  const handleDelete = (orderId) => {
    if (!window.confirm("Segur que vols esborrar aquesta comanda?")) return;

    fetch(`http://localhost:8000/orders/${orderId}`, {
      method: "DELETE"
    })
      .then(res => {
        if (!res.ok) throw new Error("Error deleting");
        setOrders(prev => prev.filter(o => o.id !== orderId));  
      })
      .catch(err => {
        console.error("Delete error:", err);
        alert("No s'ha pogut eliminar la comanda.");
      });
    
  };

  const filteredOrders = orders.filter(order => {
    const matchesName = order.customer.toLowerCase().includes(search.toLowerCase());
    const matchesDate = filterDate === "" || order.date === filterDate;
    const matchesPlace = filterPlace === "Tots els llocs" || order.place === filterPlace;
    return matchesName && matchesDate && matchesPlace;
  });

  const fruitSummary = {
    pressecs: {}, // key = type + size
    albercoc: { "1": 0, "2": 0 },
    cirera: { "1": 0, "2": 0 },
    melo: 0,
    sindria: 0
  };

  for (const order of filteredOrders) {
    for (const item of order.fruits) {
      const { fruit, size, qty, weight } = item;

      if (fruit.startsWith("pressec")) {
        const variant = fruit.split("_")[1]; // groc, vermell, barrejat
        const key = `${variant}-${size}`;
        fruitSummary.pressecs[key] = (fruitSummary.pressecs[key] || 0) + qty;
      }

      if (fruit === "albercoc" || fruit === "cirera") {
        if (weight === 1 || weight === 2) {
          fruitSummary[fruit][weight] += 1;
        }
      }

      if (fruit === "melo") {
        fruitSummary.melo += qty;
      }

      if (fruit === "sindria") {
        fruitSummary.sindria += qty;
      }
    }
  }


  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-center">Família Esteve Ràfols</h1>

      <button
        onClick={() => navigate('/add')}
        className="w-full bg-black text-white py-2 rounded-lg mb-4"
      >
        <Plus className="inline-block w-4 h-4 mr-1" />
Afegir Comanda

      </button>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <input
          type="date"
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
          className="p-2 border rounded w-full"
        />
        <select
          value={filterPlace}
          onChange={e => setFilterPlace(e.target.value)}
          className="p-2 border rounded w-full"
        >
          <option>Tots els llocs</option>
          <option>Sant Pau</option>
          <option>Cantallops</option>
          <option>Vilafranca</option>
          <option>La Girada</option>
        </select>
      </div>

      <button
        onClick={() => setShowSummary(true)}
        className="bg-blue-500 text-white px-3 py-1 rounded mb-4"
      >
        <Package className="inline-block w-4 h-4 mr-1" />
Veure resum

      </button>
      <button
  onClick={handleExport}
  className="bg-green-500 text-white px-3 py-1 rounded mb-4 ml-2"
>
  ⬇️ Exportar Excel
</button>


      {showSummary && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-md p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-lg">
            <h2 className="text-xl font-semibold mb-4">📦 Resum</h2>

            {/* Pressecs */}
            {Object.keys(fruitSummary.pressecs).length > 0 && (
              <div className="mb-3">
                <strong>Pressecs:</strong>
                <ul className="ml-4 list-disc">
                  {Object.entries(fruitSummary.pressecs).map(([key, qty]) => {
                    const [type, size] = key.split("-");
                    return (
                      <li key={key}>{`Pressec ${type} calibre ${size}: ${qty} caixes`}</li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Albercoc */}
            {(fruitSummary.albercoc["1"] > 0 || fruitSummary.albercoc["2"] > 0) && (
              <div className="mb-3">
                <strong>Albercoc:</strong>
                <ul className="ml-4 list-disc">
                  {fruitSummary.albercoc["1"] > 0 && <li>1kg: {fruitSummary.albercoc["1"]} comandes</li>}
                  {fruitSummary.albercoc["2"] > 0 && <li>2kg: {fruitSummary.albercoc["2"]} comandes</li>}
                </ul>
              </div>
            )}

            {/* Cirera */}
            {(fruitSummary.cirera["1"] > 0 || fruitSummary.cirera["2"] > 0) && (
              <div className="mb-3">
                <strong>Cirera:</strong>
                <ul className="ml-4 list-disc">
                  {fruitSummary.cirera["1"] > 0 && <li>1kg: {fruitSummary.cirera["1"]} comandes</li>}
                  {fruitSummary.cirera["2"] > 0 && <li>2kg: {fruitSummary.cirera["2"]} comandes</li>}
                </ul>
              </div>
            )}

            {/* Melo + Sindria */}
            {fruitSummary.melo > 0 && (
              <div className="mb-3"><strong>Meló:</strong> {fruitSummary.melo} peces</div>
            )}
            {fruitSummary.sindria > 0 && (
              <div className="mb-3"><strong>Síndria:</strong> {fruitSummary.sindria} peces</div>
            )}

            <div className="text-right mt-4">
              <button onClick={() => setShowSummary(false)} className="px-3 py-1 rounded bg-gray-300 hover:bg-gray-400">
                Tancar
              </button>
            </div>
        </div>
      </div>
      )}

      {/* Orders from backend */}
      {filteredOrders.length === 0 ? (
        <div className="text-gray-500 text-center">No hi ha comandes.</div>
      ) : (
        filteredOrders.map(order => (
          <div key={order.id} className="border p-3 rounded shadow-sm mb-4">
            <strong>{order.customer}</strong><br />
            {order.fruits.map((fruit, idx) => (
              <div key={idx}>{renderFruitDetails(fruit)}</div>
            ))}
            <span className="text-sm text-gray-500">
              {formatDate(order.date)} · {order.place}
            </span>
<div className="mt-2 flex gap-2">
  <button
    onClick={() => navigate(`/edit/${order.id}`)}
    className="bg-white text-black border border-black px-3 py-1 rounded-lg text-sm flex items-center gap-1"
  >
    <Pencil className="w-4 h-4" />
    Editar
  </button>
  <button
    onClick={() => handleDelete(order.id)}
    className="bg-white text-black border border-black px-3 py-1 rounded-lg text-sm flex items-center gap-1"
  >
    <Trash2 className="w-4 h-4" />
    Eliminar
  </button>
</div>

          </div>
        ))
      )}
    </div>
    
  );
}

function renderFruitDetails(item) {
  if (item.fruit.startsWith("pressec_")) {
    const variant = item.fruit.split("_")[1];
    return `Préssec ${variant}: ${item.qty} caixes ${item.size}`;
  }
  if (item.fruit === "albercoc" || item.fruit === "cirera") {
    const total = item.qty * item.weight;
    return `${capitalize(item.fruit)}: ${item.qty} × ${item.weight} kg = ${total} kg`;
  }
  if (item.fruit === "melo" || item.fruit === "sindria") {
    return `${capitalize(item.fruit)}: ${item.qty} peces${item.weight ? ` · ${item.weight} kg` : ''}`;
  }
  return `${capitalize(item.fruit)}: ${item.qty}`;
}

function formatDate(dateStr) {
  const [yyyy, mm, dd] = dateStr.split("-");
  return `${dd}/${mm}`;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}


export default OrderListPage;
