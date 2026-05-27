import { Routes, Route } from 'react-router-dom';
import OrderListPage from './pages/OrderListPage';
import AddOrderWizard from './pages/AddOrderWizard';
import EditOrderPage from "./pages/EditOrderPage";
import PickingListPage from "./pages/PickingListPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<OrderListPage />} />
      <Route path="/add" element={<AddOrderWizard />} />
      <Route path="/edit/:id" element={<EditOrderPage />} />
      <Route path="/picking" element={<PickingListPage />} />
    </Routes>
  );
}

export default App;
