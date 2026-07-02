import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ChevronRight, Loader2, RefreshCw, Search, X } from "lucide-react";
import { api } from "../api";
import StorePill from "../components/StorePill";
import { normalizeCupPrice, formatCupPrice } from "../utils";

export default function ShoppingList() {
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [rescraping, setRescraping] = useState(false);
  const [newName, setNewName] = useState("");
  const [filter, setFilter] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [itemsData, productsData] = await Promise.all([api.getItems(), api.getProducts()]);
      setItems(itemsData);
      setProducts(productsData);
    } finally {
      setLoading(false);
    }
  }

  function cheapestForItem(itemId) {
    const comparable = (p) => (p.cup_price != null ? normalizeCupPrice(p.cup_price, p.cup_label) : null) ?? p.current_price;
    const ps = products.filter((p) => p.item_id === itemId && p.active && p.in_stock !== false && comparable(p) != null);
    if (!ps.length) return null;
    return ps.reduce((a, b) => (comparable(a) < comparable(b) ? a : b));
  }

  async function handleRescrapeAll() {
    setRescraping(true);
    try {
      await api.rescrapeAll();
      await loadData();
    } finally {
      setRescraping(false);
    }
  }

  async function handleAddItem(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    const item = await api.createItem({ name: newName.trim() });
    setNewName("");
    setShowAddForm(false);
    navigate(`/items/${item.id}/add-product`);
  }

  async function handleDeleteItem(e, id) {
    e.stopPropagation();
    if (!confirm("Delete this item and all its tracked products?")) return;
    await api.deleteItem(id);
    loadData();
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader2 className="animate-spin text-brand-500" size={28} />
      </div>
    );
  }

  const filteredItems = filter.trim()
    ? items.filter((item) => item.name.toLowerCase().includes(filter.toLowerCase()))
    : items;

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="page-header text-xl">Shopping List</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRescrapeAll}
            disabled={rescraping}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-50 transition-colors"
            title="Refresh all prices"
          >
            <RefreshCw size={18} className={rescraping ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={16} /> Add item
          </button>
        </div>
      </div>

      {items.length > 0 && (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter items…"
            className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {filter && (
            <button onClick={() => setFilter("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleAddItem} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3 shadow-sm">
          <h2 className="modal-header">New item</h2>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Item name (e.g. Oat milk)"
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
<div className="flex gap-2">
            <button type="submit" className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-medium py-2 rounded-lg text-sm transition-colors">
              Create & add products
            </button>
            <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {items.length === 0 && !showAddForm ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <ShoppingCartIcon className="mx-auto mb-3 opacity-30" size={48} />
          <p className="text-sm">No items yet. Add something to track.</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <p className="text-sm text-center text-gray-400 py-8">No items match "{filter}".</p>
      ) : (
        <ul className="space-y-1.5">
          {filteredItems.map((item) => {
            const cheapest = cheapestForItem(item.id);
            const itemProducts = products.filter((p) => p.item_id === item.id);
            const productCount = itemProducts.length;
            const allOos = productCount > 0 && itemProducts.every((p) => p.in_stock === false);
            return (
              <li
                key={item.id}
                onClick={() => navigate(`/items/${item.id}`)}
                className={`bg-white dark:bg-gray-800 border rounded-xl px-3 py-2 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm ${
                  allOos ? "border-red-400" : "border-gray-200 dark:border-gray-700"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{item.name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-gray-400 dark:text-gray-500">{productCount} product{productCount !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                {allOos ? (
                  <p className="font-bold text-red-500 shrink-0">N/A</p>
                ) : cheapest ? (
                  <div className="text-right shrink-0">
                    <div className="flex items-center justify-end gap-1.5">
                      <StorePill name={cheapest.store_name} />
                      {cheapest.current_price != null && (
                        <p className="font-bold text-brand-600">${cheapest.current_price.toFixed(2)}</p>
                      )}
                    </div>
                    {cheapest.cup_price != null && cheapest.cup_label && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">{formatCupPrice(cheapest.cup_price, cheapest.cup_label)}</p>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">No price yet</span>
                )}
                <ChevronRight size={16} className="text-gray-300 dark:text-gray-600 shrink-0" />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ShoppingCartIcon({ size, className }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  );
}
