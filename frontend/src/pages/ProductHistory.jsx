import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { api } from "../api";
import StorePill from "../components/StorePill";

function PriceChart({ history }) {
  const W = 600;
  const H = 220;
  const PAD = { top: 16, right: 16, bottom: 40, left: 52 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const prices = history.map((d) => d.price);
  const dates = history.map((d) => new Date(d.recorded_at + "Z"));
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const priceRange = maxP - minP || 1;
  const minT = dates[0].getTime();
  const maxT = dates[dates.length - 1].getTime();
  const timeRange = maxT - minT || 1;

  const toX = (d) => PAD.left + ((d.getTime() - minT) / timeRange) * innerW;
  const toY = (p) => PAD.top + ((maxP - p) / priceRange) * innerH;

  const points = history.map((d, i) => `${toX(dates[i])},${toY(d.price)}`).join(" ");

  // Y axis ticks
  const yTicks = 5;
  const yTickVals = Array.from({ length: yTicks }, (_, i) => minP + (priceRange / (yTicks - 1)) * i);

  // X axis ticks — up to 6 evenly spaced
  const xTickCount = Math.min(6, history.length);
  const xTickIndices = Array.from({ length: xTickCount }, (_, i) =>
    Math.round((i / (xTickCount - 1)) * (history.length - 1))
  );

  const latest = prices[prices.length - 1];
  const first = prices[0];
  const isDown = latest <= first;
  const lineColor = isDown ? "#22c55e" : "#f87171";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ fontFamily: "inherit" }}
    >
      {/* Gridlines */}
      {yTickVals.map((v, i) => (
        <line
          key={i}
          x1={PAD.left}
          x2={W - PAD.right}
          y1={toY(v)}
          y2={toY(v)}
          stroke="currentColor"
          className="text-gray-100 dark:text-gray-700"
          strokeWidth="1"
        />
      ))}

      {/* Y axis labels */}
      {yTickVals.map((v, i) => (
        <text
          key={i}
          x={PAD.left - 6}
          y={toY(v) + 4}
          textAnchor="end"
          fontSize="10"
          fill="currentColor"
          className="text-gray-400"
        >
          ${v.toFixed(2)}
        </text>
      ))}

      {/* X axis labels */}
      {xTickIndices.map((idx) => {
        const d = dates[idx];
        const label = d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
        return (
          <text
            key={idx}
            x={toX(d)}
            y={H - PAD.bottom + 14}
            textAnchor="middle"
            fontSize="10"
            fill="currentColor"
            className="text-gray-400"
          >
            {label}
          </text>
        );
      })}

      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={lineColor}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Dots */}
      {history.map((d, i) => (
        <circle
          key={i}
          cx={toX(dates[i])}
          cy={toY(d.price)}
          r="3"
          fill={lineColor}
        />
      ))}
    </svg>
  );
}

export default function ProductHistory() {
  const { itemId, productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [products, hist] = await Promise.all([
        api.getProducts(Number(itemId)),
        api.getProductHistory(Number(productId)),
      ]);
      setProduct(products.find((p) => p.id === Number(productId)) || null);
      setHistory(hist);
      setLoading(false);
    }
    load();
  }, [itemId, productId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader2 className="animate-spin text-brand-500" size={28} />
      </div>
    );
  }

  const prices = history.map((d) => d.price);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;
  const latest = prices[prices.length - 1];
  const first = prices[0];
  const delta = prices.length >= 2 ? latest - first : null;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/items/${itemId}`)}
          className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 mb-0.5">Price history</p>
          <h1 className="text-base font-bold truncate leading-tight">{product?.name ?? "Product"}</h1>
        </div>
        {product && <StorePill name={product.store_name} long />}
      </div>

      {/* Summary stats */}
      {prices.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-3 text-center shadow-sm">
            <p className="text-xs text-gray-400 mb-1">Current</p>
            <p className="font-bold text-lg">${latest.toFixed(2)}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-3 text-center shadow-sm">
            <p className="text-xs text-gray-400 mb-1">Low</p>
            <p className="font-bold text-lg text-green-500">${minPrice.toFixed(2)}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-3 text-center shadow-sm">
            <p className="text-xs text-gray-400 mb-1">High</p>
            <p className="font-bold text-lg text-red-500">${maxPrice.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
        {history.length < 2 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            Not enough history yet — check back after the next scrape.
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                {history.length} data points
              </p>
              {delta !== null && (
                <p className={`text-sm font-semibold ${delta < 0 ? "text-green-500" : delta > 0 ? "text-red-500" : "text-gray-400"}`}>
                  {delta < 0 ? "▼" : delta > 0 ? "▲" : "="} ${Math.abs(delta).toFixed(2)} overall
                </p>
              )}
            </div>
            <PriceChart history={history} />
          </>
        )}
      </div>

      {/* History table */}
      {history.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Date</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Price</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {[...history].reverse().map((row, i, arr) => {
                const prev = arr[i + 1];
                const change = prev ? row.price - prev.price : null;
                return (
                  <tr key={row.id ?? i}>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                      {new Date(row.recorded_at + "Z").toLocaleString("en-AU", {
                        day: "numeric", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-900 dark:text-white">
                      ${row.price.toFixed(2)}
                    </td>
                    <td className={`px-4 py-2.5 text-right text-xs font-medium ${change == null ? "text-gray-300" : change < 0 ? "text-green-500" : change > 0 ? "text-red-500" : "text-gray-400"}`}>
                      {change == null ? "—" : change === 0 ? "=" : `${change < 0 ? "▼" : "▲"} $${Math.abs(change).toFixed(2)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
