import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Loader2, ShoppingBag, RotateCcw, Square, CheckSquare, Trash2, ShoppingCart, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import ConfirmModal from "../components/ConfirmModal";
import StorePill from "../components/StorePill";
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
  const navigate = useNavigate();
  const checklistInputRef = useRef(null);
  const [journey, setJourney] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [collapsedStores, setCollapsedStores] = useState({});
  const [checklist, setChecklist] = useState([]);
  const [checklistCollapsed, setChecklistCollapsed] = useState(false);
  const [checklistInput, setChecklistInput] = useState("");
  const [checklistEditing, setChecklistEditing] = useState(null);
  const [checklistTracking, setChecklistTracking] = useState(null);
  const [trackConfirm, setTrackConfirm] = useState(null);
  const [checkedItems, setCheckedItems] = useState(() => {
    try {
      const saved = localStorage.getItem("ta_journey_checked");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [showChecklist, setShowChecklist] = useState(true);

  useEffect(() => {
    api.getJourney().then((data) => { setJourney(data); setLoading(false); });
    api.getChecklist().then(setChecklist).catch(() => {});
    api.getSettings().then((rows) => {
      const val = rows.find((r) => r.key === "include_checklist_in_journey")?.value;
      setShowChecklist(val !== "false");
    }).catch(() => {});

  }, []);

  function toggleAlternatives(e, itemId) {
    e.stopPropagation();
    setExpanded((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  }

  function toggleChecklist() {
    const next = !showChecklist;
    setShowChecklist(next);
    api.updateSettings({ include_checklist_in_journey: next ? "true" : "false" }).catch(() => {});
  }

  function toggleStore(storeId) {
    setCollapsedStores((prev) => ({ ...prev, [storeId]: !prev[storeId] }));
  }

  function toggleShoppingItem(itemId) {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      localStorage.setItem("ta_journey_checked", JSON.stringify([...next]));
      return next;
    });
  }

  async function toggleChecklistItem(item) {
    const checked = item.checked ? 0 : 1;
    setChecklist((prev) => prev.map((i) => i.id === item.id ? { ...i, checked } : i));
    await api.updateChecklistItem(item.id, { checked }).catch(() => {});
  }

  async function addChecklistItem(e) {
    e.preventDefault();
    const name = checklistInput.trim();
    if (!name) return;
    setChecklistInput("");
    const item = await api.createChecklistItem(name);
    setChecklist((prev) => [item, ...prev]);
  }

  function removeChecklistItem(id) {
    setChecklist((prev) => prev.filter((i) => i.id !== id));
    api.deleteChecklistItem(id).catch(() => {});
  }

  async function clearCheckedChecklistItems() {
    setChecklist((prev) => prev.filter((i) => !i.checked));
    await api.clearCheckedItems().catch(() => {});
  }

  async function trackChecklistItem(item) {
    setChecklistTracking(item.id);
    setTrackConfirm(null);
    try {
      const newItem = await api.createItem({ name: item.name });
      removeChecklistItem(item.id);
      navigate(`/items/${newItem.id}/add-product`);
    } finally {
      setChecklistTracking(null);
    }
  }

  function commitChecklistEdit() {
    if (!checklistEditing) return;
    const name = checklistEditing.value.trim();
    if (name && name !== checklist.find((i) => i.id === checklistEditing.id)?.name) {
      setChecklist((prev) => prev.map((i) => i.id === checklistEditing.id ? { ...i, name } : i));
      api.updateChecklistItem(checklistEditing.id, { name }).catch(() => {});
    }
    setChecklistEditing(null);
  }

  function resetJourney() {
    setCheckedItems(new Set());
    localStorage.removeItem("ta_journey_checked");
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
    <div className="p-3 space-y-3">
      {trackConfirm && (
        <ConfirmModal
          title="Add to Shopping List?"
          message={`This will create a new Shopping List item called "${trackConfirm.name}", remove it from your checklist, and take you to the product search page.`}
          confirmLabel="Add to List"
          onConfirm={() => trackChecklistItem(trackConfirm)}
          onCancel={() => setTrackConfirm(null)}
        />
      )}
      <div className="flex items-center justify-between">
        <h1 className="page-header text-xl">
          Journey <span className="text-gray-400 dark:text-gray-500 font-normal">(${journey.estimated_total.toFixed(2)})</span>
        </h1>
        <div className="flex items-center gap-2">
          {checkedItems.size > 0 && (
            <button
              onClick={resetJourney}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <RotateCcw size={13} /> Reset
            </button>
          )}
          <button
            onClick={toggleChecklist}
            title={showChecklist ? "Hide checklist" : "Show checklist"}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              showChecklist
                ? "border-brand-300 dark:border-brand-700 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300"
                : "border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            {showChecklist ? <EyeOff size={13} /> : <Eye size={13} />}
            Checklist
          </button>
        </div>
      </div>

      {/* Checklist accordion */}
      {showChecklist && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden border-l-4 border-l-gray-400 dark:border-l-gray-500">
          <button
            onClick={() => setChecklistCollapsed((p) => !p)}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 active:opacity-70 transition-opacity"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center rounded text-xs font-bold leading-none shrink-0 px-1.5 py-0.5 bg-gray-500 text-white">My Checklist</span>
            </div>
            <div className="flex items-center gap-2">
              {!checklistCollapsed && checklist.some((i) => i.checked) && (
                <span className="text-xs text-gray-400">{checklist.filter((i) => !i.checked).length} left</span>
              )}
              {checklistCollapsed
                ? <ChevronDown size={14} className="text-gray-400 shrink-0" />
                : <ChevronUp size={14} className="text-gray-400 shrink-0" />}
            </div>
          </button>
          {!checklistCollapsed && (
            <div>
              {/* Add item form */}
              <form onSubmit={addChecklistItem} className="flex gap-2 px-3 py-2.5 border-b border-gray-100 dark:border-gray-700">
                <input
                  ref={checklistInputRef}
                  value={checklistInput}
                  onChange={(e) => setChecklistInput(e.target.value)}
                  placeholder="Add an item..."
                  className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-white placeholder-gray-400"
                />
                <button
                  type="submit"
                  disabled={!checklistInput.trim()}
                  className="px-3 py-1.5 rounded-lg bg-brand-500 text-white text-sm font-medium disabled:opacity-40 active:opacity-70"
                >
                  Add
                </button>
              </form>

              {checklist.length === 0 && (
                <p className="px-4 py-4 text-sm text-gray-400 text-center">No items yet.</p>
              )}

              {/* Unchecked items */}
              {checklist.filter((i) => !i.checked).length > 0 && (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {checklist.filter((i) => !i.checked).map((item) => (
                    <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                      <button onClick={() => toggleChecklistItem(item)} className="shrink-0 text-gray-400 hover:text-brand-500 active:opacity-70 transition-colors">
                        <Square size={20} />
                      </button>
                      {checklistEditing?.id === item.id ? (
                        <input
                          autoFocus
                          value={checklistEditing.value}
                          onChange={(e) => setChecklistEditing((p) => ({ ...p, value: e.target.value }))}
                          onBlur={commitChecklistEdit}
                          onKeyDown={(e) => { if (e.key === "Enter") commitChecklistEdit(); if (e.key === "Escape") setChecklistEditing(null); }}
                          className="flex-1 text-sm bg-transparent border-b border-brand-500 focus:outline-none text-gray-900 dark:text-white"
                        />
                      ) : (
                        <span className="flex-1 text-sm text-gray-900 dark:text-white cursor-text" onClick={() => setChecklistEditing({ id: item.id, value: item.name })}>
                          {item.name}
                        </span>
                      )}
                      <button onClick={() => setTrackConfirm(item)} disabled={checklistTracking === item.id} title="Track on Shopping List" className="shrink-0 text-gray-400 hover:text-brand-500 active:opacity-70 transition-colors disabled:opacity-40">
                        <ShoppingCart size={16} />
                      </button>
                      <button onClick={() => removeChecklistItem(item.id)} className="shrink-0 text-gray-400 hover:text-red-500 active:opacity-70 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Checked items */}
              {checklist.filter((i) => i.checked).length > 0 && (
                <div>
                  <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                      Checked ({checklist.filter((i) => i.checked).length})
                    </span>
                    <button onClick={clearCheckedChecklistItems} className="text-xs text-red-500 font-medium active:opacity-70">
                      Clear
                    </button>
                  </div>
                  <ul className="divide-y divide-gray-100 dark:divide-gray-700 opacity-60">
                    {checklist.filter((i) => i.checked).map((item) => (
                      <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                        <button onClick={() => toggleChecklistItem(item)} className="shrink-0 text-brand-500 active:opacity-70 transition-colors">
                          <CheckSquare size={20} />
                        </button>
                        <span className="flex-1 text-sm text-gray-500 dark:text-gray-400 line-through">{item.name}</span>
                        <button onClick={() => removeChecklistItem(item.id)} className="shrink-0 text-gray-400 hover:text-red-500 active:opacity-70 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Store accordions */}
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
            className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 active:opacity-70 transition-opacity"
          >
            <div className="flex items-center gap-2">
              <StorePill name={store.store_name} long />
              {isCollapsed && <span className="text-xs text-gray-400">{store.items.length} item{store.items.length !== 1 ? "s" : ""}</span>}
            </div>
            <div className="flex items-center gap-2">
              <p className="font-bold text-gray-900 dark:text-white">${store.subtotal.toFixed(2)}</p>
              {isCollapsed ? <ChevronDown size={14} className="text-gray-400 shrink-0" /> : <ChevronUp size={14} className="text-gray-400 shrink-0" />}
            </div>
          </button>
          {!isCollapsed && <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {[...store.items].sort((a, b) => a.item_name.localeCompare(b.item_name)).map((item) => {
              const hasAlts = item.all_products.length > 1;
              const isOpen = expanded[item.item_id];
              const isChecked = checkedItems.has(item.item_id);
              const onSpecial = item.cheapest_product.on_special;
              const cp = item.cheapest_product;
              return (
                <li
                  key={item.item_id}
                  onClick={() => toggleShoppingItem(item.item_id)}
                  className={`flex divide-x cursor-pointer select-none transition-colors ${isChecked ? "bg-gray-100 dark:bg-gray-900 divide-gray-200 dark:divide-gray-800" : "divide-gray-100 dark:divide-gray-700"}`}
                >
                  {/* Main row */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center">
                      {/* Name — 50% */}
                      <div className="w-[50%] min-w-0 px-3 py-2">
                        <p className={`font-medium text-sm truncate ${isChecked ? "line-through text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-white"}`} title={item.item_name}>{item.item_name}</p>
                        <p className={`text-xs truncate ${isChecked ? "text-gray-300 dark:text-gray-600" : "text-gray-400"}`} title={cp.product_name}>{cp.product_name}</p>
                      </div>
                      {/* Cup price */}
                      <div className={`w-[22%] px-1 py-2 shrink-0 ${isChecked ? "opacity-40" : ""}`}>
                        <CupPrice price={cp.cup_price} label={cp.cup_label} />
                      </div>
                      {/* Was price */}
                      <div className={`w-[11%] px-1 py-2 text-right shrink-0 ${isChecked ? "opacity-40" : ""}`}>
                        <p className="text-[10px] text-gray-400 line-through leading-tight">
                          {onSpecial && cp.was_price != null ? `$${cp.was_price.toFixed(2)}` : ""}
                        </p>
                      </div>
                      {/* Price */}
                      <div className={`w-[17%] px-2 py-2 text-right shrink-0 ${isChecked ? "opacity-40" : ""}`}>
                        <p className={`text-sm font-bold leading-tight ${onSpecial ? "text-red-500 dark:text-yellow-400" : "text-gray-900 dark:text-white"}`}>
                          ${cp.price.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {isOpen && hasAlts && (
                      <div onClick={(e) => e.stopPropagation()} className="border-t border-gray-100 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 divide-y divide-gray-100 dark:divide-gray-600">
                        {item.all_products.slice(1).map((alt) => (
                          <div key={alt.product_id} className="flex items-center">
                            <div className="w-[50%] min-w-0 px-4 py-2 flex items-center gap-2">
                              <StorePill name={alt.store_name} short />
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={alt.product_name}>{alt.product_name}</p>
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
                      onClick={(e) => toggleAlternatives(e, item.item_id)}
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
