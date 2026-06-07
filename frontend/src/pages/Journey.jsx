import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Loader2, ShoppingBag, TrendingDown } from "lucide-react";
import { api } from "../api";

export default function Journey() {
  const [journey, setJourney] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    api.getJourney().then((data) => { setJourney(data); setLoading(false); });
  }, []);

  function toggleAlternatives(itemId) {
    setExpanded((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader2 className="animate-spin text-brand-500" size={28} />
      </div>
    );
  }

  if (!journey || journey.stores.length === 0) {
    return (
      <div className="p-4 text-center py-16 text-gray-400">
        <ShoppingBag className="mx-auto mb-3 opacity-30" size={48} />
        <p className="text-sm">No priced products tracked yet.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Shopping Journey</h1>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm flex justify-between items-center">
        <div>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Estimated total</p>
          <p className="text-3xl font-bold text-gray-900">${journey.estimated_total.toFixed(2)}</p>
        </div>
        {journey.potential_saving > 0 && (
          <div className="text-right">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">You save</p>
            <p className="text-xl font-bold text-brand-600 flex items-center gap-1 justify-end">
              <TrendingDown size={16} /> ${journey.potential_saving.toFixed(2)}
            </p>
          </div>
        )}
      </div>

      {journey.stores.map((store) => (
        <div key={store.store_id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="font-semibold text-gray-800">{store.store_name}</h2>
            <p className="font-bold text-gray-900">${store.subtotal.toFixed(2)}</p>
          </div>
          <ul className="divide-y divide-gray-100">
            {store.items.map((item) => {
              const hasAlts = item.all_products.length > 1;
              const isOpen = expanded[item.item_id];
              return (
                <li key={item.item_id}>
                  <div className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{item.item_name}</p>
                      <p className="text-xs text-gray-400 truncate">{item.cheapest_product.product_name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {hasAlts && (
                        <button
                          onClick={() => toggleAlternatives(item.item_id)}
                          className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 px-2 py-0.5 rounded-full transition-colors"
                        >
                          {item.all_products.length - 1} alt{item.all_products.length - 1 !== 1 ? "s" : ""}
                          {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      )}
                      <span className="font-bold text-gray-900">${item.cheapest_product.price.toFixed(2)}</span>
                    </div>
                  </div>

                  {isOpen && hasAlts && (
                    <div className="bg-gray-50 border-t border-gray-100 px-4 py-2 space-y-2">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Alternatives</p>
                      {item.all_products.slice(1).map((alt) => (
                        <div key={alt.product_id} className="flex items-center gap-2 text-sm">
                          <span className="flex-1 text-gray-600 truncate">{alt.product_name}</span>
                          <span className="text-gray-500">${alt.price.toFixed(2)}</span>
                          <span className="text-xs text-red-400">+${(alt.price - item.cheapest_product.price).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
