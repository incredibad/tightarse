import { STORE_COLORS } from "../utils";

export default function StorePill({ name, short = false, long = false }) {
  const color = STORE_COLORS[name] || { bg: "#6B7280", text: "#fff" };
  if (short) {
    return (
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold leading-none shrink-0"
        style={{ backgroundColor: color.bg, color: color.text }}
      >
        {name[0]}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded text-xs font-bold leading-none shrink-0"
      style={{ backgroundColor: color.bg, color: color.text }}
    >
      {!long && <span className="md:hidden w-5 h-5 flex items-center justify-center">{name[0]}</span>}
      <span className={`${long ? "" : "hidden md:inline "}px-1.5 py-0.5`}>{name}</span>
    </span>
  );
}
