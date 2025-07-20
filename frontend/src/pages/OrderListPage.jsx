import { useNavigate } from 'react-router-dom';

function OrderListPage() {
  const navigate = useNavigate();

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-center">Familia Esteve Ràfols</h1>

      <button
        onClick={() => navigate('/add')}
        className="w-full bg-black text-white py-2 rounded-lg mb-4"
      >
        + Afegir Comanda
      </button>

      {/* Placeholder order list */}
      <div className="border p-3 rounded shadow-sm">
        <strong>Maria</strong><br />
        Préssec groc: 2 caixes 16<br />
        <span className="text-sm text-gray-500">Dissabte 19/07 · Sant Pau</span>
        <div class="mt-2 flex gap-2">
          <button class="bg-yellow-400 px-2 py-1 rounded text-sm">✏️ Edit</button>
          <button class="bg-red-500 text-white px-2 py-1 rounded text-sm">❌ Delete</button>
        </div>
      </div>
    </div>
  );
}

export default OrderListPage;
