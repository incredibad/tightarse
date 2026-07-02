import { useState, useEffect } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import { List, Settings, Map, Loader2, X, TriangleAlert, CheckSquare } from "lucide-react";
import { api, clearToken, setUser, getUser } from "./api";
import Setup from "./pages/Setup";
import Login from "./pages/Login";
import ShoppingList from "./pages/ShoppingList";
import ItemDetail from "./pages/ItemDetail";
import AddProduct from "./pages/AddProduct";
import Journey from "./pages/Journey";
import ProductHistory from "./pages/ProductHistory";
import Checklist from "./pages/Checklist";
import SettingsPage from "./pages/Settings";

function DrakesStoreWarning() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const [stores, settings] = await Promise.all([api.getStores(), api.getSettings()]);
        if (cancelled) return;
        const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));

        const drakesStore = stores.find((s) => s.scraper_module === "drakes");
        if (!drakesStore) return;

        // Check if user has Drakes enabled
        const enabledVal = settingsMap[`store_${drakesStore.id}_enabled`];
        const drakesEnabled = enabledVal === undefined ? true : enabledVal !== "false";
        if (!drakesEnabled) return;

        const selectedId = settingsMap.drakes_store_id || "087";
        const mapJson = settingsMap.drakes_store_map;
        if (!mapJson) return;

        try {
          const map = JSON.parse(mapJson);
          const valid = Array.isArray(map) && map.some((s) => s.id === selectedId);
          if (!valid) setShow(true);
        } catch {}
      } catch {}
    }
    check();
    return () => { cancelled = true; };
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto flex items-start gap-3 max-w-sm w-full bg-yellow-50 dark:bg-yellow-900/40 border border-yellow-300 dark:border-yellow-700 rounded-xl shadow-lg px-4 py-3">
        <TriangleAlert size={16} className="text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
        <p className="flex-1 text-xs text-yellow-800 dark:text-yellow-200 leading-relaxed">
          Your selected Drakes store is no longer in the store list — it may have changed ID or gone offline.
          Go to <strong>Settings → Stores</strong> to pick a new one.
        </p>
        <button onClick={() => setShow(false)} className="shrink-0 text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

const LOADING = "loading";
const SETUP   = "setup";
const LOGIN   = "login";
const APP     = "app";

function NavItem({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center gap-0.5 px-4 py-2 text-xs font-medium transition-colors ${
          isActive ? "text-brand-600" : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        }`
      }
    >
      <Icon size={20} />
      {label}
    </NavLink>
  );
}

export default function App() {
  const [gate, setGate] = useState(LOADING);
  const [user, setUserState] = useState(null);

  useEffect(() => {
    // Dark mode: default to dark if no preference stored
    const stored = localStorage.getItem("ta_dark");
    const dark = stored === null ? true : stored === "true";
    document.documentElement.classList.toggle("dark", dark);
    if (stored === null) localStorage.setItem("ta_dark", "true");

    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const status = await api.authStatus();
      if (status.setup_required) {
        setGate(SETUP);
      } else if (!localStorage.getItem("ta_token")) {
        setGate(LOGIN);
      } else {
        await loadUser();
        setGate(APP);
      }
    } catch {
      setGate(LOGIN);
    }
  }

  async function loadUser() {
    try {
      const me = await api.me();
      setUser(me);
      setUserState(me);
    } catch {
      // token may be stale — let the 401 handler redirect
    }
  }

  async function handleLoginComplete() {
    await loadUser();
    setGate(APP);
  }

  function handleLogout() {
    clearToken();
    setUserState(null);
    setGate(LOGIN);
  }

  if (gate === LOADING) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="animate-spin text-brand-500" size={32} />
      </div>
    );
  }

  if (gate === SETUP) return <Setup onComplete={handleLoginComplete} />;
  if (gate === LOGIN) return <Login onComplete={handleLoginComplete} />;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
          <img src="/logo.png" alt="" className="h-6 w-auto" />
          <span className="font-logo font-semibold text-lg tracking-wide uppercase text-brand-500">Tightarse</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <div className="max-w-2xl mx-auto">
          <Routes>
            <Route path="/" element={<ShoppingList />} />
            <Route path="/checklist" element={<Checklist />} />
            <Route path="/items/:itemId" element={<ItemDetail />} />
            <Route path="/items/:itemId/add-product" element={<AddProduct />} />
            <Route path="/items/:itemId/products/:productId/history" element={<ProductHistory />} />
            <Route path="/journey" element={<Journey />} />
            <Route path="/settings" element={<SettingsPage onLogout={handleLogout} user={user} />} />
          </Routes>
        </div>
      </main>

      <DrakesStoreWarning />

      <nav className="fixed bottom-0 w-full bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-2xl mx-auto flex justify-around">
          <NavItem to="/checklist" icon={CheckSquare} label="Checklist" />
          <NavItem to="/" icon={List} label="List" />
          <NavItem to="/journey" icon={Map} label="Journey" />
          <NavItem to="/settings" icon={Settings} label="Settings" />
        </div>
      </nav>
    </div>
  );
}
