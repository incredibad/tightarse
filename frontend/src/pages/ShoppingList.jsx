import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ChevronRight, Tag, MapPin, Loader2, Trash2 } from "lucide-react";
import { api } from "../api";

export default function ShoppingList() {
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
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
    const ps = products.filter((p) => p.item_id === itemId && p.current_price != null);
    if (!ps.length) return null;
    return ps.reduce((a, b) => (a.current_price < b.current_price ? a : b));
  }

  async function handleAddItem(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    const item = await api.createItem({ name: newName.trim(), category: newCategory.trim() || null });
    setNewName("");
    setNewCategory("");
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

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Shopping List</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus size={16} /> Add item
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddItem} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-sm">
          <h2 className="font-semibold text-gray-800">New item</h2>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Item name (e.g. Oat milk)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="Category (optional)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <div className="flex gap-2">
            <button type="submit" className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-medium py-2 rounded-lg text-sm transition-colors">
              Create & add products
            </button>
            <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {items.length === 0 && !showAddForm ? (
        <div className="text-center py-16 text-gray-400">
          <ShoppingCartIcon className="mx-auto mb-3 opacity-30" size={48} />
          <p className="text-sm">No items yet. Add something to track.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const cheapest = cheapestForItem(item.id);
            const productCount = products.filter((p) => p.item_id === item.id).length;
            return (
              <li
                key={item.id}
                onClick={() => navigate(`/items/${item.id}`)}
                className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors shadow-sm"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{item.name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {item.category && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Tag size={11} /> {item.category}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{productCount} product{productCount !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                {cheapest ? (
                  <div className="text-right shrink-0">
                    <p className="font-bold text-brand-600">${cheapest.current_price.toFixed(2)}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 justify-end">
                      <MapPin size={11} /> {cheapest.store_name}
                    </p>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 shrink-0">No price yet</span>
                )}
                <button
                  onClick={(e) => handleDeleteItem(e, item.id)}
                  className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                >
                  <Trash2 size={15} />
                </button>
                <ChevronRight size={16} className="text-gray-300 shrink-0" />
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
