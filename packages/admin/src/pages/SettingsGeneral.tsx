import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

 type SettingsData = {
  siteName: string;
  siteTitle: string;
  taglinePrimary: string;
  taglineSecondary: string;
  contactPhone: string;
  contactWhatsapp: string;
};

const emptySettings: SettingsData = { siteName: '', siteTitle: '', taglinePrimary: '', taglineSecondary: '', contactPhone: '', contactWhatsapp: '' };
const fieldClass = 'w-full rounded-lg border border-[#DCCFC9] px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#A96B5D] focus:ring-2 focus:ring-[#F1E2DC]';
const labelClass = 'mb-1.5 block text-sm font-medium text-[#49343B]';

export default function SettingsGeneral() {
  const token = localStorage.getItem('token') || '';
  const [form, setForm] = useState<SettingsData>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/settings', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success || !result.data) throw new Error(result.error || 'No se pudo cargar la configuración del negocio.');
        if (active) setForm({
          siteName: result.data.siteName || '',
          siteTitle: result.data.siteTitle || '',
          taglinePrimary: result.data.taglinePrimary || '',
          taglineSecondary: result.data.taglineSecondary || '',
          contactPhone: result.data.contactPhone || '',
          contactWhatsapp: result.data.contactWhatsapp || '',
        });
      })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la configuración.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  function updateField(field: keyof SettingsData, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setSuccess('');
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'No se pudieron guardar los cambios.');
      setSuccess('Los datos del negocio se guardaron correctamente.');
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Ocurrió un error al guardar.');
    } finally { setSaving(false); }
  }

  if (loading) return <div className="p-6 text-sm text-gray-600">Cargando datos del negocio…</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><Link to="/settings" className="text-sm font-semibold text-[#8F4F43] hover:underline">← Volver a configuración</Link><h1 className="mt-3 text-2xl font-bold text-[#3B222B]">Datos del negocio</h1><p className="mt-1 text-sm text-gray-600">Información que identifica a Las Delicias de la Tía en la tienda.</p></div>
        <button type="submit" form="general-settings-form" disabled={saving} className="rounded-lg bg-[#8F4F43] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#744037] disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar cambios'}</button>
      </div>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}
      <form id="general-settings-form" onSubmit={handleSave} className="space-y-6 rounded-2xl border border-[#E8DDD7] bg-white p-5 shadow-sm sm:p-6">
        <section><h2 className="font-semibold text-[#3B222B]">Identidad y presentación</h2><p className="mb-4 mt-1 text-sm text-gray-500">Estos textos aparecen en la tienda y en sus comunicaciones.</p><div className="grid gap-4 sm:grid-cols-2">
          <div><label className={labelClass} htmlFor="siteName">Nombre del negocio</label><input id="siteName" className={fieldClass} value={form.siteName} onChange={(event) => updateField('siteName', event.target.value)} minLength={2} maxLength={120} required /></div>
          <div><label className={labelClass} htmlFor="siteTitle">Título de la tienda</label><input id="siteTitle" className={fieldClass} value={form.siteTitle} onChange={(event) => updateField('siteTitle', event.target.value)} minLength={2} maxLength={180} required /></div>
          <div><label className={labelClass} htmlFor="taglinePrimary">Frase principal</label><input id="taglinePrimary" className={fieldClass} value={form.taglinePrimary} onChange={(event) => updateField('taglinePrimary', event.target.value)} maxLength={180} required /></div>
          <div><label className={labelClass} htmlFor="taglineSecondary">Frase complementaria</label><input id="taglineSecondary" className={fieldClass} value={form.taglineSecondary} onChange={(event) => updateField('taglineSecondary', event.target.value)} maxLength={180} required /></div>
        </div></section>
        <div className="border-t border-gray-100" />
        <section><h2 className="font-semibold text-[#3B222B]">Datos de contacto</h2><p className="mb-4 mt-1 text-sm text-gray-500">Números que los clientes pueden utilizar para comunicarse y hacer pedidos.</p><div className="grid gap-4 sm:grid-cols-2">
          <div><label className={labelClass} htmlFor="contactPhone">Teléfono de contacto</label><input id="contactPhone" type="tel" className={fieldClass} value={form.contactPhone} onChange={(event) => updateField('contactPhone', event.target.value)} maxLength={25} required /></div>
          <div><label className={labelClass} htmlFor="contactWhatsapp">WhatsApp para pedidos</label><input id="contactWhatsapp" type="tel" className={fieldClass} value={form.contactWhatsapp} onChange={(event) => updateField('contactWhatsapp', event.target.value)} maxLength={25} required /></div>
        </div></section>
        <div className="rounded-xl bg-[#F8F1ED] p-4 text-sm text-[#684B4B]">La tienda está configurada para Colombia: moneda en pesos colombianos (COP) y zona horaria de Bogotá.</div>
        <div className="flex justify-end border-t border-gray-100 pt-4"><button type="submit" disabled={saving} className="rounded-lg bg-[#8F4F43] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#744037] disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar cambios'}</button></div>
      </form>
    </div>
  );
}
