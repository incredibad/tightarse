import { Routes, Route, NavLink } from "react-router-dom";
import { ShoppingCart, List, Settings, Map } from "lucide-react";
import ShoppingList from "./pages/ShoppingList";
import ItemDetail from "./pages/ItemDetail";
import AddProduct from "./pages/AddProduct";
import Journey from "./pages/Journey";
import SettingsPage from "./pages/Settings";

function NavItem({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center gap-0.5 px-4 py-2 text-xs font-medium transition-colors ${
          isActive ? "text-brand-600" : "text-gray-500 hover:text-gray-800"
        }`
      }
    >
      <Icon size={20} />
      {label}
    </NavLink>
  );
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <ShoppingCart size={22} className="text-brand-600" />
        <span className="font-bold text-lg tracking-tight">Tightarse</span>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <Routes>
          <Route path="/" element={<ShoppingList />} />
          <Route path="/items/:itemId" element={<ItemDetail />} />
          <Route path="/items/:itemId/add-product" element={<AddProduct />} />
          <Route path="/journey" element={<Journey />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-white border-t border-gray-200 flex justify-around">
        <NavItem to="/" icon={List} label="List" />
        <NavItem to="/journey" icon={Map} label="Journey" />
        <NavItem to="/settings" icon={Settings} label="Settings" />
      </nav>
    </div>
  );
}
