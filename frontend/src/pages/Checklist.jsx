import { useState, useEffect, useRef } from "react";
import { CheckSquare, Square, Trash2, ShoppingCart, ClipboardList } from "lucide-react";
import { api } from "../api";
import { useNavigate } from "react-router-dom";
import ConfirmModal from "../components/ConfirmModal";

export default function Checklist() {
  const [items, setItems] = useState([]);
  const [input, setInput] = useState("");
  const [tracking, setTracking] = useState(null);
  const [trackConfirm, setTrackConfirm] = useState(null); // item to confirm
  const [editing, setEditing] = useState(null); // { id, value }
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.getChecklist().then(setItems);
  }, []);

  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);

  async function addItem(e) {
    e.preventDefault();
    const name = input.trim();
    if (!name) return;
    setInput("");
    const item = await api.createChecklistItem(name);
    setItems((prev) => [item, ...prev]);
  }

  function toggleChecked(item) {
    const updated = { ...item, checked: !item.checked };
    setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
    api.updateChecklistItem(item.id, { checked: !item.checked });
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    api.deleteChecklistItem(id);
  }

  async function clearChecked() {
    setItems((prev) => prev.filter((i) => !i.checked));
    await api.clearCheckedItems();
  }

  function startEdit(item) {
    setEditing({ id: item.id, value: item.name });
  }

  function commitEdit() {
    if (!editing) return;
    const name = editing.value.trim();
    if (name && name !== items.find((i) => i.id === editing.id)?.name) {
      setItems((prev) => prev.map((i) => (i.id === editing.id ? { ...i, name } : i)));
      api.updateChecklistItem(editing.id, { name });
    }
    setEditing(null);
  }

  function cancelEdit() {
    setEditing(null);
  }

  async function trackItem(item) {
    setTracking(item.id);
    setTrackConfirm(null);
    try {
      const newItem = await api.createItem({ name: item.name });
      removeItem(item.id);
      navigate(`/items/${newItem.id}/add-product`);
    } finally {
      setTracking(null);
    }
  }

  return (
    <div className="p-4 space-y-4">
      {trackConfirm && (
        <ConfirmModal
          title="Add to Shopping List?"
          message={`This will create a new Shopping List item called "${trackConfirm.name}", remove it from your checklist, and take you to the product search page.`}
          confirmLabel="Add to List"
          onConfirm={() => trackItem(trackConfirm)}
          onCancel={() => setTrackConfirm(null)}
        />
      )}
      <h1 className="font-logo text-xl font-semibold">Checklist</h1>

      <form onSubmit={addItem} className="flex gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add an item..."
          className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium disabled:opacity-40 active:opacity-70"
        >
          Add
        </button>
      </form>

      {items.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <ClipboardList className="mx-auto mb-3 opacity-30" size={48} />
          <p className="text-sm">Your checklist is empty.</p>
          <p className="text-xs mt-1">Add items above for your next shop.</p>
        </div>
      )}

      {unchecked.length > 0 && (
        <ul className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl divide-y divide-gray-100 dark:divide-gray-700 shadow-sm">
          {unchecked.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3">
              <button
                onClick={() => toggleChecked(item)}
                className="shrink-0 text-gray-400 hover:text-brand-500 active:opacity-70 transition-colors"
              >
                <Square size={20} />
              </button>
              {editing?.id === item.id ? (
                <input
                  autoFocus
                  value={editing.value}
                  onChange={(e) => setEditing((prev) => ({ ...prev, value: e.target.value }))}
                  onBlur={commitEdit}
                  onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
                  className="flex-1 text-sm bg-transparent border-b border-brand-500 focus:outline-none text-gray-900 dark:text-white"
                />
              ) : (
                <span
                  className="flex-1 text-sm text-gray-900 dark:text-white cursor-text"
                  onClick={() => startEdit(item)}
                >
                  {item.name}
                </span>
              )}
              <button
                onClick={() => setTrackConfirm(item)}
                disabled={tracking === item.id}
                title="Track on Shopping List"
                className="shrink-0 text-gray-400 hover:text-brand-500 active:opacity-70 transition-colors disabled:opacity-40"
              >
                <ShoppingCart size={16} />
              </button>
              <button
                onClick={() => removeItem(item.id)}
                className="shrink-0 text-gray-400 hover:text-red-500 active:opacity-70 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {checked.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Checked ({checked.length})
            </span>
            <button
              onClick={clearChecked}
              className="text-xs text-red-500 font-medium active:opacity-70"
            >
              Clear
            </button>
          </div>
          <ul className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl divide-y divide-gray-100 dark:divide-gray-700 shadow-sm opacity-60">
            {checked.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => toggleChecked(item)}
                  className="shrink-0 text-brand-500 active:opacity-70 transition-colors"
                >
                  <CheckSquare size={20} />
                </button>
                <span className="flex-1 text-sm text-gray-500 dark:text-gray-400 line-through">
                  {item.name}
                </span>
                <button
                  onClick={() => removeItem(item.id)}
                  className="shrink-0 text-gray-400 hover:text-red-500 active:opacity-70 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
