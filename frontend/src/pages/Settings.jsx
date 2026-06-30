import { useState, useEffect, useRef } from "react";
import {
  Sun, Moon, LogOut, Save, RefreshCw, Loader2,
  UserPlus, Trash2, KeyRound, ShieldCheck, ShieldOff, User, Send, X,
  ChevronUp, ChevronDown, ToggleLeft, ToggleRight, Trash, Info,
} from "lucide-react";
import { api } from "../api";

const DRAKES_STORES = [
  { id: "015", name: "Aldinga" },
  { id: "018", name: "Woodcroft" },
  { id: "020", name: "Chinchilla" },
  { id: "022", name: "Wayville" },
  { id: "023", name: "Port Lincoln" },
  { id: "033", name: "Winston Glades" },
  { id: "049", name: "Eyre (Penfield)" },
  { id: "055", name: "North Haven" },
  { id: "058", name: "Newton" },
  { id: "062", name: "Golden Grove" },
  { id: "065", name: "Wallaroo" },
  { id: "079", name: "Findon" },
  { id: "087", name: "McDowall" },
  { id: "089", name: "Rochedale" },
  { id: "098", name: "Murray Bridge" },
  { id: "117", name: "Mt Gambier" },
  { id: "142", name: "Aston Hills" },
  { id: "143", name: "Gawler East" },
];

export default function Settings({ onLogout, user }) {
  const isAdmin = user?.role === "admin";
  const [tab, setTab] = useState("Stores");
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    api.getSettings().then((rows) => {
      const map = {};
      rows.forEach((r) => { map[r.key] = r.value ?? ""; });
      setSettings(map);
      setLoading(false);
    });
  }, []);

  function set(key, val) {
    setSettings((s) => ({ ...s, [key]: val }));
  }

  async function save(keys) {
    setSaving(true);
    setSaveMsg("");
    try {
      const patch = {};
      keys.forEach((k) => { if (k in settings) patch[k] = settings[k]; });
      await api.updateSettings(patch);
      setSaveMsg("Saved");
      setTimeout(() => setSaveMsg(""), 2000);
    } catch (e) {
      setSaveMsg(e.message);
    } finally {
      setSaving(false);
    }
  }

  const tabs = isAdmin ? ["Stores", "Notifications", "Account", "Admin"] : ["Stores", "Notifications", "Account"];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader2 className="animate-spin text-brand-500" size={28} />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Settings</h1>
        <a
          href="https://github.com/incredibad/tightarse"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-400 hover:text-brand-500 transition-colors font-mono"
        >
          v0.5.22
        </a>
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === t
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Notifications" && (
        <NotificationsTab settings={settings} set={set} save={save} saving={saving} saveMsg={saveMsg} />
      )}
      {tab === "Stores" && (
        <StoresTab />
      )}
      {tab === "Account" && (
        <AccountTab onLogout={onLogout} user={user} />
      )}
      {tab === "Admin" && isAdmin && (
        <AdminTab settings={settings} set={set} save={save} saving={saving} saveMsg={saveMsg} />
      )}
    </div>
  );
}

// ── Notifications tab ─────────────────────────────────────────────────────────

function NotificationsTab({ settings, set, save, saving, saveMsg }) {
  const notifKeys = [
    "notify_price_drop_threshold_pct",
    "email_enabled", "email_to",
    "discord_enabled", "discord_webhook_url",
    "gotify_enabled", "gotify_server_url", "gotify_app_token",
  ];

  return (
    <div className="space-y-4">
      <Section title="Price Alerts">
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
          You'll be notified when a tracked product's price drops by at least the threshold below, compared to the last recorded price. Alerts fire during scheduled scrapes — enable at least one channel below to receive them.
        </p>
        <Field label="Alert threshold (% drop)">
          <input
            type="number" min="1" max="100"
            value={settings.notify_price_drop_threshold_pct ?? "5"}
            onChange={(e) => set("notify_price_drop_threshold_pct", e.target.value)}
            className={inputCls}
          />
        </Field>
      </Section>

      <Section title="Email">
        <Toggle label="Enable email notifications" value={settings.email_enabled === "true"} onChange={(v) => set("email_enabled", v ? "true" : "false")} />
        <Field label="Send to (email address)">
          <input type="email" value={settings.email_to ?? ""} onChange={(e) => set("email_to", e.target.value)} className={inputCls} />
        </Field>
      </Section>

      <Section title="Discord">
        <Toggle label="Enable Discord notifications" value={settings.discord_enabled === "true"} onChange={(v) => set("discord_enabled", v ? "true" : "false")} />
        <Field label="Webhook URL">
          <input type="url" value={settings.discord_webhook_url ?? ""} onChange={(e) => set("discord_webhook_url", e.target.value)} className={inputCls} placeholder="https://discord.com/api/webhooks/…" />
        </Field>
      </Section>

      <Section title="Gotify">
        <Toggle label="Enable Gotify notifications" value={settings.gotify_enabled === "true"} onChange={(v) => set("gotify_enabled", v ? "true" : "false")} />
        <Field label="Server URL">
          <input type="url" value={settings.gotify_server_url ?? ""} onChange={(e) => set("gotify_server_url", e.target.value)} className={inputCls} />
        </Field>
        <Field label="App token">
          <input type="text" value={settings.gotify_app_token ?? ""} onChange={(e) => set("gotify_app_token", e.target.value)} className={inputCls} />
        </Field>
      </Section>

      <SaveBar keys={notifKeys} save={save} saving={saving} msg={saveMsg} />
    </div>
  );
}

// ── Account tab ───────────────────────────────────────────────────────────────

function AccountTab({ onLogout, user }) {
  const [dark, setDark] = useState(localStorage.getItem("ta_dark") !== "false");
  const [curr, setCurr] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  function toggleDark(val) {
    setDark(val);
    document.documentElement.classList.toggle("dark", val);
    localStorage.setItem("ta_dark", val ? "true" : "false");
  }

  async function changePassword(e) {
    e.preventDefault();
    if (next !== confirm) { setPwMsg("Passwords don't match"); return; }
    if (next.length < 8) { setPwMsg("Password must be at least 8 characters"); return; }
    setPwSaving(true);
    setPwMsg("");
    try {
      await api.changePassword(curr, next);
      setPwMsg("Password changed");
      setCurr(""); setNext(""); setConfirm("");
      setTimeout(() => setPwMsg(""), 2000);
    } catch (e) {
      setPwMsg(e.message);
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Section title="Appearance">
        <div className="flex items-center justify-between py-1">
          <span className="text-sm text-gray-700 dark:text-gray-300">Dark mode</span>
          <button
            onClick={() => toggleDark(!dark)}
            className="flex items-center gap-2 text-sm bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-lg"
          >
            {dark ? <Moon size={14} /> : <Sun size={14} />}
            {dark ? "Dark" : "Light"}
          </button>
        </div>
      </Section>

      <Section title="Change Password">
        {user && (
          <p className="text-xs text-gray-400">Logged in as <strong>{user.username}</strong> ({user.role})</p>
        )}
        <form onSubmit={changePassword} className="space-y-2">
          <input type="password" placeholder="Current password" value={curr} onChange={(e) => setCurr(e.target.value)} className={inputCls} required />
          <input type="password" placeholder="New password (8+ chars)" value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} required />
          <input type="password" placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} required />
          {pwMsg && <p className={`text-xs ${pwMsg === "Password changed" ? "text-brand-600" : "text-red-500"}`}>{pwMsg}</p>}
          <button type="submit" disabled={pwSaving} className={btnCls}>
            {pwSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Change Password
          </button>
        </form>
      </Section>

      <Section title="Session">
        <button onClick={onLogout} className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600 py-1">
          <LogOut size={16} /> Log out
        </button>
      </Section>
    </div>
  );
}

// ── Stores tab ────────────────────────────────────────────────────────────────

function StoresTab() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [drakesStoreId, setDrakesStoreId] = useState("087");
  const [drakesStoreName, setDrakesStoreName] = useState("");
  const [drakesPickerOpen, setDrakesPickerOpen] = useState(false);
  const [drakesStoreList, setDrakesStoreList] = useState(DRAKES_STORES);
  const [colesStoreId, setColesStoreId] = useState("4670");
  const [colesStoreName, setColesStoreName] = useState("");
  const [colesMsg, setColesMsg] = useState("");
  const [colesPickerOpen, setColesPickerOpen] = useState(false);
  const [colesPostcode, setColesPostcode] = useState("");
  const [colesSearchResults, setColesSearchResults] = useState(null);
  const [colesSearching, setColesSearching] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [allStores, settings] = await Promise.all([api.getStores(), api.getSettings()]);
      const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));
      setDrakesStoreId(settingsMap.drakes_store_id || "087");
      setDrakesStoreName(settingsMap.drakes_store_name || "");
      setColesStoreId(settingsMap.coles_store_id || "");
      setColesStoreName(settingsMap.coles_store_name || "");
      if (settingsMap.drakes_store_map) {
        try {
          const mapped = JSON.parse(settingsMap.drakes_store_map);
          if (Array.isArray(mapped) && mapped.length) setDrakesStoreList(mapped);
        } catch {}
      }
      const orderJson = settingsMap.store_order;
      let ordered = allStores;
      if (orderJson) {
        try {
          const order = JSON.parse(orderJson);
          if (order.length) {
            const byId = Object.fromEntries(allStores.map((s) => [s.id, s]));
            const sorted = order.map((id) => byId[id]).filter(Boolean);
            const rest = allStores.filter((s) => !order.includes(s.id));
            ordered = [...sorted, ...rest];
          }
        } catch {}
      }
      ordered = ordered.map((s) => {
        const val = settingsMap[`store_${s.id}_enabled`];
        return val !== undefined ? { ...s, enabled: val !== "false" } : s;
      });
      setStores(ordered);
    } finally {
      setLoading(false);
    }
  }

  async function persist(nextStores) {
    setSaving(true);
    const patch = { store_order: JSON.stringify(nextStores.map((s) => s.id)) };
    nextStores.forEach((s) => { patch[`store_${s.id}_enabled`] = s.enabled ? "true" : "false"; });
    try { await api.updateSettings(patch); } finally { setSaving(false); }
  }

  function toggle(id) {
    const next = stores.map((s) => s.id === id ? { ...s, enabled: !s.enabled } : s);
    setStores(next);
    persist(next);
  }

  function move(index, dir) {
    const next = [...stores];
    const swap = index + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    setStores(next);
    persist(next);
  }

  async function selectDrakesStore(store) {
    setDrakesStoreId(store.id);
    setDrakesStoreName(store.name);
    setDrakesPickerOpen(false);
    await api.updateSettings({ drakes_store_id: store.id, drakes_store_name: store.name });
  }

  async function searchColesStores(e) {
    e?.preventDefault();
    setColesSearching(true); setColesSearchResults(null); setColesMsg("");
    try {
      const results = await api.searchColesStores(colesPostcode);
      setColesSearchResults(results);
      if (!results.length) setColesMsg("No Coles stores found near that postcode");
    } catch (err) {
      setColesMsg(err.message);
    } finally {
      setColesSearching(false);
    }
  }

  async function selectColesStore(store) {
    setColesStoreId(store.id);
    setColesStoreName(store.name);
    setColesSearchResults(null);
    setColesPostcode("");
    setColesPickerOpen(false);
    setColesMsg("");
    try {
      await api.updateSettings({ coles_store_id: store.id, coles_store_name: store.name });
    } catch (e) {
      setColesMsg(e.message);
    }
  }

  if (loading) return <div className="flex justify-center items-center h-32"><Loader2 className="animate-spin text-brand-500" size={24} /></div>;

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Store Preferences</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
          Enable or disable stores for your shopping list and journey.
          Use the arrows to set priority order — when two products cost the same,
          the store higher on this list will be chosen in the Journey.
        </p>
        {saving && <p className="text-xs text-brand-500">Saving…</p>}
        <div className="space-y-0 pt-1">
          {stores.filter((s) => s.available !== false).map((store, i) => (
            <div key={store.id} className="border-b border-gray-100 dark:border-gray-700 last:border-0 relative">
              <div className="flex items-center gap-2 py-1.5">
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-20"><ChevronUp size={14} /></button>
                  <button onClick={() => move(i, 1)} disabled={i === stores.length - 1} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-20"><ChevronDown size={14} /></button>
                </div>
                <span className="text-xs font-bold text-gray-400 w-4 text-center shrink-0">{i + 1}</span>
                <span className={`text-sm font-medium flex-1 ${store.enabled ? "text-gray-800 dark:text-gray-100" : "text-gray-400 dark:text-gray-500 line-through"}`}>{store.name}</span>
                {store.scraper_module === "drakes" && store.enabled && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <InfoTooltip text="Only Drakes stores with online ordering are listed here — not all Drakes locations support online shopping." />
                    <button
                      onClick={() => setDrakesPickerOpen((o) => !o)}
                      className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium max-w-[7rem] truncate"
                    >
                      {drakesStoreName || (drakesStoreId ? drakesStoreList.find(s => s.id === drakesStoreId)?.name || `#${drakesStoreId}` : "Set store")}
                    </button>
                  </div>
                )}
                {store.scraper_module === "coles" && store.enabled && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <InfoTooltip text="Pricing may vary by store. Some Coles products aren't priced online — we fall back to in-store pricing for these. Set your nearest store so prices are accurate." />
                    {colesPickerOpen ? (
                      <>
                        <input
                          autoFocus
                          type="text"
                          value={colesPostcode}
                          onChange={(e) => setColesPostcode(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Escape") { setColesPickerOpen(false); setColesSearchResults(null); } }}
                          placeholder="Postcode"
                          maxLength={4}
                          className="w-16 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-0.5 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
                        />
                        <button
                          onClick={searchColesStores}
                          disabled={colesSearching || colesPostcode.length !== 4}
                          className="flex items-center gap-1 text-xs font-medium bg-brand-700 hover:bg-brand-900 text-white px-2.5 py-1 rounded-md transition-colors disabled:opacity-50 shrink-0"
                        >
                          {colesSearching ? <Loader2 size={11} className="animate-spin" /> : "Find"}
                        </button>
                        <button onClick={() => { setColesPickerOpen(false); setColesSearchResults(null); }} className="text-gray-400 hover:text-gray-600 shrink-0"><X size={12} /></button>
                      </>
                    ) : (
                      <button
                        onClick={() => { setColesPickerOpen(true); setColesSearchResults(null); setColesMsg(""); }}
                        className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium max-w-[7rem] truncate"
                      >
                        {colesStoreName || (colesStoreId ? `#${colesStoreId}` : "Set store")}
                      </button>
                    )}
                    {colesMsg && !colesPickerOpen && <span className="text-xs text-red-500 shrink-0">{colesMsg}</span>}
                  </div>
                )}
                <button
                  onClick={() => toggle(store.id)}
                  className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors shrink-0 ${store.enabled ? "bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300" : "bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500"}`}
                >
                  {store.enabled ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                  {store.enabled ? "On" : "Off"}
                </button>
              </div>
              {store.scraper_module === "drakes" && store.enabled && drakesPickerOpen && (
                <div className="absolute left-0 right-0 top-full z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-40 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                  {drakesStoreList.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => selectDrakesStore(s)}
                      className={`w-full text-left flex items-center gap-2 px-3 py-2 text-xs transition-colors ${drakesStoreId === s.id ? "font-semibold text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                    >
                      <span className="w-3 shrink-0 text-brand-500">{drakesStoreId === s.id ? "✓" : ""}</span>
                      <span className="flex-1">{s.name}</span>
                      <span className="text-gray-400 font-mono shrink-0">{s.id}</span>
                    </button>
                  ))}
                </div>
              )}
              {store.scraper_module === "coles" && store.enabled && colesPickerOpen && colesSearchResults && colesSearchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-40 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                  {colesSearchResults.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => selectColesStore(s)}
                      className={`w-full text-left flex items-center gap-2 px-3 py-2 text-xs transition-colors ${colesStoreId === s.id ? "font-semibold text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                    >
                      <span className="w-3 shrink-0 text-brand-500">{colesStoreId === s.id ? "✓" : ""}</span>
                      <span className="flex-1">{s.name}</span>
                      <span className="text-gray-400 shrink-0 truncate max-w-[10rem]">{s.address}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

// ── Admin tab ─────────────────────────────────────────────────────────────────

const ADMIN_TABS = ["General", "Network", "Email", "Users", "Logs"];

function AdminTab({ settings, set, save, saving, saveMsg }) {
  const [adminTab, setAdminTab] = useState("General");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {ADMIN_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setAdminTab(t)}
            className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors ${
              adminTab === t
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {adminTab === "General"  && <AdminGeneralTab settings={settings} set={set} save={save} saving={saving} saveMsg={saveMsg} />}
      {adminTab === "Network"  && <AdminNetworkTab settings={settings} set={set} save={save} saving={saving} saveMsg={saveMsg} />}
      {adminTab === "Email"    && <AdminEmailTab   settings={settings} set={set} save={save} saving={saving} saveMsg={saveMsg} />}
      {adminTab === "Users"    && <AdminUsersTab />}
      {adminTab === "Logs"     && <AdminLogsTab />}
    </div>
  );
}

function timeAgo(isoStr) {
  if (!isoStr) return null;
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function ScrapeHistoryModal({ onClose }) {
  const [history, setHistory] = useState(null);
  useEffect(() => { api.getScrapeHistory().then(setHistory).catch(() => setHistory([])); }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg p-5 space-y-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white">Scrape history</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={18} /></button>
        </div>
        {history === null ? (
          <Loader2 className="animate-spin text-brand-500 mx-auto" size={20} />
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No scrape runs recorded yet.</p>
        ) : (
          <div className="overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white dark:bg-gray-800">
                <tr className="text-gray-500 dark:text-gray-400 text-left border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 font-medium">Time</th>
                  <th className="pb-2 font-medium text-green-600 dark:text-green-400">OK</th>
                  <th className="pb-2 font-medium text-red-500">Failed</th>
                  <th className="pb-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {history.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-1.5 pr-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">{new Date(r.started_at).toLocaleString()}</td>
                    <td className="py-1.5 pr-4 text-green-600 dark:text-green-400 font-medium">{r.success}</td>
                    <td className="py-1.5 pr-4 font-medium">{r.failed > 0 ? <span className="text-red-500">{r.failed}</span> : <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                    <td className="py-1.5 text-gray-600 dark:text-gray-300">{r.success + r.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminGeneralTab({ settings, set, save, saving, saveMsg }) {
  const [scraping, setScraping] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState("");
  const [scrapeStats, setScrapeStats] = useState(null);
  const [scrapeHistoryOpen, setScrapeHistoryOpen] = useState(false);
  const [drakesScanResults, setDrakesScanResults] = useState(null);
  const [drakesScanLoading, setDrakesScanLoading] = useState(false);
  const [drakesScanMsg, setDrakesScanMsg] = useState("");
  const [drakesSaveMsg, setDrakesSaveMsg] = useState("");

  useEffect(() => {
    api.getScrapeStats().then(setScrapeStats).catch(() => {});
  }, []);

  async function triggerScrape() {
    setScraping(true); setScrapeMsg("");
    try {
      const r = await api.rescrapeAll();
      setScrapeMsg(r.failed > 0 ? `${r.scraped} ok, ${r.failed} failed` : `All ${r.scraped} products scraped`);
      setTimeout(() => setScrapeMsg(""), 3000);
    } catch (e) {
      setScrapeMsg(e.message);
    } finally {
      setScraping(false);
      api.getScrapeStats().then(setScrapeStats).catch(() => {});
    }
  }

  async function runDrakesScan() {
    setDrakesScanLoading(true); setDrakesScanMsg(""); setDrakesScanResults(null); setDrakesSaveMsg("");
    try {
      const results = await api.scanDrakesStores();
      setDrakesScanResults(results);
      if (!results.length) setDrakesScanMsg("No stores found — page structure may have changed.");
    } catch (e) { setDrakesScanMsg(e.message); } finally { setDrakesScanLoading(false); }
  }

  async function saveDrakesMap() {
    setDrakesSaveMsg("");
    try {
      const toSave = (drakesScanResults || []).filter((s) => s.working);
      await api.saveDrakesStores(toSave);
      setDrakesSaveMsg(`Saved ${toSave.length} stores`);
      setTimeout(() => setDrakesSaveMsg(""), 3000);
    } catch (e) { setDrakesSaveMsg(e.message); }
  }

  return (
    <div className="space-y-4">
      <Section title="Scraping" description="Automatically checks prices for all tracked products across all users on the schedule below. Regular users cannot trigger scraping themselves — only admins can run it manually or change the schedule.">
        {(() => {
          const scheduleKeys = ["scrape_schedule_type", "scrape_schedule_time", "scrape_schedule_day"];
          const type = settings.scrape_schedule_type ?? "6h";
          const needsTime = ["daily", "2d", "weekly"].includes(type);
          const needsDay = type === "weekly";
          const days = ["mon","tue","wed","thu","fri","sat","sun"];
          const dayLabels = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
          const selectCls = "text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500";
          return (
            <div className="flex items-center gap-2 flex-wrap">
              <select value={type} onChange={(e) => set("scrape_schedule_type", e.target.value)} className={selectCls}>
                <option value="6h">Every 6 hours</option>
                <option value="12h">Every 12 hours</option>
                <option value="daily">Daily</option>
                <option value="2d">Every 2 days</option>
                <option value="weekly">Weekly</option>
              </select>
              {needsDay && (
                <select value={settings.scrape_schedule_day ?? "mon"} onChange={(e) => set("scrape_schedule_day", e.target.value)} className={selectCls}>
                  {days.map((d, i) => <option key={d} value={d}>{dayLabels[i]}</option>)}
                </select>
              )}
              {needsTime && (
                <input
                  type="time"
                  value={settings.scrape_schedule_time ?? "06:00"}
                  onChange={(e) => set("scrape_schedule_time", e.target.value)}
                  className={selectCls}
                />
              )}
              <button onClick={() => save(scheduleKeys)} disabled={saving} className={btnCls}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save
              </button>
              {saveMsg && <span className={`text-xs ${saveMsg === "Saved" ? "text-brand-600" : "text-red-500"}`}>{saveMsg}</span>}
              <button onClick={triggerScrape} disabled={scraping} className={btnCls}>
                {scraping ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Run now
              </button>
              {scrapeMsg && <span className="text-xs text-brand-600">{scrapeMsg}</span>}
            </div>
          );
        })()}
        {scrapeStats && (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {scrapeStats.last_run_at ? (
              <>
                Last scraped {timeAgo(scrapeStats.last_run_at)}
                {" · "}
                <span className="text-green-600 dark:text-green-400">{scrapeStats.last_run_success} ok</span>
                {scrapeStats.last_run_failed > 0 && (
                  <>, <span className="text-red-500">{scrapeStats.last_run_failed} failed</span></>
                )}
                {" · "}{scrapeStats.total_active} products
              </>
            ) : (
              <>No scrape run yet · {scrapeStats.total_active} products</>
            )}
            {" · "}
            <button onClick={() => setScrapeHistoryOpen(true)} className="underline hover:text-gray-600 dark:hover:text-gray-300">Show all</button>
          </p>
        )}
        {scrapeHistoryOpen && <ScrapeHistoryModal onClose={() => setScrapeHistoryOpen(false)} />}
      </Section>

      <Section title="Drakes Store Map" description="Scan the Drakes website to discover online stores and update the store dropdown. Only stores that respond successfully will be saved.">
        <button onClick={runDrakesScan} disabled={drakesScanLoading} className={btnCls}>
          {drakesScanLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {drakesScanLoading ? "Scanning…" : "Scan Drakes stores"}
        </button>
        {drakesScanMsg && <p className="text-xs text-red-500 mt-2">{drakesScanMsg}</p>}
        {drakesScanResults && drakesScanResults.length > 0 && (
          <div className="mt-3 space-y-1">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Found {drakesScanResults.length} stores — {drakesScanResults.filter(s => s.working).length} responding
            </p>
            {drakesScanResults.map((s) => (
              <div key={s.id} className="flex items-center gap-2 py-1 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.working ? "bg-green-500" : "bg-red-400"}`} />
                <span className="text-sm text-gray-800 dark:text-gray-200 flex-1">{s.name}</span>
                <span className="text-xs font-mono text-gray-400">{s.id}</span>
                <a href={s.url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline shrink-0">{s.url}</a>
              </div>
            ))}
            <div className="flex items-center gap-3 pt-2">
              <button onClick={saveDrakesMap} className={btnCls}><Save size={14} /> Save working stores</button>
              {drakesSaveMsg && <span className="text-xs text-brand-600">{drakesSaveMsg}</span>}
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

function AdminNetworkTab({ settings, set, save, saving, saveMsg }) {
  const [proxyTesting, setProxyTesting] = useState(false);
  const [proxyError, setProxyError] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    api.getProxyHistory().then(setHistory).catch(() => {});
  }, []);

  async function testProxy() {
    setProxyTesting(true); setProxyError(null);
    try {
      await api.testProxy();
      const h = await api.getProxyHistory();
      setHistory(h);
    } catch (e) {
      setProxyError(e.message);
    } finally { setProxyTesting(false); }
  }

  const latest = history[0] ?? null;

  return (
    <>
      <Section title="VPN / Proxy" description='Route scraping through an HTTP proxy (e.g. gluetun on your Docker network). Amazon Australia always requires a proxy to protect your home IP. Other stores use the proxy only when "Route all through VPN" is on.'>
        <Field label="Proxy URL">
          <input
            type="url"
            value={settings.vpn_proxy_url ?? ""}
            onChange={(e) => set("vpn_proxy_url", e.target.value)}
            placeholder="http://gluetun:8888"
            className={inputCls}
          />
        </Field>
        <Toggle
          label="Route all scraping through VPN"
          value={settings.scrape_via_vpn === "true"}
          onChange={(v) => set("scrape_via_vpn", v ? "true" : "false")}
        />
        <div className="flex items-center gap-3 flex-wrap">
          <SaveBar keys={["vpn_proxy_url", "scrape_via_vpn"]} save={save} saving={saving} msg={saveMsg} />
          <button onClick={testProxy} disabled={proxyTesting || !settings.vpn_proxy_url} className={btnCls}>
            {proxyTesting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Check now
          </button>
          {proxyError && <span className="text-xs text-red-500">{proxyError}</span>}
        </div>
      </Section>

      <Section title="VPN Status">
        {latest ? (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-sm">
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-gray-200 dark:divide-gray-700">
              {[
                ["Exit IP", latest.ip],
                ["ISP / Org", latest.org ?? "—"],
                ["Location", [latest.city, latest.country].filter(Boolean).join(", ") || "—"],
                ["Last checked", new Date(latest.checked_at).toLocaleString()],
              ].map(([label, value]) => (
                <div key={label} className="px-3 py-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{label}</div>
                  <div className="font-mono text-xs text-gray-900 dark:text-gray-100 break-all">{value}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400">No check recorded yet — click "Check now" above.</p>
        )}
      </Section>

      {history.length > 0 && (
        <Section title="Check History">
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-left">
                  <th className="px-3 py-2 font-medium">Time</th>
                  <th className="px-3 py-2 font-medium">Exit IP</th>
                  <th className="px-3 py-2 font-medium">ISP / Org</th>
                  <th className="px-3 py-2 font-medium">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {history.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-500 dark:text-gray-400">
                      {new Date(row.checked_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-900 dark:text-gray-100">{row.ip}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{row.org ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                      {[row.city, row.country].filter(Boolean).join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </>
  );
}

function AdminEmailTab({ settings, set, save, saving, saveMsg }) {
  const [testEmailOpen, setTestEmailOpen] = useState(false);
  return (
    <>
      <Section title="Email (SMTP)">
        <Field label="Host"><input type="text" value={settings.email_smtp_host ?? ""} onChange={(e) => set("email_smtp_host", e.target.value)} className={inputCls} /></Field>
        <Field label="Port"><input type="number" value={settings.email_smtp_port ?? "587"} onChange={(e) => set("email_smtp_port", e.target.value)} className={inputCls} /></Field>
        <Field label="Username"><input type="text" value={settings.email_smtp_user ?? ""} onChange={(e) => set("email_smtp_user", e.target.value)} className={inputCls} /></Field>
        <Field label="Password"><input type="password" value={settings.email_smtp_password ?? ""} onChange={(e) => set("email_smtp_password", e.target.value)} className={inputCls} /></Field>
        <Field label='From (e.g. "Tightarse" &lt;you@gmail.com&gt;)'>
          <input type="text" value={settings.email_from ?? ""} onChange={(e) => set("email_from", e.target.value)} className={inputCls} placeholder={settings.email_smtp_user || "you@example.com"} />
        </Field>
        <div className="flex items-center gap-3 pt-1">
          <SaveBar keys={["email_smtp_host", "email_smtp_port", "email_smtp_user", "email_smtp_password", "email_from"]} save={save} saving={saving} msg={saveMsg} />
          <button onClick={() => setTestEmailOpen(true)} className="flex items-center gap-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <Send size={14} /> Test
          </button>
        </div>
      </Section>
      {testEmailOpen && <TestEmailModal onClose={() => setTestEmailOpen(false)} />}
    </>
  );
}

function AddUserModal({ onClose, onCreated }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault(); setMsg("");
    setSaving(true);
    try {
      await api.createUser(username, password, role);
      onCreated();
      onClose();
    } catch (e) { setMsg(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white">Add user</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className={inputCls} required autoFocus />
          <input type="password" placeholder="Password (8+ chars)" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} required />
          <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
          {msg && <p className="text-xs text-red-500">{msg}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className={btnCls}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              Create user
            </button>
            <button type="button" onClick={onClose} className="text-sm text-gray-400 hover:text-gray-600 px-2">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminUsersTab() {
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPw, setResetPw] = useState("");
  const [resetMsg, setResetMsg] = useState("");

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    setUsersLoading(true);
    try { setUsers(await api.listUsers()); } finally { setUsersLoading(false); }
  }

  async function toggleActive(u) {
    try { await api.updateUser(u.id, { is_active: !u.is_active }); loadUsers(); } catch {}
  }

  async function doDeleteUser(u) {
    if (!window.confirm(`Delete user "${u.username}"? This will delete all their data.`)) return;
    try { await api.deleteUser(u.id); loadUsers(); } catch {}
  }

  async function submitReset(e) {
    e.preventDefault(); setResetMsg("");
    try {
      await api.resetUserPassword(resetTarget.id, resetPw);
      setResetMsg("Password reset"); setResetPw("");
      setTimeout(() => { setResetMsg(""); setResetTarget(null); }, 1500);
    } catch (e) { setResetMsg(e.message); }
  }

  return (
    <Section title="Users" action={<button onClick={() => setAddOpen(true)} className={btnCls}><UserPlus size={14} /> Add user</button>}>
      {usersLoading ? (
        <Loader2 className="animate-spin text-brand-500 mx-auto" size={20} />
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-2 py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
              <User size={14} className="text-gray-400 shrink-0" />
              <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{u.username}</span>
              <span className="text-xs text-gray-400 shrink-0 hidden sm:block" title={u.last_active_at ? new Date(u.last_active_at + "Z").toLocaleString() : (u.last_login_at ? new Date(u.last_login_at + "Z").toLocaleString() : "Never")}>
                {u.last_active_at ? `Seen ${timeAgo(u.last_active_at + "Z")}` : u.last_login_at ? `Logged in ${timeAgo(u.last_login_at + "Z")}` : "Never seen"}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${u.role === "admin" ? "bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300" : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"}`}>
                {u.role}
              </span>
              {!u.is_active && <span className="text-xs text-red-400 shrink-0">disabled</span>}
              <button onClick={() => { setResetTarget(u); setResetPw(""); setResetMsg(""); }} className="p-1 text-gray-400 hover:text-brand-600 shrink-0" title="Reset password"><KeyRound size={14} /></button>
              <button onClick={() => toggleActive(u)} className="p-1 text-gray-400 hover:text-yellow-500 shrink-0" title={u.is_active ? "Disable" : "Enable"}>
                {u.is_active ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
              </button>
              <button onClick={() => doDeleteUser(u)} className="p-1 text-gray-400 hover:text-red-500 shrink-0" title="Delete"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
      {resetTarget && (
        <form onSubmit={submitReset} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Reset password for <strong>{resetTarget.username}</strong></p>
          <input type="password" placeholder="New password (8+ chars)" value={resetPw} onChange={(e) => setResetPw(e.target.value)} className={inputCls} required />
          {resetMsg && <p className={`text-xs ${resetMsg === "Password reset" ? "text-brand-600" : "text-red-500"}`}>{resetMsg}</p>}
          <div className="flex gap-2">
            <button type="submit" className={btnCls}><KeyRound size={14} /> Reset</button>
            <button type="button" onClick={() => setResetTarget(null)} className="text-xs text-gray-400 px-2">Cancel</button>
          </div>
        </form>
      )}
      {addOpen && <AddUserModal onClose={() => setAddOpen(false)} onCreated={loadUsers} />}
    </Section>
  );
}

const LOG_LEVELS = ["ALL", "INFO", "WARN", "ERROR"];

function AdminLogsTab() {
  const [logs, setLogs] = useState([]);
  const [paused, setPaused] = useState(false);
  const [levelFilter, setLevelFilter] = useState("ALL");
  const bottomRef = useRef(null);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  useEffect(() => {
    // Load persisted history from file
    api.getLogHistory().then(({ lines }) => setLogs(lines)).catch(() => {});

    // Stream only new lines written after connect
    const token = localStorage.getItem("ta_token");
    const es = new EventSource(`/api/admin/logs/stream?token=${encodeURIComponent(token)}`);
    es.onmessage = (e) => {
      if (pausedRef.current) return;
      try {
        const line = JSON.parse(e.data);
        setLogs((prev) => {
          const next = [...prev, line];
          return next.length > 5000 ? next.slice(-5000) : next;
        });
      } catch {}
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, []);

  useEffect(() => {
    if (!paused) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, paused]);

  function levelColor(line) {
    if (line.includes(" ERROR "))   return "text-red-400";
    if (line.includes(" WARNING ")) return "text-yellow-400";
    if (line.includes(" INFO "))    return "text-gray-300";
    return "text-gray-500";
  }

  const filtered = levelFilter === "ALL" ? logs : logs.filter((l) =>
    levelFilter === "WARN" ? l.includes(" WARNING ") : l.includes(` ${levelFilter} `)
  );

  const controls = (
    <div className="flex items-center gap-2">
      <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-xs font-medium">
        {LOG_LEVELS.map((lv) => (
          <button
            key={lv}
            onClick={() => setLevelFilter(lv)}
            className={`px-2.5 py-1 transition-colors ${levelFilter === lv ? "bg-gray-800 text-white" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"}`}
          >
            {lv}
          </button>
        ))}
      </div>
      <button
        onClick={() => setPaused((p) => !p)}
        className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${paused ? "border-brand-500 text-brand-600 bg-brand-50 dark:bg-brand-950" : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
      >
        {paused ? "Resume" : "Pause"}
      </button>
      <button
        onClick={() => setLogs([])}
        className="text-xs px-2.5 py-1 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors flex items-center gap-1"
      >
        <Trash size={11} /> Clear
      </button>
    </div>
  );

  return (
    <Section title="Logs" action={controls}>
      <div className="font-mono text-xs bg-gray-950 rounded-xl p-3 h-[26rem] overflow-y-auto space-y-0.5">
        {filtered.length === 0 && (
          <span className="text-gray-600">{logs.length === 0 ? "Loading…" : "No matching log entries."}</span>
        )}
        {filtered.map((line, i) => (
          <div key={i} className={`leading-5 whitespace-pre-wrap break-all ${levelColor(line)}`}>{line}</div>
        ))}
        <div ref={bottomRef} />
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500">
        {filtered.length}{levelFilter !== "ALL" ? ` ${levelFilter}` : ""} lines · 7-day retention
      </p>
    </Section>
  );
}

// ── Test email modal ──────────────────────────────────────────────────────────

function TestEmailModal({ onClose }) {
  const [to, setTo] = useState("");
  const [status, setStatus] = useState(null); // null | "sending" | "ok" | string(error)

  async function send(e) {
    e.preventDefault();
    setStatus("sending");
    try {
      await api.testEmail(to);
      setStatus("ok");
    } catch (err) {
      setStatus(err.message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white">Send test email</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={18} /></button>
        </div>
        {status === "ok" ? (
          <div className="text-center py-4 space-y-2">
            <p className="text-brand-600 font-medium">Email sent successfully.</p>
            <button onClick={onClose} className={btnCls}>Close</button>
          </div>
        ) : (
          <form onSubmit={send} className="space-y-3">
            <input
              type="email"
              placeholder="Send to address"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={inputCls}
              required
              autoFocus
            />
            {status && status !== "sending" && (
              <p className="text-xs text-red-500">{status}</p>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={status === "sending"} className={btnCls}>
                {status === "sending" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Send
              </button>
              <button type="button" onClick={onClose} className="text-sm text-gray-400 hover:text-gray-600 px-2">Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Shared components ─────────────────────────────────────────────────────────

function InfoTooltip({ text }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <Info size={12} className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 cursor-help shrink-0" />
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-56 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg px-3 py-2 shadow-lg z-50 leading-relaxed pointer-events-none">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
        </span>
      )}
    </span>
  );
}

function Section({ title, description, action, children }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</h2>
        {action}
      </div>
      {description && <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>}
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${value ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-600"}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${value ? "translate-x-4" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}

function SaveBar({ keys, save, saving, msg }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <button onClick={() => save(keys)} disabled={saving} className={btnCls}>
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        Save
      </button>
      {msg && <span className={`text-xs ${msg === "Saved" ? "text-brand-600" : "text-red-500"}`}>{msg}</span>}
    </div>
  );
}

const inputCls = "w-full text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500";
const btnCls = "flex items-center gap-1.5 text-sm font-medium bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50";
