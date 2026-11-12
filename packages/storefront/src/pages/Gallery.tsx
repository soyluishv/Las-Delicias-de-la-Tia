import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApi } from '../hooks/useApi.js';
import { useTheme } from '../context/ThemeContext.js';

type GalleryCategory = 'FOOD' | 'EVENTS';

interface GalleryEntry {
  id: string;
  url: string;
  alt: string;
  category: GalleryCategory;
  sortOrder: number;
  isActive: boolean;
}

const CATEGORY_LABELS: Record<GalleryCategory, string> = {
  FOOD: 'Comidas',
  EVENTS: 'Eventos',
};

export default function Gallery() {
  const { data, isLoading, error } = useApi<GalleryEntry[]>('/api/gallery');
  const { settings } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | GalleryCategory>('ALL');
  const [lightbox, setLightbox] = useState<GalleryEntry | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const entries = useMemo(
    () => (data || []).filter((image) => image.isActive !== false && Boolean(image.url)),
    [data],
  );

  const filteredEntries = selectedCategory === 'ALL'
    ? entries
    : entries.filter((image) => image.category === selectedCategory);

  // Los enlaces compartidos nunca deben usar localhost ni direcciones de desarrollo.
  // En producción se toma automáticamente el dominio público donde está abierta la tienda.
  // Para probar desde localhost se puede definir VITE_PUBLIC_STOREFRONT_URL con el dominio real.
  // Dominio público canónico, confirmado en los metadatos de packages/storefront/index.html.
  // En producción se respeta el dominio con el que el cliente abrió la tienda; en localhost
  // usamos este dominio público para que el mensaje de WhatsApp nunca lleve una URL local.
  const DEFAULT_PUBLIC_STOREFRONT_ORIGIN = 'https://las-delicias-tienda.pages.dev';
  const configuredPublicOrigin = import.meta.env.VITE_PUBLIC_STOREFRONT_URL?.trim();
  const getPublicOrigin = (): string => {
    if (configuredPublicOrigin) {
      try {
        const configuredUrl = new URL(configuredPublicOrigin);
        if (configuredUrl.protocol === 'https:' && !['localhost', '127.0.0.1', '::1'].includes(configuredUrl.hostname)) {
          return configuredUrl.origin;
        }
      } catch {
        // Una configuración incorrecta se ignora y se usa el dominio público conocido.
      }
    }

    const hostname = window.location.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.endsWith('.local')) {
      return DEFAULT_PUBLIC_STOREFRONT_ORIGIN;
    }
    return window.location.origin;
  };

  const getPublicPhotoUrl = (image: GalleryEntry): string => {
    const url = new URL('/gallery', getPublicOrigin());
    url.searchParams.set('photo', image.id);
    return url.toString();
  };

  const whatsappNumber = (settings.contactWhatsapp || '').replace(/\D/g, '');
  const whatsappUrl = (image: GalleryEntry) => {
    const phone = whatsappNumber.length === 10 ? `57${whatsappNumber}` : whatsappNumber;
    const category = CATEGORY_LABELS[image.category] || 'Galería';
    const publicPhotoUrl = getPublicPhotoUrl(image);
    const photoInstructions = `Enlace para ver esta fotografía: ${publicPhotoUrl}`;
    const message = `Hola, vi esta fotografía en la galería de Las Delicias de la Tía y quisiera información. Categoría: ${category}. Referencia: ${image.id}. ${photoInstructions}`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  };

  // Permite abrir directamente una fotografía desde un enlace compartido por WhatsApp.
  useEffect(() => {
    if (isLoading) return;
    const photoId = searchParams.get('photo');
    if (!photoId) return;
    const requestedPhoto = entries.find((image) => image.id === photoId);
    if (requestedPhoto) setLightbox(requestedPhoto);
  }, [entries, isLoading, searchParams]);

  const closeLightbox = () => {
    setLightbox(null);
    if (searchParams.has('photo')) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('photo');
      setSearchParams(nextParams, { replace: true });
    }
  };

  return (
    <main data-ld-page="gallery" className="min-h-screen bg-[linear-gradient(180deg,#FFF9F1_0%,#FFFEFC_42%,#FFF5EA_100%)] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="relative mb-9 overflow-hidden rounded-[2rem] border border-[#E7B75C]/40 bg-[radial-gradient(circle_at_90%_0%,rgba(231,183,92,0.22),transparent_28%),linear-gradient(115deg,#FFF5E8,#FFFFFF_55%,#FBE8E6)] px-6 py-10 shadow-[0_18px_50px_rgba(78,27,43,0.08)] sm:px-10 sm:py-12">
          <span className="inline-flex rounded-full border border-[#E7B75C]/60 bg-white/90 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#8F173A]">Las Delicias de la Tía</span>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-[#74152F] sm:text-4xl lg:text-5xl">Galería de nuestras preparaciones</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6C5B5C] sm:text-base">Conoce nuestras comidas y eventos. Encuentra inspiración para tu próximo pedido o celebración.</p>
        </section>

        <div className="ld-gallery-filters mb-7 flex flex-wrap gap-2" aria-label="Filtrar fotografías por categoría">
          {(['ALL', 'FOOD', 'EVENTS'] as const).map((category) => {
            const label = category === 'ALL' ? 'Todas' : CATEGORY_LABELS[category];
            return (
              <button key={category} type="button" onClick={() => setSelectedCategory(category)} aria-pressed={selectedCategory === category}
                className={`rounded-full px-5 py-2.5 text-sm font-bold transition ${selectedCategory === category ? 'bg-[#74152F] text-white shadow-md' : 'border border-[#E8DCD2] bg-white text-[#65565C] hover:border-[#E7B75B]'}`}>
                {label}
              </button>
            );
          })}
        </div>

        {isLoading && <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="aspect-[4/3] animate-pulse rounded-[1.5rem] bg-white shadow-sm" />)}</div>}
        {!isLoading && error && <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700">No fue posible cargar la galería. Recarga la página para intentarlo de nuevo.</div>}

        {!isLoading && !error && filteredEntries.length === 0 && (
          <div className="rounded-[1.7rem] border border-dashed border-[#E7B75B] bg-white px-6 py-14 text-center shadow-sm">
            <div className="text-5xl" aria-hidden="true">🍽️</div>
            <h2 className="mt-4 text-xl font-black text-[#321522]">Estamos preparando nuestra galería</h2>
            <p className="mt-2 text-sm text-[#796B70]">Pronto encontrarás fotografías de nuestras comidas y eventos.</p>
          </div>
        )}

        {!isLoading && !error && filteredEntries.length > 0 && (
          <div className="ld-gallery-grid grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredEntries.map((entry) => (
              <article key={entry.id} className="overflow-hidden rounded-[1.6rem] border border-[#EDE0D5] bg-white shadow-[0_10px_30px_rgba(50,21,34,0.07)]">
                <button type="button" onClick={() => setLightbox(entry)} className="group block w-full text-left focus:outline-none focus:ring-4 focus:ring-[#F7DDE0]" aria-label={`Ampliar fotografía de ${CATEGORY_LABELS[entry.category]}`}>
                  <div className="aspect-[4/3] overflow-hidden bg-[#F5E6D8]"><img src={entry.url} alt={entry.alt || `Fotografía de ${CATEGORY_LABELS[entry.category]}`} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" /></div>
                  <div className="flex items-center justify-between gap-3 p-4"><p className="text-sm font-black text-[#321522]">{CATEGORY_LABELS[entry.category]}</p><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF2D7] text-[#8F173A] transition group-hover:bg-[#E7B75C]" aria-hidden="true">↗</span></div>
                </button>
                <div className="px-4 pb-4">
                  <a href={whatsappUrl(entry)} target="_blank" rel="noopener noreferrer" className="inline-flex w-full items-center justify-center rounded-xl bg-[#16834A] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#116B3C]">
                    Preguntar por esta fotografía
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {lightbox && (
        <div data-ld-lightbox className="fixed inset-0 z-[100] flex items-center justify-center bg-[#211019]/90 p-4 backdrop-blur-sm" onClick={closeLightbox} role="dialog" aria-modal="true" aria-label={`Fotografía de ${CATEGORY_LABELS[lightbox.category]}`}>
          <button type="button" onClick={closeLightbox} className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#74152F] shadow-lg" aria-label="Cerrar fotografía">✕</button>
          <div className="mx-auto flex w-full max-h-[88vh] max-w-5xl flex-col items-center justify-center" onClick={(event) => event.stopPropagation()}>
            <img src={lightbox.url} alt={lightbox.alt || `Fotografía de ${CATEGORY_LABELS[lightbox.category]}`} className="mx-auto block max-h-[68vh] max-w-full rounded-2xl object-contain shadow-2xl" />
            <p className="mt-3 w-full text-center text-sm font-bold text-white">{CATEGORY_LABELS[lightbox.category]}</p>
            <a href={whatsappUrl(lightbox)} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center justify-center rounded-xl bg-[#16834A] px-6 py-3 text-sm font-bold text-white hover:bg-[#116B3C]">
              Preguntar por esta fotografía
            </a>
          </div>
        </div>
      )}
    </main>
  );
}
