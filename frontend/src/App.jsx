import { Routes, Route } from 'react-router-dom';
import OrderListPage from './pages/OrderListPage';
import AddOrderPage from './pages/AddOrderPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<OrderListPage />} />
      <Route path="/add" element={<AddOrderPage />} />
    </Routes>
  );
}

export default App;
