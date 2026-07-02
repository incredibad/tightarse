import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, ArrowLeft, Clock, Loader2, RefreshCw, MoreVertical, ExternalLink, Trash2, Pencil, Check, X } from "lucide-react";
import { api } from "../api";
import PriceSparkline from "../components/PriceSparkline";
import StorePill from "../components/StorePill";
import { Tooltip, ImageZoom } from "../components/Tooltip";
import { normalizePackageSize, normalizeCupPrice, formatCupPrice } from "../utils";

function ProductImage({ src }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700">
        <svg className="w-6 h-6 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      </div>
    );
  }
  return (
    <ImageZoom src={src} alt="" className="w-full h-full bg-white p-1">
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        className="w-full h-full object-contain"
        onError={() => setFailed(true)}
      />
    </ImageZoom>
  );
}

export default function ItemDetail() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [products, setProducts] = useState([]);
  const [histories, setHistories] = useState({});
  const [loading, setLoading] = useState(true);
  const [rescraping, setRescraping] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const nameInputRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => { loadData(); }, [itemId]);

  useEffect(() => {
    if (!openMenuId) return;
    function handleOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [openMenuId]);

  async function loadData() {
    setLoading(true);
    try {
      const [itemData, productsData] = await Promise.all([
        api.getItem(Number(itemId)),
        api.getProducts(Number(itemId)),
      ]);
      setItem(itemData);
      setProducts(productsData);
      const historyMap = {};
      await Promise.all(productsData.map(async (p) => {
        historyMap[p.id] = await api.getProductHistory(p.id);
      }));
      setHistories(historyMap);
    } finally {
      setLoading(false);
    }
  }

  function startEditingName() {
    setNameInput(item.name);
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.select(), 0);
  }

  async function saveItemName() {
    const name = nameInput.trim();
    if (!name || name === item.name) { setEditingName(false); return; }
    await api.updateItem(Number(itemId), { name });
    setItem((prev) => ({ ...prev, name }));
    setEditingName(false);
  }

  function cancelEditingName() {
    setEditingName(false);
  }

  async function handleDeleteItem() {
    if (!confirm(`Delete "${item.name}" and all its tracked products?`)) return;
    await api.deleteItem(Number(itemId));
    navigate("/");
  }

  async function handleDelete(productId) {
    if (!confirm("Remove this product?")) return;
    setOpenMenuId(null);
    await api.deleteProduct(productId);
    loadData();
  }

  async function handleRescrape() {
    setRescraping(true);
    try {
      await api.rescrapeItem(Number(itemId));
      await loadData();
    } finally {
      setRescraping(false);
    }
  }

  async function handleToggle(productId) {
    setOpenMenuId(null);
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

  if (!item) return <div className="p-4 text-gray-500 dark:text-gray-400">Item not found.</div>;

  const _comparablePrice = (p) => (p.cup_price != null ? normalizeCupPrice(p.cup_price, p.cup_label) : null) ?? p.current_price;
  const activeProducts = products.filter((p) => p.active && p.in_stock !== false);
  const cheapestPrice = activeProducts.length
    ? Math.min(...activeProducts.filter((p) => _comparablePrice(p) != null).map(_comparablePrice))
    : null;

  const _sortKey = (p) => {
    if (!p.active) return 2;
    if (p.in_stock === false) return 1;
    return 0;
  };
  const sorted = [...products].sort((a, b) => {
    const ka = _sortKey(a), kb = _sortKey(b);
    if (ka !== kb) return ka - kb;
    const ca = _comparablePrice(a);
    const cb = _comparablePrice(b);
    if (ca == null && cb == null) return 0;
    if (ca == null) return 1;
    if (cb == null) return -1;
    return ca - cb;
  });

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/")} className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          {editingName ? (
            <>
              <input
                ref={nameInputRef}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveItemName(); if (e.key === "Escape") cancelEditingName(); }}
                className="page-header flex-1 min-w-0 text-xl bg-transparent border-b-2 border-brand-500 focus:outline-none text-gray-900 dark:text-white"
              />
              <button onClick={saveItemName} className="text-brand-600 hover:text-brand-700 shrink-0"><Check size={18} /></button>
              <button onClick={cancelEditingName} className="text-gray-400 hover:text-gray-600 shrink-0"><X size={16} /></button>
            </>
          ) : (
            <>
              <h1 className="page-header text-xl truncate">{item.name}</h1>
              <button onClick={startEditingName} className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors shrink-0" title="Rename">
                <Pencil size={14} />
              </button>
            </>
          )}
        </div>
        <button
          onClick={handleRescrape}
          disabled={rescraping}
          className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-50 transition-colors shrink-0"
          title="Refresh prices"
        >
          <RefreshCw size={18} className={rescraping ? "animate-spin" : ""} />
        </button>
        <button
          onClick={handleDeleteItem}
          className="text-gray-400 dark:text-gray-500 hover:text-red-400 transition-colors shrink-0"
          title="Delete item"
        >
          <Trash2 size={18} />
        </button>
        <button
          onClick={() => navigate(`/items/${itemId}/add-product`)}
          className="flex items-center gap-1 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors shrink-0"
        >
          <Plus size={16} /> Product
        </button>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <p className="text-sm">No products tracked yet.</p>
          <button
            onClick={() => navigate(`/items/${itemId}/add-product`)}
            className="mt-3 text-brand-600 text-sm font-medium hover:underline"
          >
            Add your first product →
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {sorted.map((p) => {
            const history = histories[p.id] || [];
            const isCheapest = p.active && _comparablePrice(p) != null && _comparablePrice(p) === cheapestPrice;
            const isOpen = openMenuId === p.id;

            return (
              <li
                key={p.id}
                className={`bg-white dark:bg-gray-800 border rounded-xl shadow-sm flex items-stretch ${
                  p.in_stock === false ? "border-red-400" : isCheapest ? "border-brand-400" : "border-gray-200 dark:border-gray-700"
                }`}
              >
                {/* 3-dot menu (left slot) */}
                <div className="relative flex items-center pl-3 shrink-0" ref={isOpen ? menuRef : null}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(isOpen ? null : p.id); }}
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors p-0.5 rounded"
                  >
                    <MoreVertical size={16} />
                  </button>
                  {isOpen && (
                    <div className="absolute left-0 top-8 z-30 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 min-w-[140px]">
                      <button
                        onClick={() => { setOpenMenuId(null); navigate(`/items/${itemId}/products/${p.id}/history`); }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        Price history
                      </button>
                      <button
                        onClick={() => handleToggle(p.id)}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        {p.active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                {/* Main content */}
                <div className={`flex-1 flex items-center gap-3 px-3 py-2 min-w-0 ${!p.active ? "opacity-40" : ""}`}>
                  {/* Left: name + meta */}
                  <div className="flex-1 min-w-0">
                    <Tooltip content={p.name}>
                      <p className="font-medium text-gray-900 dark:text-gray-100 text-sm leading-tight truncate">
                        {p.name}
                      </p>
                    </Tooltip>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <StorePill name={p.store_name} />
                      {p.package_size && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">{normalizePackageSize(p.package_size)}</span>
                      )}
                      {p.last_scraped_at && (
                        <span className="text-xs text-gray-300 dark:text-gray-600 flex items-center gap-0.5">
                          <Clock size={10} /> {formatAge(p.last_scraped_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: price */}
                  <div className="text-right shrink-0">
                    {p.in_stock === false ? (
                      <p className="font-bold text-lg leading-tight text-red-500">N/A</p>
                    ) : (
                      <>
                        <div className="flex items-center justify-end gap-1.5">
                          {!!p.on_special && p.was_price != null && (
                            <span className="text-xs text-gray-400 dark:text-gray-500 line-through">${p.was_price.toFixed(2)}</span>
                          )}
                          <p className={`font-bold text-lg leading-tight ${!!p.on_special ? "text-red-500 dark:text-yellow-400" : "text-gray-500 dark:text-gray-300"}`}>
                            {p.current_price != null ? `$${p.current_price.toFixed(2)}` : "—"}
                          </p>
                        </div>
                        {p.cup_price != null && p.cup_label && (
                          <p className="text-xs text-gray-400 dark:text-gray-500">{formatCupPrice(p.cup_price, p.cup_label)}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* External link */}
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center px-3 border-l border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors shrink-0"
                >
                  <ExternalLink size={15} />
                </a>

                {/* Image */}
                <div className="w-16 h-16 shrink-0 border-l border-gray-200 dark:border-gray-700 rounded-r-xl overflow-hidden">
                  <ProductImage src={p.image_url} />
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
