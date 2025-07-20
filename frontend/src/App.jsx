import { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState({
    customer_name: "",
    fruits: "",
    notes: "",
  });

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    const res = await axios.get('http://localhost:8000/orders');
    setOrders(res.data);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await axios.post('http://localhost:8000/orders', form);
    setForm({ customer_name: "", fruits: "", notes: "" });
    fetchOrders();
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Fruit Store Orders</h2>

      <form onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
        <input
          type="text"
          name="customer_name"
          placeholder="Customer Name"
          value={form.customer_name}
          onChange={handleChange}
        />
        <input
          type="text"
          name="fruits"
          placeholder="Fruits"
          value={form.fruits}
          onChange={handleChange}
        />
        <input
          type="text"
          name="notes"
          placeholder="Notes"
          value={form.notes}
          onChange={handleChange}
        />
        <button type="submit">Add Order</button>
      </form>

      <ul>
        {orders.map(order => (
          <li key={order.id}>
            <strong>{order.customer_name}</strong>: {order.fruits}
            {order.notes && <> ({order.notes})</>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;