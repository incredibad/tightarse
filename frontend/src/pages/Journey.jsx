import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Loader2, ShoppingBag } from "lucide-react";
import { api } from "../api";
import StorePill from "../components/StorePill";
import { Tooltip } from "../components/Tooltip";
import { formatCupPrice, STORE_COLORS } from "../utils";

function CupPrice({ price, label }) {
  if (price == null || !label) return null;
  const formatted = formatCupPrice(price, label);
  if (!formatted) return null;
  const slash = formatted.indexOf("/");
  const value = slash >= 0 ? formatted.slice(0, slash) : formatted;
  const unit = slash >= 0 ? formatted.slice(slash) : "";
  return (
    <p className="text-xs text-gray-400 leading-tight text-right">
      {value}<span className="text-[10px]">{unit}</span>
    </p>
  );
}

export default function Journey() {
  const [journey, setJourney] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [collapsedStores, setCollapsedStores] = useState({});

  useEffect(() => {
    api.getJourney().then((data) => { setJourney(data); setLoading(false); });
  }, []);

  function toggleAlternatives(itemId) {
    setExpanded((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  }

  function toggleStore(storeId) {
    setCollapsedStores((prev) => ({ ...prev, [storeId]: !prev[storeId] }));
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

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 shadow-sm flex justify-between items-center">
        <div>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Estimated total</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">${journey.estimated_total.toFixed(2)}</p>
        </div>
      </div>

      {journey.stores.map((store) => {
        const storeColor = STORE_COLORS[store.store_name]?.bg;
        const isCollapsed = collapsedStores[store.store_id];
        return (
        <div
          key={store.store_id}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden border-l-4"
          style={storeColor ? { borderLeftColor: storeColor } : {}}
        >
          <button
            onClick={() => toggleStore(store.store_id)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 active:opacity-70 transition-opacity"
          >
            <div className="flex items-center gap-2">
              <StorePill name={store.store_name} />
              {isCollapsed && <span className="text-xs text-gray-400">{store.items.length} item{store.items.length !== 1 ? "s" : ""}</span>}
            </div>
            <div className="flex items-center gap-2">
              <p className="font-bold text-gray-900 dark:text-white">${store.subtotal.toFixed(2)}</p>
              {isCollapsed ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronUp size={14} className="text-gray-400 shrink-0" />}
            </div>
          </button>
          {!isCollapsed && <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {store.items.map((item) => {
              const hasAlts = item.all_products.length > 1;
              const isOpen = expanded[item.item_id];
              const onSpecial = item.cheapest_product.on_special;
              const cp = item.cheapest_product;
              return (
                <li key={item.item_id} className="flex divide-x divide-gray-100 dark:divide-gray-700">
                  {/* Main row */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center">
                      {/* Name — 50% */}
                      <div className="w-[50%] min-w-0 px-4 py-3">
                        <Tooltip content={item.item_name}>
                          <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{item.item_name}</p>
                        </Tooltip>
                        <Tooltip content={cp.product_name}>
                          <p className="text-xs text-gray-400 truncate">{cp.product_name}</p>
                        </Tooltip>
                      </div>
                      {/* Cup price — two lines */}
                      <div className="w-[22%] px-1 py-3 shrink-0">
                        <CupPrice price={cp.cup_price} label={cp.cup_label} />
                      </div>
                      {/* Was price */}
                      <div className="w-[11%] px-1 py-3 text-right shrink-0">
                        <p className="text-[10px] text-gray-400 line-through leading-tight">
                          {onSpecial && cp.was_price != null ? `$${cp.was_price.toFixed(2)}` : ""}
                        </p>
                      </div>
                      {/* Price */}
                      <div className="w-[17%] px-2 py-3 text-right shrink-0">
                        <p className={`text-sm font-bold leading-tight ${onSpecial ? "text-red-500 dark:text-yellow-400" : "text-gray-900 dark:text-white"}`}>
                          ${cp.price.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {isOpen && hasAlts && (
                      <div className="border-t border-gray-100 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 divide-y divide-gray-100 dark:divide-gray-600">
                        {item.all_products.slice(1).map((alt) => (
                          <div key={alt.product_id} className="flex items-center">
                            <div className="w-[50%] min-w-0 px-4 py-2 flex items-center gap-2">
                              <StorePill name={alt.store_name} short />
                              <Tooltip content={alt.product_name}>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{alt.product_name}</p>
                              </Tooltip>
                            </div>
                            <div className="w-[22%] px-1 py-2 shrink-0">
                              <CupPrice price={alt.cup_price} label={alt.cup_label} />
                            </div>
                            <div className="w-[11%] px-1 py-2 shrink-0" />
                            <div className="w-[17%] px-2 py-2 text-right shrink-0">
                              <p className="text-xs font-medium text-gray-600 dark:text-gray-300 leading-tight">${alt.price.toFixed(2)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Full-height alts toggle */}
                  {hasAlts ? (
                    <button
                      onClick={() => toggleAlternatives(item.item_id)}
                      className="flex flex-col items-center justify-center gap-0.5 w-10 shrink-0 bg-gray-50 dark:bg-white/[0.04] hover:bg-gray-100 dark:hover:bg-white/[0.08] text-gray-400 dark:text-gray-500 transition-colors"
                    >
                      <span className="text-[10px] font-semibold leading-none">{item.all_products.length - 1}</span>
                      {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  ) : (
                    <div className="w-10 shrink-0" />
                  )}
                </li>
              );
            })}
          </ul>}
        </div>
        );
      })}
    </div>
  );
}
