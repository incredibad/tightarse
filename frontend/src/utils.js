export const STORE_COLORS = {
  Woolworths: { bg: "#007837", text: "#fff" },
  Coles:      { bg: "#CC0000", text: "#fff" },
  ALDI:       { bg: "#003087", text: "#fff" },
  Drakes:     { bg: "#E05C20", text: "#fff" },
};

// Normalize cup_price to a per-base-unit value so different units (per 100g vs per kg)
// can be compared. Returns price-per-gram for weight, price-per-ml for volume, or the
// raw cup_price when the unit can't be parsed (per ea, per unit, etc.).
export function normalizeCupPrice(price, label) {
  if (price == null || !label) return null;
  const l = label.toLowerCase().replace(/\s+/g, "");

  const wm = l.match(/per(\d*\.?\d*)(kg|g)\b/);
  if (wm) {
    const qty = parseFloat(wm[1]) || 1;
    return price / (wm[2] === "kg" ? qty * 1000 : qty);
  }

  const vm = l.match(/per(\d*\.?\d*)(litre|liter|l|ml)\b/);
  if (vm) {
    const qty = parseFloat(vm[1]) || 1;
    return price / (/^l/.test(vm[2]) && vm[2] !== "ml" ? qty * 1000 : qty);
  }

  // Count-based units: sheets, tabs, capsules, etc. — exclude ea/each/unit which
  // are just "it costs $X each" and add no comparison value for fresh produce.
  const cm = l.match(/per(\d+\.?\d*)(sheets?|tabs?|capsules?|wipes?|serves?|servings?)/);
  if (cm) {
    const qty = parseFloat(cm[1]) || 1;
    return price / qty;
  }

  return null;
}

// Format cup price for display, normalised to per 100g or per 100ml so all
// products within an item are directly comparable in the UI. Returns null for
// non-weight/volume units so callers can fall back gracefully.
export function formatCupPrice(price, label) {
  if (price == null || !label) return null;
  const l = label.toLowerCase().replace(/\s+/g, "");

  const wm = l.match(/per(\d*\.?\d*)(kg|g)\b/);
  if (wm) {
    const qty = parseFloat(wm[1]) || 1;
    const perG = price / (wm[2] === "kg" ? qty * 1000 : qty);
    return `$${(perG * 100).toFixed(2)}/100g`;
  }

  const vm = l.match(/per(\d*\.?\d*)(litre|liter|l|ml)\b/);
  if (vm) {
    const qty = parseFloat(vm[1]) || 1;
    const perMl = price / (/^l/.test(vm[2]) && vm[2] !== "ml" ? qty * 1000 : qty);
    return `$${(perMl * 100).toFixed(2)}/100ml`;
  }

  // Count-based units — normalise display to per 100 units
  const cm = l.match(/per(\d+\.?\d*)(sheets?|tabs?|capsules?|wipes?|serves?|servings?)/);
  if (cm) {
    const qty = parseFloat(cm[1]) || 1;
    const unitWord = cm[2].replace(/s$/, ""); // singular
    return `$${(price / qty * 100).toFixed(2)}/100 ${unitWord}s`;
  }

  return null;
}

export function normalizePackageSize(size) {
  if (!size) return null;
  const m = size.match(/^([\d.]+)\s*kg$/i);
  if (m) {
    const kg = parseFloat(m[1]);
    if (kg < 1) return `${Math.round(kg * 1000)}g`;
  }
  return size;
}

function fuzzyScore(name, words) {
  const n = name.toLowerCase();
  let score = 0;
  for (const w of words) {
    if (n.includes(w)) score += w.length;
  }
  return score;
}

export function mergeSearchResults(perStoreResults, query) {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const all = perStoreResults.flatMap((results, si) =>
    results.map((r, ri) => ({ ...r, _score: fuzzyScore(r.name, words), _si: si, _ri: ri }))
  );
  all.sort((a, b) => b._score - a._score || a._si - b._si || a._ri - b._ri);
  return all.map(({ _score, _si, _ri, ...r }) => r);
}
