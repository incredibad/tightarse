import { useState, useEffect } from "react";
import {
  Sun, Moon, LogOut, Save, RefreshCw, Loader2,
  UserPlus, Trash2, KeyRound, ShieldCheck, ShieldOff, User, Send, X,
  ChevronUp, ChevronDown, ToggleLeft, ToggleRight,
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
          v0.3.2
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
          <p className="text-xs text-gray-400 mb-2">Logged in as <strong>{user.username}</strong> ({user.role})</p>
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
  const [drakesMsg, setDrakesMsg] = useState("");
  const [drakesStoreList, setDrakesStoreList] = useState(DRAKES_STORES);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [allStores, settings] = await Promise.all([api.getStores(), api.getSettings()]);
      const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));
      setDrakesStoreId(settingsMap.drakes_store_id || "087");
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

  async function saveDrakesStoreId() {
    setDrakesMsg("");
    try {
      await api.updateSettings({ drakes_store_id: drakesStoreId });
      setDrakesMsg("Saved");
      setTimeout(() => setDrakesMsg(""), 2000);
    } catch (e) {
      setDrakesMsg(e.message);
    }
  }

  const drakesStore = stores.find((s) => s.scraper_module === "drakes");

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
            <div key={store.id} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
              <div className="flex items-center gap-2 py-1.5">
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-20"><ChevronUp size={14} /></button>
                  <button onClick={() => move(i, 1)} disabled={i === stores.length - 1} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-20"><ChevronDown size={14} /></button>
                </div>
                <span className="text-xs font-bold text-gray-400 w-4 text-center shrink-0">{i + 1}</span>
                <span className={`text-sm font-medium ${store.enabled ? "text-gray-800 dark:text-gray-100" : "text-gray-400 dark:text-gray-500 line-through"} ${store.scraper_module === "drakes" && store.enabled ? "" : "flex-1"}`}>{store.name}</span>
                {store.scraper_module === "drakes" && store.enabled && (
                  <>
                    <select
                      value={drakesStoreId}
                      onChange={(e) => setDrakesStoreId(e.target.value)}
                      className="flex-1 min-w-0 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-white"
                    >
                      {drakesStoreList.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                      ))}
                    </select>
                    <button onClick={saveDrakesStoreId} className="text-xs text-brand-600 hover:text-brand-700 font-medium shrink-0">Save</button>
                    {drakesMsg && <span className={`text-xs shrink-0 ${drakesMsg === "Saved" ? "text-brand-600" : "text-red-500"}`}>{drakesMsg}</span>}
                  </>
                )}
                <button
                  onClick={() => toggle(store.id)}
                  className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors shrink-0 ${store.enabled ? "bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300" : "bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500"}`}
                >
                  {store.enabled ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                  {store.enabled ? "On" : "Off"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

// ── Admin tab ─────────────────────────────────────────────────────────────────

function AdminTab({ settings, set, save, saving, saveMsg }) {
  const [testEmailOpen, setTestEmailOpen] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState("");
  const [drakesScanResults, setDrakesScanResults] = useState(null);
  const [drakesScanLoading, setDrakesScanLoading] = useState(false);
  const [drakesScanMsg, setDrakesScanMsg] = useState("");
  const [drakesSaveMsg, setDrakesSaveMsg] = useState("");
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [createMsg, setCreateMsg] = useState("");
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPw, setResetPw] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [proxyTesting, setProxyTesting] = useState(false);
  const [proxyTestResult, setProxyTestResult] = useState(null);

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    setUsersLoading(true);
    try { setUsers(await api.listUsers()); } finally { setUsersLoading(false); }
  }

  async function testProxy() {
    setProxyTesting(true);
    setProxyTestResult(null);
    try {
      const r = await api.testProxy();
      setProxyTestResult({ ok: true, ip: r.ip });
    } catch (e) {
      setProxyTestResult({ ok: false, msg: e.message });
    } finally {
      setProxyTesting(false);
    }
  }

  async function triggerScrape() {
    setScraping(true);
    setScrapeMsg("");
    try {
      const r = await api.rescrapeAll();
      setScrapeMsg(`Scraped ${r.scraped} products`);
      setTimeout(() => setScrapeMsg(""), 3000);
    } catch (e) {
      setScrapeMsg(e.message);
    } finally {
      setScraping(false);
    }
  }

  async function runDrakesScan() {
    setDrakesScanLoading(true);
    setDrakesScanMsg("");
    setDrakesScanResults(null);
    setDrakesSaveMsg("");
    try {
      const results = await api.scanDrakesStores();
      setDrakesScanResults(results);
      if (!results.length) setDrakesScanMsg("No stores found — page structure may have changed.");
    } catch (e) {
      setDrakesScanMsg(e.message);
    } finally {
      setDrakesScanLoading(false);
    }
  }

  async function saveDrakesMap() {
    setDrakesSaveMsg("");
    try {
      const toSave = (drakesScanResults || []).filter((s) => s.working);
      await api.saveDrakesStores(toSave);
      setDrakesSaveMsg(`Saved ${toSave.length} stores`);
      setTimeout(() => setDrakesSaveMsg(""), 3000);
    } catch (e) {
      setDrakesSaveMsg(e.message);
    }
  }

  async function createUser(e) {
    e.preventDefault();
    setCreateMsg("");
    try {
      await api.createUser(newUsername, newPassword, newRole);
      setNewUsername(""); setNewPassword(""); setNewRole("user");
      setCreateMsg("User created");
      setTimeout(() => setCreateMsg(""), 2000);
      loadUsers();
    } catch (e) {
      setCreateMsg(e.message);
    }
  }

  async function toggleActive(u) {
    try { await api.updateUser(u.id, { is_active: !u.is_active }); loadUsers(); } catch {}
  }

  async function doDeleteUser(u) {
    if (!window.confirm(`Delete user "${u.username}"? This will delete all their data.`)) return;
    try { await api.deleteUser(u.id); loadUsers(); } catch {}
  }

  async function submitReset(e) {
    e.preventDefault();
    setResetMsg("");
    try {
      await api.resetUserPassword(resetTarget.id, resetPw);
      setResetMsg("Password reset");
      setResetPw("");
      setTimeout(() => { setResetMsg(""); setResetTarget(null); }, 1500);
    } catch (e) {
      setResetMsg(e.message);
    }
  }

  return (
    <div className="space-y-4">
      <Section title="Scraping">
        <Field label="Check prices every (hours)">
          <input
            type="number" min="1" max="168"
            value={settings.scrape_interval_hours ?? "6"}
            onChange={(e) => set("scrape_interval_hours", e.target.value)}
            className={inputCls}
          />
        </Field>
        <SaveBar keys={["scrape_interval_hours"]} save={save} saving={saving} msg={saveMsg} />
        <button onClick={triggerScrape} disabled={scraping} className={`mt-2 ${btnCls}`}>
          {scraping ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Check all prices now
        </button>
        {scrapeMsg && <p className="text-xs text-brand-600 mt-1">{scrapeMsg}</p>}
      </Section>

      <Section title="VPN / Proxy">
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-2">
          Route scraping through an HTTP proxy (e.g. gluetun on your Docker network).
          Amazon Australia <strong>always</strong> requires a proxy to protect your home IP — it will not
          scrape without one. Other stores use the proxy only when "Route all through VPN" is on.
        </p>
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
        <div className="flex items-center gap-3 pt-1 flex-wrap">
          <SaveBar keys={["vpn_proxy_url", "scrape_via_vpn"]} save={save} saving={saving} msg={saveMsg} />
          <button
            onClick={testProxy}
            disabled={proxyTesting || !settings.vpn_proxy_url}
            className={btnCls}
          >
            {proxyTesting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Test connectivity
          </button>
          {proxyTestResult && (
            proxyTestResult.ok
              ? <span className="text-xs text-brand-600">Connected — exit IP: {proxyTestResult.ip}</span>
              : <span className="text-xs text-red-500">{proxyTestResult.msg}</span>
          )}
        </div>
      </Section>

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

      <Section title="Drakes Store Map">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Scan the Drakes website to discover online stores and update the store dropdown.
          Only stores that respond successfully will be saved.
        </p>
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
              <button onClick={saveDrakesMap} className={btnCls}>
                <Save size={14} /> Save working stores
              </button>
              {drakesSaveMsg && <span className="text-xs text-brand-600">{drakesSaveMsg}</span>}
            </div>
          </div>
        )}
      </Section>

      <Section title="Users">
        {usersLoading ? (
          <Loader2 className="animate-spin text-brand-500 mx-auto" size={20} />
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-2 py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <User size={14} className="text-gray-400 shrink-0" />
                <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{u.username}</span>
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
          <form onSubmit={submitReset} className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-300">Reset password for <strong>{resetTarget.username}</strong></p>
            <input type="password" placeholder="New password (8+ chars)" value={resetPw} onChange={(e) => setResetPw(e.target.value)} className={inputCls} required />
            {resetMsg && <p className={`text-xs ${resetMsg === "Password reset" ? "text-brand-600" : "text-red-500"}`}>{resetMsg}</p>}
            <div className="flex gap-2">
              <button type="submit" className={btnCls}><KeyRound size={14} /> Reset</button>
              <button type="button" onClick={() => setResetTarget(null)} className="text-xs text-gray-400 px-2">Cancel</button>
            </div>
          </form>
        )}

        <form onSubmit={createUser} className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-300">New user</p>
          <input type="text" placeholder="Username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className={inputCls} required />
          <input type="password" placeholder="Password (8+ chars)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} required />
          <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className={inputCls}>
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
          {createMsg && <p className={`text-xs ${createMsg === "User created" ? "text-brand-600" : "text-red-500"}`}>{createMsg}</p>}
          <button type="submit" className={btnCls}><UserPlus size={14} /> Create user</button>
        </form>
      </Section>
    </div>
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

function Section({ title, children }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</h2>
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
