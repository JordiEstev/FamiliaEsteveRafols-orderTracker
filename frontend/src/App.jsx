import { Routes, Route } from 'react-router-dom';
import OrderListPage from './pages/OrderListPage';
import AddOrderPage from './pages/AddOrderPage';
import EditOrderPage from "./pages/EditOrderPage"; 


function App() {
  return (
    <Routes>
      <Route path="/" element={<OrderListPage />} />
      <Route path="/add" element={<AddOrderPage />} />
      <Route path="/edit/:id" element={<EditOrderPage />} />
    </Routes>
  );
}

export default App;
