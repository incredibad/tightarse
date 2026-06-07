import { useState, useEffect } from "react";
import { Save, Loader2, CheckCircle } from "lucide-react";
import { api } from "../api";

export default function Settings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getSettings().then((rows) => {
      const map = {};
      rows.forEach((r) => (map[r.key] = r.value ?? ""));
      setSettings(map);
      setLoading(false);
    });
  }, []);

  function set(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateSettings(settings);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader2 className="animate-spin text-brand-500" size={28} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="p-4 space-y-6">
      <h1 className="text-xl font-bold">Settings</h1>

      <Section title="Scraping">
        <Field label="Check prices every (hours)">
          <input type="number" min="1" max="168" value={settings.scrape_interval_hours ?? "6"} onChange={(e) => set("scrape_interval_hours", e.target.value)} className={inputClass} />
        </Field>
        <Field label="Notify only if price drops by at least (%)">
          <input type="number" min="0" max="100" value={settings.notify_price_drop_threshold_pct ?? "5"} onChange={(e) => set("notify_price_drop_threshold_pct", e.target.value)} className={inputClass} />
        </Field>
      </Section>

      <Section title="Email notifications">
        <Toggle label="Enable email" value={settings.email_enabled === "true"} onChange={(v) => set("email_enabled", v ? "true" : "false")} />
        {settings.email_enabled === "true" && (
          <>
            <Field label="SMTP host"><input value={settings.email_smtp_host ?? ""} onChange={(e) => set("email_smtp_host", e.target.value)} className={inputClass} /></Field>
            <Field label="SMTP port"><input type="number" value={settings.email_smtp_port ?? "587"} onChange={(e) => set("email_smtp_port", e.target.value)} className={inputClass} /></Field>
            <Field label="SMTP user"><input value={settings.email_smtp_user ?? ""} onChange={(e) => set("email_smtp_user", e.target.value)} className={inputClass} /></Field>
            <Field label="SMTP password"><input type="password" value={settings.email_smtp_password ?? ""} onChange={(e) => set("email_smtp_password", e.target.value)} className={inputClass} /></Field>
            <Field label="Send alerts to"><input type="email" value={settings.email_to ?? ""} onChange={(e) => set("email_to", e.target.value)} className={inputClass} /></Field>
          </>
        )}
      </Section>

      <Section title="Discord notifications">
        <Toggle label="Enable Discord" value={settings.discord_enabled === "true"} onChange={(v) => set("discord_enabled", v ? "true" : "false")} />
        {settings.discord_enabled === "true" && (
          <Field label="Webhook URL"><input value={settings.discord_webhook_url ?? ""} onChange={(e) => set("discord_webhook_url", e.target.value)} className={inputClass} placeholder="https://discord.com/api/webhooks/…" /></Field>
        )}
      </Section>

      <Section title="Gotify notifications">
        <Toggle label="Enable Gotify" value={settings.gotify_enabled === "true"} onChange={(v) => set("gotify_enabled", v ? "true" : "false")} />
        {settings.gotify_enabled === "true" && (
          <>
            <Field label="Server URL"><input value={settings.gotify_server_url ?? ""} onChange={(e) => set("gotify_server_url", e.target.value)} className={inputClass} placeholder="https://gotify.example.com" /></Field>
            <Field label="App token"><input value={settings.gotify_app_token ?? ""} onChange={(e) => set("gotify_app_token", e.target.value)} className={inputClass} /></Field>
          </>
        )}
      </Section>

      <button
        type="submit"
        disabled={saving}
        className="w-full flex justify-center items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <CheckCircle size={16} /> : <Save size={16} />}
        {saving ? "Saving…" : saved ? "Saved!" : "Save settings"}
      </button>
    </form>
  );
}

const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";

function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{title}</h2>
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? "bg-brand-500" : "bg-gray-300"}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${value ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}
