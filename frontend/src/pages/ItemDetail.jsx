import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, ArrowLeft, Trash2, ToggleLeft, ToggleRight, Clock, Loader2, TrendingDown } from "lucide-react";
import { api } from "../api";
import PriceSparkline from "../components/PriceSparkline";

export default function ItemDetail() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [products, setProducts] = useState([]);
  const [histories, setHistories] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [itemId]);

  async function loadData() {
    setLoading(true);
    try {
      const [itemData, productsData] = await Promise.all([api.getItem(Number(itemId)), api.getProducts(Number(itemId))]);
      setItem(itemData);
      setProducts(productsData);

      const historyMap = {};
      await Promise.all(
        productsData.map(async (p) => {
          historyMap[p.id] = await api.getProductHistory(p.id);
        })
      );
      setHistories(historyMap);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(productId) {
    if (!confirm("Remove this product?")) return;
    await api.deleteProduct(productId);
    loadData();
  }

  async function handleToggle(productId) {
    await api.toggleProduct(productId);
    loadData();
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader2 className="animate-spin text-brand-500" size={28} />
      </div>
    );
  }

  if (!item) return <div className="p-4 text-gray-500">Item not found.</div>;

  const activeProducts = products.filter((p) => p.active);
  const cheapestPrice = activeProducts.length
    ? Math.min(...activeProducts.filter((p) => p.current_price != null).map((p) => p.current_price))
    : null;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/")} className="text-gray-400 hover:text-gray-700 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{item.name}</h1>
          {item.category && <p className="text-sm text-gray-400">{item.category}</p>}
        </div>
        <button
          onClick={() => navigate(`/items/${itemId}/add-product`)}
          className="flex items-center gap-1 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors shrink-0"
        >
          <Plus size={16} /> Product
        </button>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">No products tracked yet.</p>
          <button
            onClick={() => navigate(`/items/${itemId}/add-product`)}
            className="mt-3 text-brand-600 text-sm font-medium hover:underline"
          >
            Add your first product →
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {products.map((p) => {
            const history = histories[p.id] || [];
            const isCheapest = p.current_price != null && p.current_price === cheapestPrice;
            return (
              <li key={p.id} className={`bg-white border rounded-xl p-4 shadow-sm ${!p.active ? "opacity-50" : ""} ${isCheapest ? "border-brand-400" : "border-gray-200"}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-gray-900 text-sm leading-tight">{p.name}</p>
                      {isCheapest && (
                        <span className="flex items-center gap-0.5 text-xs bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full font-medium">
                          <TrendingDown size={11} /> Cheapest
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{p.store_name}</p>
                    {p.last_scraped_at && (
                      <p className="text-xs text-gray-300 mt-0.5 flex items-center gap-1">
                        <Clock size={10} /> {formatAge(p.last_scraped_at)}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-lg text-gray-900">
                      {p.current_price != null ? `$${p.current_price.toFixed(2)}` : "—"}
                    </p>
                  </div>
                </div>

                {history.length > 1 && (
                  <div className="mt-3">
                    <PriceSparkline data={history} />
                  </div>
                )}

                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => handleToggle(p.id)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    {p.active ? <ToggleRight size={16} className="text-brand-500" /> : <ToggleLeft size={16} />}
                    {p.active ? "Active" : "Paused"}
                  </button>
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline ml-auto">
                    View on store →
                  </a>
                  <button onClick={() => handleDelete(p.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function formatAge(isoString) {
  const diff = Date.now() - new Date(isoString + "Z").getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
