import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

type DesignTokens = {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  fontFamily: 'inter' | 'system' | 'georgia';
  cardRadius: 'compact' | 'comfortable' | 'rounded';
  contentWidth: 'standard' | 'wide' | 'extra-wide';
  shadow: 'none' | 'soft' | 'elevated';
};

const DEFAULT_THEME: DesignTokens = {
  // Identidad visual original protegida de Las Delicias de la Tía.
  primary: '#C51E43', secondary: '#FFF3E7', accent: '#B91F4C',
  background: '#FFF9F1', surface: '#FFFDF9', text: '#321522',
  muted: '#74666B', border: '#EADFD8', fontFamily: 'inter',
  cardRadius: 'comfortable', contentWidth: 'wide', shadow: 'soft',
};

const COLOR_FIELDS: Array<{ key: keyof Pick<DesignTokens, 'primary' | 'secondary' | 'accent' | 'background' | 'surface' | 'text' | 'muted' | 'border'>; label: string; help: string }> = [
  { key: 'primary', label: 'Color principal', help: 'Acciones y elementos principales de la marca.' },
  { key: 'secondary', label: 'Color secundario', help: 'Detalles, resaltados y elementos complementarios.' },
  { key: 'accent', label: 'Color de énfasis', help: 'Acentos visuales y elementos destacados.' },
  { key: 'background', label: 'Fondo general', help: 'Color de fondo de las páginas públicas.' },
  { key: 'surface', label: 'Superficies y tarjetas', help: 'Fondos de tarjetas, paneles y formularios.' },
  { key: 'text', label: 'Texto principal', help: 'Color del texto general.' },
  { key: 'muted', label: 'Texto secundario', help: 'Ayudas, descripciones y textos discretos.' },
  { key: 'border', label: 'Bordes y separadores', help: 'Líneas de tarjetas, campos y divisiones.' },
];

function readTokens(raw: unknown, primaryFallback?: string, secondaryFallback?: string): DesignTokens {
  let candidate: Record<string, unknown> = {};
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) candidate = parsed as Record<string, unknown>;
    } catch { /* Se utilizan los valores predeterminados. */ }
  }
  const result: DesignTokens = {
    ...DEFAULT_THEME,
    primary: typeof candidate.primary === 'string' ? candidate.primary : (primaryFallback || DEFAULT_THEME.primary),
    secondary: typeof candidate.secondary === 'string' ? candidate.secondary : (secondaryFallback || DEFAULT_THEME.secondary),
    accent: typeof candidate.accent === 'string' ? candidate.accent : DEFAULT_THEME.accent,
    background: typeof candidate.background === 'string' ? candidate.background : DEFAULT_THEME.background,
    surface: typeof candidate.surface === 'string' ? candidate.surface : DEFAULT_THEME.surface,
    text: typeof candidate.text === 'string' ? candidate.text : DEFAULT_THEME.text,
    muted: typeof candidate.muted === 'string' ? candidate.muted : DEFAULT_THEME.muted,
    border: typeof candidate.border === 'string' ? candidate.border : DEFAULT_THEME.border,
    fontFamily: ['inter', 'system', 'georgia'].includes(String(candidate.fontFamily)) ? candidate.fontFamily as DesignTokens['fontFamily'] : DEFAULT_THEME.fontFamily,
    cardRadius: ['compact', 'comfortable', 'rounded'].includes(String(candidate.cardRadius)) ? candidate.cardRadius as DesignTokens['cardRadius'] : DEFAULT_THEME.cardRadius,
    contentWidth: ['standard', 'wide', 'extra-wide'].includes(String(candidate.contentWidth)) ? candidate.contentWidth as DesignTokens['contentWidth'] : DEFAULT_THEME.contentWidth,
    shadow: ['none', 'soft', 'elevated'].includes(String(candidate.shadow)) ? candidate.shadow as DesignTokens['shadow'] : DEFAULT_THEME.shadow,
  };
  for (const field of COLOR_FIELDS) {
    if (!/^#[0-9a-fA-F]{6}$/.test(result[field.key])) result[field.key] = DEFAULT_THEME[field.key];
  }
  return result;
}

function ColorField({ label, help, value, onChange }: { label: string; help: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3">
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-12 cursor-pointer rounded-lg border border-gray-200 bg-white p-1" aria-label={label} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-gray-900">{label}</span>
        <span className="mt-0.5 block text-xs text-gray-500">{help}</span>
        <span className="mt-1 block font-mono text-xs uppercase text-gray-600">{value}</span>
      </span>
    </label>
  );
}

export default function DesignTheme() {
  const token = localStorage.getItem('token') || '';
  const [theme, setTheme] = useState<DesignTokens>(DEFAULT_THEME);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch('/api/settings').then((response) => response.json()),
      fetch('/api/settings/storefront-content').then((response) => response.json()),
    ])
      .then(([settingsResponse, contentResponse]) => {
        if (!active) return;
        const settings = settingsResponse?.success ? settingsResponse.data : {};
        const content = contentResponse?.success ? contentResponse.data : {};
        setTheme(readTokens(content?.designTokensJson, settings?.colorPrimary, settings?.colorSecondary));
      })
      .catch(() => {
        if (active) setError('No fue posible cargar la configuración visual. Se muestran los valores predeterminados.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const previewStyle = useMemo(() => {
    const font = theme.fontFamily === 'georgia'
      ? 'Georgia, Times New Roman, serif'
      : theme.fontFamily === 'system'
        ? 'system-ui, sans-serif'
        : 'Inter, system-ui, sans-serif';
    const radius = theme.cardRadius === 'compact' ? '10px' : theme.cardRadius === 'rounded' ? '26px' : '18px';
    const shadow = theme.shadow === 'none' ? 'none' : theme.shadow === 'elevated'
      ? '0 18px 42px rgba(30,18,24,.17)' : '0 10px 28px rgba(30,18,24,.09)';
    return { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border, borderRadius: radius, boxShadow: shadow, fontFamily: font };
  }, [theme]);

  async function handleSave() {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/settings/storefront-content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: { designTokensJson: JSON.stringify(theme) } }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setError(typeof result.error === 'string' ? result.error : 'No se pudo guardar la configuración visual.');
        return;
      }
      setSuccess('La configuración visual se guardó correctamente. Actualiza la tienda para comprobar todos los cambios.');
    } catch {
      setError('Error de conexión. No fue posible guardar la configuración visual.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-gray-500">Cargando la configuración visual…</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/settings" className="text-sm font-medium text-primary-600 hover:underline">← Volver a configuración</Link>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">Diseño visual de la tienda</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">Configura la paleta, los fondos, la tipografía y las proporciones generales de la tienda pública.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setTheme(DEFAULT_THEME)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Restablecer</button>
          <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar diseño'}</button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {success && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</div>}

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Paleta de colores</h2>
        <p className="mb-4 mt-1 text-sm text-gray-600">Estos colores alimentan el tema visual central y los componentes que ya utilizan sus variables.</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {COLOR_FIELDS.map((field) => (
            <ColorField key={field.key} label={field.label} help={field.help} value={theme[field.key]} onChange={(value) => setTheme((current) => ({ ...current, [field.key]: value }))} />
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Tipografía y proporciones</h2>
            <p className="mt-1 text-sm text-gray-600">Ajusta la presentación general sin cambiar el contenido ni la lógica comercial.</p>
          </div>
          <label className="block text-sm font-medium text-gray-700">Tipografía
            <select value={theme.fontFamily} onChange={(event) => setTheme((current) => ({ ...current, fontFamily: event.target.value as DesignTokens['fontFamily'] }))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2">
              <option value="inter">Inter — moderna</option>
              <option value="system">Sistema — nativa del dispositivo</option>
              <option value="georgia">Georgia — clásica</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">Redondeo de tarjetas
            <select value={theme.cardRadius} onChange={(event) => setTheme((current) => ({ ...current, cardRadius: event.target.value as DesignTokens['cardRadius'] }))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2">
              <option value="compact">Compacto</option>
              <option value="comfortable">Equilibrado</option>
              <option value="rounded">Muy redondeado</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">Ancho del contenido
            <select value={theme.contentWidth} onChange={(event) => setTheme((current) => ({ ...current, contentWidth: event.target.value as DesignTokens['contentWidth'] }))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2">
              <option value="standard">Estándar — 1120 px</option>
              <option value="wide">Amplio — 1280 px</option>
              <option value="extra-wide">Extra amplio — 1440 px</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">Sombras
            <select value={theme.shadow} onChange={(event) => setTheme((current) => ({ ...current, shadow: event.target.value as DesignTokens['shadow'] }))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2">
              <option value="none">Sin sombras</option>
              <option value="soft">Suaves</option>
              <option value="elevated">Marcadas</option>
            </select>
          </label>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
          <h2 className="text-lg font-semibold text-gray-900">Vista previa</h2>
          <p className="mb-4 mt-1 text-sm text-gray-600">Ejemplo de cómo se combinarán los tokens visuales.</p>
          <div className="border p-5 transition-all" style={previewStyle}>
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: theme.accent }}>Vista de la tienda</div>
            <div className="text-2xl font-bold">Tu negocio, tu estilo</div>
            <p className="mt-2 text-sm" style={{ color: theme.muted }}>Una presentación coherente con la identidad de tu marca.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: theme.primary }}>Acción principal</span>
              <span className="rounded-lg border px-4 py-2 text-sm font-semibold" style={{ borderColor: theme.secondary, color: theme.text }}>Acción secundaria</span>
            </div>
            <div className="mt-5 rounded-xl border p-3" style={{ borderColor: theme.border, backgroundColor: theme.background }}>
              <div className="text-sm font-semibold">Tarjeta de ejemplo</div>
              <div className="mt-1 text-xs" style={{ color: theme.muted }}>Fondo, bordes, texto y superficie.</div>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">La vista previa es orientativa. Algunas páginas y componentes antiguos aún conservan estilos propios que se migrarán en fases posteriores.</p>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <span>Los cambios se guardan en la configuración existente de la tienda; no requieren migraciones de base de datos.</span>
        <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-primary-600 px-4 py-2 font-semibold text-white hover:bg-primary-700 disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar diseño'}</button>
      </div>
    </div>
  );
}
