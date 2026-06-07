import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Link, Search, Check, X, Loader2 } from "lucide-react";
import { api } from "../api";

const STEPS = { METHOD: "method", URL_INPUT: "url_input", SEARCH: "search", CONFIRM: "confirm" };

export default function AddProduct() {
  const { itemId } = useParams();
  const navigate = useNavigate();

  const [step, setStep] = useState(STEPS.METHOD);
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [urlInput, setUrlInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Editable confirm fields
  const [confirmName, setConfirmName] = useState("");

  useEffect(() => {
    api.getStores().then(setStores);
  }, []);

  async function handleUrlPreview(e) {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.previewUrl(urlInput.trim());
      setPreview(result);
      setConfirmName(result.name);
      setStep(STEPS.CONFIRM);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!selectedStore || !searchQuery.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const results = await api.searchStore(selectedStore.id, searchQuery.trim());
      setSearchResults(results);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePickSearchResult(result) {
    setLoading(true);
    setError(null);
    try {
      const p = await api.previewUrl(result.url);
      setPreview(p);
      setConfirmName(p.name);
      setStep(STEPS.CONFIRM);
    } catch {
      // Fallback: use search result data directly if scrape fails
      setPreview({ ...result, store_id: selectedStore.id, in_stock: true });
      setConfirmName(result.name);
      setStep(STEPS.CONFIRM);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!preview) return;
    setLoading(true);
    setError(null);
    try {
      await api.createProduct({
        item_id: Number(itemId),
        store_id: preview.store_id,
        name: confirmName,
        url: preview.url,
        current_price: preview.price,
      });
      navigate(`/items/${itemId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => (step === STEPS.METHOD ? navigate(`/items/${itemId}`) : setStep(STEPS.METHOD))} className="text-gray-400 hover:text-gray-700 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">Add product</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
      )}

      {step === STEPS.METHOD && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">How do you want to find this product?</p>
          <button
            onClick={() => setStep(STEPS.URL_INPUT)}
            className="w-full flex items-center gap-4 bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:bg-gray-50 transition-colors text-left"
          >
            <div className="bg-brand-100 text-brand-600 p-2 rounded-lg">
              <Link size={20} />
            </div>
            <div>
              <p className="font-medium">Paste a URL</p>
              <p className="text-xs text-gray-400">Copy the product URL from the store's website</p>
            </div>
          </button>
          <button
            onClick={() => setStep(STEPS.SEARCH)}
            className="w-full flex items-center gap-4 bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:bg-gray-50 transition-colors text-left"
          >
            <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
              <Search size={20} />
            </div>
            <div>
              <p className="font-medium">Search a store</p>
              <p className="text-xs text-gray-400">Search directly on the store's website</p>
            </div>
          </button>
        </div>
      )}

      {step === STEPS.URL_INPUT && (
        <form onSubmit={handleUrlPreview} className="space-y-3">
          <p className="text-sm text-gray-500">Paste the full product URL from Woolworths, Coles, ALDI, or IGA.</p>
          <input
            autoFocus
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://www.woolworths.com.au/shop/productdetails/..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={loading || !urlInput.trim()}
            className="w-full flex justify-center items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {loading ? "Fetching…" : "Look up price"}
          </button>
        </form>
      )}

      {step === STEPS.SEARCH && (
        <div className="space-y-3">
          <div className="space-y-2">
            <p className="text-sm text-gray-500">Pick a store, then search.</p>
            <div className="flex flex-wrap gap-2">
              {stores.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStore(s)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    selectedStore?.id === s.id
                      ? "bg-brand-600 border-brand-600 text-white"
                      : "border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products…"
              disabled={!selectedStore}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !selectedStore || !searchQuery.trim()}
              className="flex items-center gap-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium px-3 py-2 rounded-lg text-sm transition-colors"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            </button>
          </form>

          {searchResults.length > 0 && (
            <ul className="space-y-2">
              {searchResults.map((r, i) => (
                <li key={i}>
                  <button
                    onClick={() => handlePickSearchResult(r)}
                    className="w-full text-left bg-white border border-gray-200 rounded-xl px-4 py-3 hover:bg-gray-50 transition-colors flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{r.name}</p>
                    </div>
                    {r.price != null && (
                      <span className="text-sm font-bold text-gray-900 shrink-0">${r.price.toFixed(2)}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {searchResults.length === 0 && searchQuery && !loading && (
            <p className="text-sm text-gray-400 text-center py-4">No results found.</p>
          )}
        </div>
      )}

      {step === STEPS.CONFIRM && preview && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Review the details before saving.</p>
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Product name</label>
              <input
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500">Price</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">
                  {preview.price != null ? `$${preview.price.toFixed(2)}` : "Unknown"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Store</p>
                <p className="text-sm font-medium text-gray-800 mt-0.5">{preview.store_name}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">In stock</p>
                <p className="text-sm font-medium mt-0.5">{preview.in_stock ? "Yes" : "No"}</p>
              </div>
            </div>
            <a href={preview.url} target="_blank" rel="noopener noreferrer" className="block text-xs text-blue-500 hover:underline truncate">
              {preview.url}
            </a>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              disabled={loading || !confirmName.trim()}
              className="flex-1 flex justify-center items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {loading ? "Saving…" : "Save product"}
            </button>
            <button
              onClick={() => setStep(STEPS.METHOD)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors flex items-center gap-1"
            >
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
