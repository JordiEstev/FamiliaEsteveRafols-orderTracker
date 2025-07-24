import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Package, Pencil, Trash2, Sheet } from "lucide-react";
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

  // 1. Per-customer breakdown
  const customerOrders = {};

  for (const order of filteredOrders) {
    const customer = order.customer;
    if (!customerOrders[customer]) customerOrders[customer] = [];

    for (const item of order.fruits) {
      let description = "";

      if (item.fruit.startsWith("pressec_")) {
        const type = item.fruit.split("_")[1]; // groc, vermell, barrejat
        description = `Pressec ${type} ${item.qty} ${item.qty > 1 ? 'caixes' : 'caixa'} ${item.size}`;
      } else if (item.fruit === "albercoc" || item.fruit === "cirera") {
        description = `${capitalize(item.fruit)} ${item.qty} × ${item.weight}kg`;
      } else if (item.fruit === "melo" || item.fruit === "sindria") {
        description = `${capitalize(item.fruit)} ${item.qty} peces`;
      } else {
        description = `${capitalize(item.fruit)}: ${item.qty}`;
      }

      customerOrders[customer].push(description);
    }
  }

  for (const [customer, items] of Object.entries(customerOrders)) {
    items.forEach(item => {
      rows.push({
        Client: customer,
        Producte: item
      });
    });
  }

  // Empty row to separate
  rows.push({});
  rows.push({ Client: '--- Resum ---' });

  // 2. Summary (same as in modal)
  // Pressecs
  Object.entries(fruitSummary.pressecs).forEach(([key, list]) => {
    const [type, size] = key.split("-");
    const total = list.reduce((acc, x) => acc + x.qty, 0);
    rows.push({
      Client: `Pressec ${type} ${size}`,
      Producte: `${total} caixes`
    });
  });

  // Albercoc / Cirera
  ["albercoc", "cirera"].forEach(fruit => {
    Object.entries(fruitSummary[fruit]).forEach(([weight, list]) => {
      if (list.length > 0) {
        rows.push({
          Client: `${capitalize(fruit)} ${weight}kg`,
          Producte: `${list.length} comandes`
        });
      }
    });
  });

  // Melo / Sindria
  ["melo", "sindria"].forEach(fruit => {
    const total = fruitSummary[fruit].reduce((acc, x) => acc + x.qty, 0);
    if (total > 0) {
      rows.push({
        Client: capitalize(fruit),
        Producte: `${total} peces`
      });
    }
  });

  // Export
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Resum");
  let filename = "resum_fruita.xlsx";
  if (filterDate && filterPlace !== "Tots els llocs") {
    filename = `resum_${filterPlace.replace(/\s+/g, '')}_${filterDate}.xlsx`;
  } else if (filterDate) {
    filename = `resum_${filterDate}.xlsx`;
  } else if (filterPlace !== "Tots els llocs") {
    filename = `resum_${filterPlace.replace(/\s+/g, '')}.xlsx`;
  }
  XLSX.writeFile(workbook, filename);
}

  


  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/orders`)
      .then(res => res.json())
      .then(data => setOrders(data))
      .catch(err => {
        console.error("Error fetching orders:", err);
        alert("No s'han pogut carregar les comandes.");
      });
  }, []);

  const handleDelete = (orderId) => {
    if (!window.confirm("Segur que vols esborrar aquesta comanda?")) return;

    fetch(`${import.meta.env.VITE_API_URL}/orders/${orderId}`, {
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
  pressecs: {}, 
  albercoc: { "1": [], "2": [] },
  cirera: { "1": [], "2": [] },
  melo: [],
  sindria: []
};

for (const order of filteredOrders) {
  for (const item of order.fruits) {
    const { fruit, size, qty, weight } = item;
    const customer = order.customer;

    if (fruit.startsWith("pressec")) {
      const variant = fruit.split("_")[1];
      const key = `${variant}-${size}`;
      if (!fruitSummary.pressecs[key]) fruitSummary.pressecs[key] = [];
      fruitSummary.pressecs[key].push({ customer, qty });
    }

    if (fruit === "albercoc" || fruit === "cirera") {
      if (weight === 1 || weight === 2) {
        fruitSummary[fruit][weight].push({ customer, qty });
      }
    }

    if (fruit === "melo") {
      fruitSummary.melo.push({ customer, qty });
    }

    if (fruit === "sindria") {
      fruitSummary.sindria.push({ customer, qty });
    }
  }
}



  return (
    <div className="p-4 max-w-md mx-auto">
    <div className="flex items-center justify-center mb-4">
      <img
        src="/logopressec1.png"
        alt="Logo"
        className="h-15 w-15 mr-2"
        style={{ objectFit: "contain" }}
      />
      <h1 className="text-2xl font-bold text-center">Família Esteve Ràfols</h1>
    </div>
      <button
        onClick={() => navigate('/add')}
        className="w-full bg-black text-white py-2 rounded-lg mb-4 flex items-center justify-center"
      >
        <Plus className="inline-block w-5 h-5 mr-2 " />
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
<div className="flex gap-2 mb-4">
  <button 
    onClick={() => setShowSummary(true)}
    className="flex-1 bg-blue-500 text-white px-3 py-2 rounded flex items-center justify-center"
  >
    <Package className="w-5 h-5 mr-2 inline-block align-middle" />
    Veure resum
  </button>
  <button
    onClick={handleExport}
    className="flex-1 bg-green-500 text-white px-3 py-2 rounded flex items-center justify-center"
  >
    <Sheet className="w-5 h-5 mr-2 inline-block align-middle" />
    Exportar Excel
  </button>
</div>



      {showSummary && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-md p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-lg">
            <h2 className="text-xl font-semibold mb-4 rounded flex items-center justify-center  "><Package className="w-5 h-5 mr-2 inline-block align-middle" /> Resum</h2>

            {/* Pressecs */}
            {Object.keys(fruitSummary.pressecs).length > 0 && (
              <div className="mt-2">
                <strong className="block mb-1">Pressecs:</strong>
                {Object.entries(fruitSummary.pressecs)
                  .sort(([a], [b]) => parseInt(a.split("-")[1]) - parseInt(b.split("-")[1])) // sort by calibre
                  .map(([key, list]) => {
                    const [type, size] = key.split("-");
                    const total = list.reduce((sum, x) => sum + x.qty, 0);
                    return (
                      <details key={key} className="ml-4 mb-2">
                        <summary>Pressec {type} {size}: {total} caixes</summary>
                        <ul className="ml-4 text-sm list-disc">
                          {list.map((entry, i) => (
                            <li key={i}>{entry.qty}: {entry.customer}</li>
                          ))}
                        </ul>
                      </details>
                    );
                  })}
              </div>
            )}

            {/* Albercoc + Cirera */}
            {["albercoc", "cirera"].map(fruit => (
              Object.entries(fruitSummary[fruit]).some(([, list]) => list.length > 0) && (
                <div key={fruit} className="mt-2">
                  <strong className="block mb-1 capitalize">{fruit}:</strong>
                  {["1", "2"].map(weight => {
                    const list = fruitSummary[fruit][weight];
                    if (list.length === 0) return null;
                    const total = list.reduce((acc, x) => acc + x.qty, 0);
                    return (
                      <details key={weight} className="ml-4 mb-2">
                        <summary>{weight}kg: {list.length} comandes</summary>
                        <ul className="ml-4 text-sm list-disc">
                          {list.map((entry, i) => (
                            <li key={i}>{entry.qty}: {entry.customer}</li>
                          ))}
                        </ul>
                      </details>
                    );
                  })}
                </div>
              )
            ))}

            {/* Melo & Sindria */}
            {["melo", "sindria"].map(fruit => (
              fruitSummary[fruit].length > 0 && (
                <div key={fruit} className="mt-2">
                  <strong className="block mb-1 capitalize">{fruit}:</strong>
                  <details className="ml-4 mb-2">
                    <summary>{fruitSummary[fruit].reduce((acc, x) => acc + x.qty, 0)} peces</summary>
                    <ul className="ml-4 text-sm list-disc">
                      {fruitSummary[fruit].map((entry, i) => (
                        <li key={i}>{entry.qty}: {entry.customer}</li>
                      ))}
                    </ul>
                  </details>
                </div>
              )
            ))}

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
