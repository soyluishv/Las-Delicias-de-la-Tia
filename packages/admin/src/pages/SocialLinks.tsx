import { useEffect, useState } from 'react';

type SocialLinkId = 'facebook' | 'instagram' | 'tiktok' | 'website' | 'custom_1' | 'custom_2';

type SocialLinkForm = {
  id: SocialLinkId;
  label: string;
  url: string;
  isEnabled: boolean;
};

const DEFAULT_LINKS: SocialLinkForm[] = [
  { id: 'facebook', label: 'Facebook', url: '', isEnabled: false },
  { id: 'instagram', label: 'Instagram', url: '', isEnabled: false },
  { id: 'tiktok', label: 'TikTok', url: '', isEnabled: false },
  { id: 'website', label: 'Página web', url: '', isEnabled: false },
  { id: 'custom_1', label: 'Enlace adicional 1', url: '', isEnabled: false },
  { id: 'custom_2', label: 'Enlace adicional 2', url: '', isEnabled: false },
];

function tokenHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function isValidHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export default function SocialLinks() {
  const [links, setLinks] = useState<SocialLinkForm[]>(DEFAULT_LINKS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function loadLinks() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/settings/social-links', {
          headers: { ...tokenHeaders(), Accept: 'application/json' },
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok || !result.success || !Array.isArray(result.data?.links)) {
          throw new Error(result.error || 'No se pudieron cargar los enlaces.');
        }

        const stored = new Map<string, SocialLinkForm>(
          result.data.links.map((link: SocialLinkForm): [string, SocialLinkForm] => [link.id, link]),
        );
        setLinks(DEFAULT_LINKS.map((fallback) => {
          const current = stored.get(fallback.id);
          return current ? { ...fallback, ...current } : fallback;
        }));
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los enlaces.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadLinks();
    return () => controller.abort();
  }, []);

  function updateLink(id: SocialLinkId, changes: Partial<SocialLinkForm>) {
    setLinks((current) => current.map((link) => link.id === id ? { ...link, ...changes } : link));
    setSuccess('');
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    for (const link of links) {
      if (link.isEnabled && !link.url.trim()) {
        setError(`Agrega la dirección de ${link.label} o desactiva ese enlace.`);
        return;
      }
      if (link.url.trim() && !isValidHttpsUrl(link.url.trim())) {
        setError(`La dirección de ${link.label} debe ser válida y comenzar por https://.`);
        return;
      }
      if ((link.id === 'custom_1' || link.id === 'custom_2') && link.url.trim() && !link.label.trim()) {
        setError('Escribe el nombre del enlace adicional.');
        return;
      }
    }

    setSaving(true);
    try {
      const response = await fetch('/api/settings/social-links', {
        method: 'PUT',
        headers: {
          ...tokenHeaders(),
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ links }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'No se pudieron guardar los enlaces.');
      }
      setSuccess(result.message || 'Los enlaces se guardaron correctamente.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron guardar los enlaces.');
    } finally {
      setSaving(false);
    }
  }

  const fixedLinks = links.filter((link) => link.id !== 'custom_1' && link.id !== 'custom_2');
  const customLinks = links.filter((link) => link.id === 'custom_1' || link.id === 'custom_2');

  function renderLinkCard(link: SocialLinkForm, custom = false) {
    return (
      <section key={link.id} className="rounded-2xl border border-[#E8DDD7] bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-[#3B222B]">{custom ? `Enlace adicional ${link.id === 'custom_1' ? '1' : '2'}` : link.label}</h2>
            <p className="mt-1 text-xs text-gray-500">{custom ? 'Puedes usarlo para YouTube u otra página.' : 'Dirección del perfil o sitio oficial.'}</p>
          </div>
          <label className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-[#56333F]">
            <input
              type="checkbox"
              checked={link.isEnabled}
              onChange={(event) => updateLink(link.id, { isEnabled: event.target.checked })}
              className="h-4 w-4 rounded border-[#CDBBB3] accent-[#8F344D]"
            />
            Mostrar
          </label>
        </div>

        {custom && (
          <label className="mt-4 block text-sm font-semibold text-[#56333F]">
            Nombre del enlace
            <input
              type="text"
              value={link.label}
              maxLength={60}
              onChange={(event) => updateLink(link.id, { label: event.target.value })}
              placeholder="Ej. YouTube"
              className="mt-1.5 w-full rounded-xl border border-[#DCCBC4] bg-[#FFFCFA] px-3 py-2.5 font-normal outline-none transition focus:border-[#9B5361] focus:ring-2 focus:ring-[#9B5361]/15"
            />
          </label>
        )}

        <label className="mt-4 block text-sm font-semibold text-[#56333F]">
          Dirección web
          <input
            type="url"
            inputMode="url"
            value={link.url}
            onChange={(event) => updateLink(link.id, { url: event.target.value })}
            placeholder="https://..."
            className="mt-1.5 w-full rounded-xl border border-[#DCCBC4] bg-[#FFFCFA] px-3 py-2.5 font-normal outline-none transition focus:border-[#9B5361] focus:ring-2 focus:ring-[#9B5361]/15"
          />
        </label>
        <p className="mt-2 text-xs text-gray-500">Usa una dirección segura que comience por https://.</p>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <header className="overflow-hidden rounded-2xl bg-[#2B1720] px-6 py-7 text-white shadow-sm sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#E9B9A9]">Las Delicias de la Tía</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Redes sociales y enlaces</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">Administra los perfiles y páginas que tus clientes podrán visitar desde la tienda.</p>
      </header>

      <div className="rounded-xl border border-[#E8DDD7] bg-[#FFFCFA] p-4 text-sm leading-6 text-[#65424B]">
        Configura Facebook, Instagram, TikTok y tu página web. También tienes dos espacios adicionales para agregar YouTube u otra plataforma. Solo aparecerán en la tienda los enlaces que estén activados y tengan una dirección válida.
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</div>}
      {success && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{success}</div>}

      {loading ? (
        <div className="rounded-2xl border border-[#E8DDD7] bg-white p-8 text-center text-sm text-gray-600">Cargando configuración de enlaces...</div>
      ) : (
        <form onSubmit={handleSave} className="space-y-7">
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-bold text-[#3B222B]">Redes y página principal</h2>
              <p className="mt-1 text-sm text-gray-600">Los cuatro espacios principales de tu negocio.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {fixedLinks.map((link) => renderLinkCard(link))}
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-bold text-[#3B222B]">Otros enlaces</h2>
              <p className="mt-1 text-sm text-gray-600">Dos espacios flexibles para plataformas adicionales.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {customLinks.map((link) => renderLinkCard(link, true))}
            </div>
          </section>

          <div className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-[#E8DDD7] pt-5 sm:flex-row sm:items-center">
            <p className="text-xs text-gray-500">Los cambios se reflejarán en el pie de página de la tienda al actualizarla.</p>
            <button type="submit" disabled={saving || loading} className="inline-flex items-center justify-center rounded-xl bg-[#8F344D] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#70283D] disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
