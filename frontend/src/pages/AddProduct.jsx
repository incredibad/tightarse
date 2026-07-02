import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Check, X, Loader2, Search, Link2, ExternalLink } from "lucide-react";
import { api } from "../api";
import StorePill from "../components/StorePill";
import { Tooltip, ImageZoom } from "../components/Tooltip";
import { STORE_COLORS, normalizePackageSize, mergeSearchResults, formatCupPrice } from "../utils";

function ProductImage({ src }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700">
        <svg className="w-5 h-5 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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

export default function AddProduct() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [stores, setStores] = useState([]);
  const [selectedStoreIds, setSelectedStoreIds] = useState(new Set());
  const [trackedUrls, setTrackedUrls] = useState(new Set());
  const [addMode, setAddMode] = useState("search"); // "search" | "url"

  // URL section
  const [urlInput, setUrlInput] = useState("");
  const [urlResult, setUrlResult] = useState(null);
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState(null);

  // Search section
  const [searchQuery, setSearchQuery] = useState(location.state?.itemName ?? "");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Multi-select
  const [selectedResults, setSelectedResults] = useState(new Map()); // url → result
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // URL confirm flow (single item with name editing)
  const [picked, setPicked] = useState(null);
  const [confirmName, setConfirmName] = useState("");

  useEffect(() => {
    Promise.all([api.getStores(), api.getSettings(), api.getProducts(itemId)]).then(([data, settings, existing]) => {
      const settingsMap = Object.fromEntries(settings.map((r) => [r.key, r.value]));
      const orderJson = settingsMap.store_order;
      if (orderJson) {
        try {
          const order = JSON.parse(orderJson);
          const indexMap = Object.fromEntries(order.map((id, i) => [id, i]));
          data = [...data].sort((a, b) => (indexMap[a.id] ?? 999) - (indexMap[b.id] ?? 999));
        } catch {}
      }
      setStores(data);
      setSelectedStoreIds(new Set(data.filter((s) => s.supports_search && s.enabled).map((s) => s.id)));
      setTrackedUrls(new Set(existing.map((p) => p.url)));
    });
  }, [itemId]);

  function toggleStore(id) {
    setSelectedStoreIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSearchResults([]);
    setSelectedResults(new Map());
  }

  function toggleResult(result) {
    setSelectedResults((prev) => {
      const next = new Map(prev);
      if (next.has(result.url)) next.delete(result.url);
      else next.set(result.url, result);
      return next;
    });
  }

  async function lookupUrl(url) {
    const trimmed = url.trim();
    if (!trimmed.startsWith("http")) return;
    setUrlLoading(true);
    setUrlError(null);
    setUrlResult(null);
    try {
      const result = await api.previewUrl(trimmed);
      setUrlResult(result);
    } catch (err) {
      setUrlError(err.message);
    } finally {
      setUrlLoading(false);
    }
  }

  function handleUrlPaste(e) {
    setTimeout(() => {
      const val = e.target.value;
      if (val.startsWith("http")) lookupUrl(val);
    }, 0);
  }

  async function handleSearch(e) {
    e?.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    const searchable = stores.filter((s) => s.supports_search && selectedStoreIds.has(s.id));
    if (!searchable.length) return;
    setSearchLoading(true);
    setSearchError(null);
    setSearchResults([]);
    setHasSearched(false);
    setSelectedResults(new Map());
    try {
      const perStore = await Promise.all(
        searchable.map((s) =>
          api.searchStore(s.id, q)
            .then((results) => results.map((r) => ({ ...r, store_id: s.id })))
            .catch(() => [])
        )
      );
      setSearchResults(mergeSearchResults(perStore, q));
      setHasSearched(true);
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleAddSelected() {
    const toAdd = [...selectedResults.values()];
    if (!toAdd.length) return;
    setSaving(true);
    setSaveError(null);
    const errors = [];
    await Promise.all(
      toAdd.map((r) =>
        api.createProduct({
          item_id: Number(itemId),
          store_id: r.store_id,
          name: r.name,
          url: r.url,
          current_price: r.price,
          cup_price: r.cup_price ?? null,
          cup_label: r.cup_label ?? null,
          package_size: r.package_size ?? null,
          image_url: r.image_url ?? null,
        })
          .catch((err) => { errors.push(`${r.name}: ${err?.message || err}`); })
      )
    );
    setSaving(false);
    const succeeded = toAdd.length - errors.length;
    if (errors.length === 0) {
      navigate(`/items/${itemId}`);
    } else if (succeeded > 0) {
      setSaveError(`Added ${succeeded}. Failed: ${errors.join("; ")}`);
    } else {
      setSaveError(errors.length === 1 ? errors[0] : `All ${errors.length} products failed. ${errors[0]}`);
      console.error("Add product errors:", errors);
    }
  }

  async function handleConfirmUrl() {
    if (!picked) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api.createProduct({
        item_id: Number(itemId),
        store_id: picked.store_id,
        name: confirmName,
        url: picked.url,
        current_price: picked.price,
        cup_price: picked.cup_price ?? null,
        cup_label: picked.cup_label ?? null,
        package_size: picked.package_size ?? null,
        image_url: picked.image_url ?? null,
      });
      navigate(`/items/${itemId}`);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // URL confirm screen
  if (picked) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => { setPicked(null); setSaveError(null); }} className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="page-header text-xl">Confirm product</h1>
        </div>

        {saveError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{saveError}</div>
        )}

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Product name</label>
            <input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="flex gap-4 flex-wrap">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Price</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">
                {picked.price != null ? `$${picked.price.toFixed(2)}` : "Unknown"}
              </p>
              {picked.cup_price != null && picked.cup_label && (
                <p className="text-xs text-gray-400 dark:text-gray-500">{formatCupPrice(picked.cup_price, picked.cup_label)}</p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Store</p>
              <div className="mt-1"><StorePill name={picked.store_name} /></div>
            </div>
            {picked.package_size && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Size</p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-0.5">{normalizePackageSize(picked.package_size)}</p>
              </div>
            )}
          </div>
          <a href={picked.url} target="_blank" rel="noopener noreferrer" className="block text-xs text-blue-500 hover:underline truncate">
            {picked.url}
          </a>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleConfirmUrl}
            disabled={saving || !confirmName.trim()}
            className="flex-1 flex justify-center items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {saving ? "Saving…" : "Save product"}
          </button>
          <button
            onClick={() => { setPicked(null); setSaveError(null); }}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5 pb-32">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(`/items/${itemId}`)} className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="page-header text-xl">Add Products</h1>
      </div>

      {saveError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{saveError}</div>
      )}

      {/* Mode tabs */}
      <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <button
          onClick={() => setAddMode("search")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${addMode === "search" ? "bg-brand-600 text-white" : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
        >
          <Search size={14} /> Search
        </button>
        <button
          onClick={() => setAddMode("url")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium border-l border-gray-200 dark:border-gray-700 transition-colors ${addMode === "url" ? "bg-brand-600 text-white" : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
        >
          <Link2 size={14} /> Paste a URL
        </button>
      </div>

      {/* URL section */}
      {addMode === "url" && <div className="space-y-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Supported:{" "}
          {stores.filter((s) => s.enabled !== false && s.available !== false).map((s) => s.name).join(", ") || "No stores enabled"}
        </p>
        <div className="flex gap-2">
          <input
            value={urlInput}
            onChange={(e) => { setUrlInput(e.target.value); setUrlResult(null); setUrlError(null); }}
            onKeyDown={(e) => e.key === "Enter" && lookupUrl(urlInput)}
            onPaste={handleUrlPaste}
            placeholder="https://www.woolworths.com.au/shop/productdetails/…"
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
          <button
            onClick={() => lookupUrl(urlInput)}
            disabled={urlLoading || !urlInput.trim()}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 disabled:opacity-40 rounded-lg text-sm font-medium transition-colors shrink-0"
          >
            {urlLoading ? <Loader2 size={15} className="animate-spin" /> : "Look up"}
          </button>
        </div>

        {urlError && <p className="text-sm text-red-600">{urlError}</p>}

        {urlResult && (
          <button
            onClick={() => { setPicked(urlResult); setConfirmName(urlResult.name); }}
            className="w-full text-left bg-white dark:bg-gray-800 border border-brand-300 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm hover:bg-brand-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{urlResult.name}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <StorePill name={urlResult.store_name} />
                {urlResult.package_size && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">{normalizePackageSize(urlResult.package_size)}</span>
                )}
              </div>
              {urlResult.cup_price != null && urlResult.cup_label && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{formatCupPrice(urlResult.cup_price, urlResult.cup_label)}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              {urlResult.price != null && <p className="font-bold text-gray-900 dark:text-gray-100">${urlResult.price.toFixed(2)}</p>}
              <span className="text-xs text-brand-600 font-medium">Tap to add →</span>
            </div>
          </button>
        )}
      </div>}

      {/* Search section */}
      {addMode === "search" && <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {stores.map((s) => {
            if (!s.supports_search || !s.enabled) return null;
            const selected = selectedStoreIds.has(s.id);
            const color = STORE_COLORS[s.name] || { bg: "#6B7280", text: "#fff" };
            return (
              <button
                key={s.id}
                onClick={() => toggleStore(s.id)}
                className="px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-colors"
                style={
                  selected
                    ? { backgroundColor: color.bg, borderColor: color.bg, color: color.text }
                    : { backgroundColor: "transparent", borderColor: color.bg, color: color.bg }
                }
              >
                {s.name}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products…"
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
          <button
            type="submit"
            disabled={searchLoading || !searchQuery.trim() || selectedStoreIds.size === 0}
            className="flex items-center gap-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium px-3 py-2 rounded-lg text-sm transition-colors"
          >
            {searchLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          </button>
        </form>

        {searchError && <p className="text-sm text-red-600">{searchError}</p>}

        {searchResults.length > 0 && (
          <ul className="space-y-2">
            {searchResults.map((r, i) => {
              const isSelected = selectedResults.has(r.url);
              const alreadyTracked = trackedUrls.has(r.url);
              return (
                <li
                  key={i}
                  className={`rounded-xl border flex items-stretch shadow-sm transition-colors ${
                    alreadyTracked
                      ? "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-60"
                      : isSelected
                      ? "bg-brand-50 dark:bg-brand-900/20 border-brand-400"
                      : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <div
                    role="button"
                    onClick={() => !alreadyTracked && toggleResult(r)}
                    className={`flex-1 flex items-center gap-3 px-4 py-2.5 min-w-0 ${
                      alreadyTracked ? "cursor-not-allowed" : "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        alreadyTracked ? "bg-gray-300 dark:bg-gray-600 border-gray-300 dark:border-gray-600" : isSelected ? "bg-brand-600 border-brand-600" : "border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      {alreadyTracked && <Check size={11} className="text-white opacity-50" />}
                      {!alreadyTracked && isSelected && <Check size={11} className="text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Tooltip content={r.name}>
                        <p className="font-medium text-gray-900 dark:text-gray-100 text-sm leading-tight truncate">{r.name}</p>
                      </Tooltip>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <StorePill name={r.store_name} />
                        {alreadyTracked && <span className="text-xs text-gray-400 dark:text-gray-500 italic">Already added</span>}
                        {r.package_size && !alreadyTracked && (
                          <span className="text-xs text-gray-400 dark:text-gray-500">{normalizePackageSize(r.package_size)}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-lg leading-tight text-gray-900 dark:text-gray-100">
                        {r.price != null ? `$${r.price.toFixed(2)}` : "—"}
                      </p>
                      {r.cup_price != null && r.cup_label && (
                        <p className="text-xs text-gray-400 dark:text-gray-500">{formatCupPrice(r.cup_price, r.cup_label)}</p>
                      )}
                    </div>
                  </div>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center px-3 border-l border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors shrink-0"
                  >
                    <ExternalLink size={15} />
                  </a>
                  <div className="w-16 h-16 shrink-0 border-l border-gray-200 dark:border-gray-700 rounded-r-xl overflow-hidden">
                    <ProductImage src={r.image_url} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!searchLoading && hasSearched && searchResults.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No results found.</p>
        )}
      </div>}

      {/* Floating add bar */}
      {selectedResults.size > 0 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-20">
          <button
            onClick={handleAddSelected}
            disabled={saving}
            className="w-full flex justify-center items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl shadow-lg text-sm transition-colors"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {saving
              ? "Adding…"
              : `Add ${selectedResults.size} product${selectedResults.size !== 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}
