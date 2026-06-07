export default function PriceSparkline({ data }) {
  if (!data || data.length < 2) return null;

  const prices = data.map((d) => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const W = 120;
  const H = 32;
  const PAD = 2;
  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2;

  const points = prices.map((p, i) => {
    const x = PAD + (i / (prices.length - 1)) * innerW;
    const y = PAD + ((max - p) / range) * innerH;
    return `${x},${y}`;
  });

  const latest = prices[prices.length - 1];
  const first = prices[0];
  const isDown = latest < first;

  return (
    <div className="flex items-center gap-2">
      <svg width={W} height={H} className="overflow-visible">
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke={isDown ? "#22c55e" : "#94a3b8"}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      <span className={`text-xs font-medium ${isDown ? "text-brand-600" : "text-gray-400"}`}>
        ${min.toFixed(2)}–${max.toFixed(2)}
      </span>
    </div>
  );
}
