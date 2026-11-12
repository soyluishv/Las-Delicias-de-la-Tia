import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApi } from '../hooks/useApi.js';
import MenuItemModal from '../components/MenuItemModal.js';
import { useTheme } from '../context/ThemeContext.js';

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  images?: string[];
  isActive: boolean;
  parentId: string | null;
  _count: { menuItems: number };
  children: Category[];
}

interface MenuItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  image: string | null;
  images?: string[];
  isActive: boolean;
  trackStock: boolean;
  stockQty: number;
  category: { id: string; name: string };
  _count: { options: number; allergens: number; mealtimes: number };
}

interface MenuResponse {
  items: MenuItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export default function Menu() {
  const { t } = useTranslation();
  const { settings } = useTheme();
  const content = settings.storefrontContent;
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(searchParams.get('category'));
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [page, setPage] = useState(1);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const resultsSectionRef = useRef<HTMLElement | null>(null);

  const { data: categories, isLoading: categoriesLoading } = useApi<Category[]>('/api/menu/categories');
  const itemsUrl = buildItemsUrl(selectedCategory, debouncedSearch, page);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [pagination, setPagination] = useState<MenuResponse['pagination'] | null>(null);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setItemsLoading(true);
    setItemsError(null);
    fetch(itemsUrl)
      .then((res) => {
        if (!res.ok) throw new Error(content.catalogLoadError);
        return res.json();
      })
      .then((json) => {
        setItems(Array.isArray(json.data) ? json.data : []);
        setPagination(json.pagination ?? null);
      })
      .catch((err) => setItemsError(err instanceof Error ? err.message : content.catalogLoadError))
      .finally(() => setItemsLoading(false));
  }, [itemsUrl]);

  // Al abrir el menÃº desde una tarjeta destacada, lleva el resultado solicitado
  // a la parte visible de la pantalla, en lugar de conservar el scroll anterior.
  useEffect(() => {
    if ((!debouncedSearch && !selectedCategory) || itemsLoading) return;

    const target = resultsSectionRef.current;
    if (!target) return;

    const frame = window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'auto', block: 'start' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [debouncedSearch, selectedCategory, itemsLoading]);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (selectedCategory) params.category = selectedCategory;
    if (debouncedSearch) params.search = debouncedSearch;
    if (page > 1) params.page = String(page);
    setSearchParams(params, { replace: true });
  }, [selectedCategory, debouncedSearch, page, setSearchParams]);

  const activeCategories = categories?.filter((category) => category.isActive && !category.parentId) || [];
  const activeItems = items.filter((item) => item.isActive && (!item.trackStock || item.stockQty > 0));
  const categoryPreviewImage = (category: Category) => {
    const representative = activeItems.find((item) => item.category.id === category.id && (item.images?.[0] || item.image));
    return representative?.images?.[0] || representative?.image || category.images?.find((image) => image && !image.includes('/category-images/')) || null;
  };
  const categoryEmoji = (name: string) => {
    const normalized = name.toLocaleLowerCase('es');
    if (normalized.includes('hamburg')) return '🍔';
    if (normalized.includes('almuerzo') || normalized.includes('comida')) return '🍛';
    if (normalized.includes('picada') || normalized.includes('tabla')) return '🧀';
    if (normalized.includes('refrigerio')) return '🥪';
    if (normalized.includes('banquete') || normalized.includes('evento')) return '🍽️';
    if (normalized.includes('perro')) return '🌭';
    if (normalized.includes('tamal') || normalized.includes('fiambre')) return '🫔';
    if (normalized.includes('postre') || normalized.includes('dulce')) return '🍮';
    if (normalized.includes('frito')) return '🍟';
    if (normalized.includes('pasaboca')) return '🥟';
    if (normalized.includes('ropa') || normalized.includes('camiseta') || normalized.includes('vestido') || normalized.includes('pantalon') || normalized.includes('prenda')) return '👕';
    if (normalized.includes('zapato') || normalized.includes('calzado') || normalized.includes('tenis')) return '👟';
    if (normalized.includes('accesorio') || normalized.includes('bolso') || normalized.includes('joya')) return '👜';
    if (normalized.includes('hogar') || normalized.includes('decoracion')) return '🏠';
    if (normalized.includes('instrument') || normalized.includes('guitarra') || normalized.includes('piano') || normalized.includes('musical')) return '🎸';
    if (normalized.includes('tecnolog') || normalized.includes('computador') || normalized.includes('celular') || normalized.includes('electron')) return '💻';
    if (normalized.includes('libro') || normalized.includes('papeler')) return '📚';
    if (normalized.includes('mascota') || normalized.includes('animal')) return '🐾';
    if (normalized.includes('deporte') || normalized.includes('fitness')) return '⚽';
    return '📦';
  };
  const availableCategories = activeCategories.filter((category) => category._count.menuItems > 0);
  const sortedActiveItems = [...activeItems].sort((a, b) =>
    activeCategories.findIndex((category) => category.id === a.category.id) -
    activeCategories.findIndex((category) => category.id === b.category.id)
  );
  const selectedCategoryName = activeCategories.find((category) => category.id === selectedCategory)?.name;
  const showCategoryGrid = !selectedCategory && !debouncedSearch;

  function handleCategoryClick(categoryId: string | null) {
    setSelectedCategory(categoryId);
    setPage(1);
  }

  return (
    <main
      data-ld-page="menu"
      className="ld-menu-page min-h-screen"
      style={{
        background: 'linear-gradient(180deg, var(--ld-theme-background) 0%, color-mix(in srgb, var(--ld-theme-surface) 78%, var(--ld-theme-background)) 48%, var(--ld-theme-background) 100%)',
      }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-7 sm:px-6 sm:pt-10 lg:px-8 lg:pt-12">
        {/* Portada editorial del menú */}
        <section
          className="ld-menu-intro relative isolate mb-8 overflow-hidden rounded-[2rem] border px-5 py-10 text-center shadow-[0_18px_48px_rgba(78,27,43,0.08)] sm:px-10 sm:py-14"
          style={{
            borderColor: 'color-mix(in srgb, var(--ld-theme-secondary) 48%, var(--ld-theme-border))',
            background: 'radial-gradient(circle at 14% 18%, color-mix(in srgb, var(--ld-theme-secondary) 22%, transparent), transparent 28%), radial-gradient(circle at 88% 78%, color-mix(in srgb, var(--ld-theme-accent) 10%, transparent), transparent 30%), linear-gradient(135deg, var(--ld-theme-surface) 0%, color-mix(in srgb, var(--ld-theme-background) 76%, white) 55%, var(--ld-theme-surface) 100%)',
          }}
        >
          <div
            className="pointer-events-none absolute -right-20 -top-24 -z-10 h-64 w-64 rounded-full blur-3xl"
            style={{ background: 'color-mix(in srgb, var(--ld-theme-secondary) 23%, transparent)' }}
          />
          <div
            className="pointer-events-none absolute -bottom-28 -left-16 -z-10 h-60 w-60 rounded-full blur-3xl"
            style={{ background: 'color-mix(in srgb, var(--ld-theme-accent) 10%, transparent)' }}
          />
          <div className="relative mx-auto flex max-w-3xl flex-col items-center">
            <span
              className="inline-flex items-center gap-2 rounded-full border bg-white/85 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm"
              style={{
                borderColor: 'color-mix(in srgb, var(--ld-theme-secondary) 58%, var(--ld-theme-border))',
                color: 'var(--ld-theme-primary)',
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: 'var(--ld-theme-accent)', boxShadow: '0 0 0 4px color-mix(in srgb, var(--ld-theme-accent) 12%, transparent)' }}
              />
              {content.catalogIntroBadge}
            </span>

            <div className="mt-5 flex w-full max-w-xs items-center justify-center gap-3" aria-hidden="true">
              <span className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, var(--ld-theme-secondary))' }} />
              <span className="text-lg" style={{ color: 'var(--ld-theme-secondary)' }}>✦</span>
              <span className="h-px flex-1" style={{ background: 'linear-gradient(90deg, var(--ld-theme-secondary), transparent)' }} />
            </div>

            <h1
              className="mt-2 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl"
              style={{ color: 'var(--ld-theme-primary)', lineHeight: 1.04 }}
            >
              {content.navCatalogLabel}
            </h1>
            <p
              className="mx-auto mt-4 max-w-2xl text-sm leading-7 sm:text-base"
              style={{ color: 'var(--ld-theme-muted)' }}
            >
              {content.catalogPageDescription}
            </p>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-xs font-extrabold shadow-sm sm:text-sm"
              style={{
                borderColor: 'color-mix(in srgb, var(--ld-theme-secondary) 54%, var(--ld-theme-border))',
                background: 'color-mix(in srgb, var(--ld-theme-surface) 84%, var(--ld-theme-background))',
                color: 'var(--ld-theme-primary)',
              }}
            >
              <span className="text-base" aria-hidden="true">♡</span>
              {content.homeFeaturedBadge}
              <span className="text-base" aria-hidden="true" style={{ color: 'var(--ld-theme-secondary)' }}>✦</span>
            </div>
          </div>
        </section>

        {/* Búsqueda y categorías */}
        <section
          data-ld-section="menu-filters"
          className="mx-auto mb-12 w-full max-w-5xl rounded-[1.7rem] border p-4 shadow-[0_12px_32px_rgba(61,25,36,0.06)] sm:p-6"
          style={{
            borderColor: 'var(--ld-theme-border)',
            background: 'color-mix(in srgb, var(--ld-theme-surface) 94%, white)',
          }}
        >
          <div className="mx-auto max-w-3xl">
            <div className="relative">
              <svg className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2" style={{ color: 'var(--ld-theme-secondary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                placeholder={content.catalogSearchPlaceholder}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label={content.catalogSearchPlaceholder}
                className="w-full rounded-full border py-3.5 pl-12 pr-5 text-sm outline-none transition focus:ring-4 focus:ring-[#F7DDE0]"
                style={{
                  borderColor: 'var(--ld-theme-border)',
                  background: 'var(--ld-theme-background)',
                  color: 'var(--ld-theme-text)',
                }}
              />
            </div>
          </div>

          <div className="ld-category-filters mt-5 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => handleCategoryClick(null)}
              aria-pressed={!selectedCategory}
              className="shrink-0 rounded-full border px-4 py-2.5 text-xs font-bold transition duration-200 hover:-translate-y-0.5 sm:text-sm"
              style={!selectedCategory ? {
                borderColor: 'var(--ld-theme-primary)', background: 'var(--ld-theme-primary)', color: '#FFFFFF', boxShadow: '0 7px 18px color-mix(in srgb, var(--ld-theme-primary) 22%, transparent)',
              } : {
                borderColor: 'var(--ld-theme-border)', background: 'var(--ld-theme-surface)', color: 'var(--ld-theme-muted)',
              }}
            >
              {content.catalogAllLabel}
            </button>
            {availableCategories.map((category) => (
              <button
                type="button"
                key={category.id}
                onClick={() => handleCategoryClick(category.id)}
                aria-pressed={selectedCategory === category.id}
                className="shrink-0 rounded-full border px-4 py-2.5 text-xs font-bold transition duration-200 hover:-translate-y-0.5 sm:text-sm"
                style={selectedCategory === category.id ? {
                  borderColor: 'var(--ld-theme-primary)', background: 'var(--ld-theme-primary)', color: '#FFFFFF', boxShadow: '0 7px 18px color-mix(in srgb, var(--ld-theme-primary) 22%, transparent)',
                } : {
                  borderColor: 'var(--ld-theme-border)', background: 'var(--ld-theme-surface)', color: 'var(--ld-theme-muted)',
                }}
              >
                {formatPublicLabel(category.name)}
              </button>
            ))}
          </div>
        </section>

        {/* Galería de categorías */}
        {showCategoryGrid && (
          <section className="mb-14">
            <div className="mb-7 text-center">
              <p className="ld-readable-eyebrow">
                {content.catalogCategoriesEyebrow}
              </p>
              <div className="mt-2 flex items-center justify-center gap-3" aria-hidden="true">
                <span className="h-px w-10" style={{ background: 'var(--ld-theme-secondary)' }} />
                <span style={{ color: 'var(--ld-theme-accent)' }}>✦</span>
                <span className="h-px w-10" style={{ background: 'var(--ld-theme-secondary)' }} />
              </div>
              <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl" style={{ color: 'var(--ld-theme-text)' }}>
                {content.catalogCategoriesTitle}
              </h2>
              <p className="mx-auto mt-2 max-w-2xl text-sm leading-6" style={{ color: 'var(--ld-theme-muted)' }}>
                {content.catalogCategoriesDescription}
              </p>
              <span className="mt-4 inline-flex items-center rounded-full border px-4 py-1.5 text-xs font-bold" style={{ borderColor: 'var(--ld-theme-border)', background: 'var(--ld-theme-surface)', color: 'var(--ld-theme-primary)' }}>
                {activeCategories.length} {activeCategories.length === 1 ? content.catalogCategoriesTotalSingular : content.catalogCategoriesTotalPlural}
              </span>
            </div>

            {categoriesLoading ? (
              <div className="grid grid-cols-1 justify-center gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="mx-auto w-full max-w-[290px] overflow-hidden rounded-3xl border bg-white shadow-sm" style={{ borderColor: 'var(--ld-theme-border)' }}>
                    <div className="aspect-[5/4] animate-pulse" style={{ background: 'color-mix(in srgb, var(--ld-theme-secondary) 16%, var(--ld-theme-background))' }} />
                    <div className="p-4"><div className="h-4 w-2/3 animate-pulse rounded" style={{ background: 'var(--ld-theme-border)' }} /></div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="ld-category-grid grid w-full justify-center gap-5 sm:gap-6"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 245px), 290px))' }}
              >
                {activeCategories.map((category) => (
                  <button
                    type="button"
                    key={category.id}
                    onClick={() => handleCategoryClick(category.id)}
                    disabled={category._count.menuItems === 0}
                    className="group mx-auto w-full max-w-[290px] overflow-hidden rounded-[1.7rem] border text-left shadow-[0_10px_28px_rgba(50,21,34,0.07)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_22px_44px_rgba(50,21,34,0.13)] focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-70"
                    style={{ borderColor: 'var(--ld-theme-border)', background: 'var(--ld-theme-surface)' }}
                  >
                    <div className="relative aspect-[5/4] overflow-hidden" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--ld-theme-secondary) 24%, var(--ld-theme-background)), color-mix(in srgb, var(--ld-theme-accent) 10%, var(--ld-theme-surface)))' }}>
                      {categoryPreviewImage(category) ? (
                        <img
                          src={categoryPreviewImage(category) || undefined}
                          alt={`Preparación de ${formatPublicLabel(category.name)}`}
                          loading="lazy"
                          className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-6xl" aria-hidden="true">{categoryEmoji(category.name)}</div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#29121D]/75 via-transparent to-transparent opacity-90" />
                      <span className="absolute bottom-3 right-3 rounded-full border border-white/60 px-3 py-1.5 text-[10px] font-black shadow-sm" style={{ background: 'color-mix(in srgb, var(--ld-theme-surface) 94%, transparent)', color: 'var(--ld-theme-primary)' }}>
                        {category._count.menuItems > 0 ? `${category._count.menuItems} ${category._count.menuItems === 1 ? content.catalogCategoryCountSingular : content.catalogCategoryCountPlural}` : content.catalogCategoryEmptyLabel}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 px-5 py-4">
                      <span className="font-black transition" style={{ color: 'var(--ld-theme-text)' }}>{formatPublicLabel(category.name)}</span>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: 'color-mix(in srgb, var(--ld-theme-secondary) 25%, var(--ld-theme-surface))', color: 'var(--ld-theme-primary)' }} aria-hidden="true">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Productos */}
        <section ref={resultsSectionRef} data-ld-section="menu-results" className="scroll-mt-20 pt-1">
          {(selectedCategory || debouncedSearch || activeItems.length > 0) && (
            <div className="mb-8 text-center">
              <p className="ld-readable-eyebrow">
                {content.catalogResultsEyebrow}
              </p>
              <div className="mt-2 flex items-center justify-center gap-3" aria-hidden="true">
                <span className="h-px w-9" style={{ background: 'var(--ld-theme-secondary)' }} />
                <span style={{ color: 'var(--ld-theme-accent)' }}>✦</span>
                <span className="h-px w-9" style={{ background: 'var(--ld-theme-secondary)' }} />
              </div>
              <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl" style={{ color: 'var(--ld-theme-text)' }}>
                {selectedCategoryName ? formatPublicLabel(selectedCategoryName) : (debouncedSearch ? content.catalogSearchResultsTitle : content.catalogProductsTitle)}
              </h2>
              {selectedCategory && (
                <button
                  type="button"
                  onClick={() => handleCategoryClick(null)}
                  className="mt-3 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition hover:-translate-y-0.5"
                  style={{ borderColor: 'var(--ld-theme-border)', background: 'var(--ld-theme-surface)', color: 'var(--ld-theme-primary)' }}
                >
                  <span aria-hidden="true">←</span> {content.catalogShowAllCategoriesLabel}
                </button>
              )}
            </div>
          )}

          {itemsLoading && !showCategoryGrid && (
            <div className="grid grid-cols-1 justify-center gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="mx-auto w-full max-w-[330px] overflow-hidden rounded-3xl border shadow-sm" style={{ borderColor: 'var(--ld-theme-border)', background: 'var(--ld-theme-surface)' }}>
                  <div className="aspect-[5/4] animate-pulse" style={{ background: 'color-mix(in srgb, var(--ld-theme-secondary) 15%, var(--ld-theme-background))' }} />
                  <div className="space-y-3 p-5"><div className="h-4 w-2/3 animate-pulse rounded" style={{ background: 'var(--ld-theme-border)' }} /><div className="h-3 w-full animate-pulse rounded" style={{ background: 'var(--ld-theme-border)' }} /></div>
                </div>
              ))}
            </div>
          )}

          {itemsError && (
            <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
              {itemsError || t('common.error')}
            </div>
          )}

          {!itemsLoading && !itemsError && activeItems.length === 0 && !showCategoryGrid && (
            <div className="mx-auto max-w-xl rounded-[2rem] border border-dashed px-6 py-14 text-center shadow-sm" style={{ borderColor: 'var(--ld-theme-secondary)', background: 'var(--ld-theme-surface)' }}>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-3xl" style={{ background: 'color-mix(in srgb, var(--ld-theme-secondary) 22%, var(--ld-theme-surface))' }} aria-hidden="true">📦</div>
              <h3 className="mt-4 text-lg font-black" style={{ color: 'var(--ld-theme-text)' }}>{content.catalogEmptyTitle}</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6" style={{ color: 'var(--ld-theme-muted)' }}>{content.catalogEmptyDescription}</p>
              <button type="button" onClick={() => { setSearch(''); setDebouncedSearch(''); handleCategoryClick(null); }} className="mt-5 rounded-full px-5 py-3 text-sm font-black text-white shadow-md transition hover:-translate-y-0.5" style={{ background: 'var(--ld-theme-primary)' }}>
                {content.catalogShowAllCategoriesLabel}
              </button>
            </div>
          )}

          {!itemsLoading && !itemsError && activeItems.length > 0 && (
            <>
              <div
                className="ld-menu-product-grid grid w-full justify-center gap-5 sm:gap-6"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 330px))' }}
              >
                {sortedActiveItems.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setSelectedItemId(item.id)}
                    aria-label={`${content.catalogProductDetailsLabel}: ${formatPublicLabel(item.name)}`}
                    className="group mx-auto flex h-full w-full max-w-[330px] flex-col overflow-hidden rounded-[1.7rem] border text-left shadow-[0_12px_32px_rgba(50,21,34,0.07)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_22px_44px_rgba(50,21,34,0.14)] focus:outline-none focus:ring-4"
                    style={{ borderColor: 'var(--ld-theme-border)', background: 'var(--ld-theme-surface)' }}
                  >
                    {(item.images?.[0] || item.image) ? (
                      <div className="relative aspect-[5/4] w-full overflow-hidden" style={{ background: 'color-mix(in srgb, var(--ld-theme-secondary) 18%, var(--ld-theme-background))' }}>
                        <img src={item.images?.[0] || item.image || undefined} alt={formatPublicLabel(item.name)} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#29121D]/45 to-transparent" />
                        <span className="absolute left-4 top-4 rounded-full border border-white/70 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] shadow" style={{ background: 'color-mix(in srgb, var(--ld-theme-surface) 94%, transparent)', color: 'var(--ld-theme-primary)' }}>
                          {content.catalogProductAvailableLabel}
                        </span>
                      </div>
                    ) : (
                      <div className="flex aspect-[5/4] w-full items-center justify-center text-5xl" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--ld-theme-secondary) 22%, var(--ld-theme-background)), color-mix(in srgb, var(--ld-theme-accent) 9%, var(--ld-theme-surface)))' }} aria-hidden="true">{content.catalogProductPlaceholderEmoji}</div>
                    )}
                    <div className="flex flex-1 flex-col p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-base font-black leading-snug transition sm:text-lg" style={{ color: 'var(--ld-theme-text)' }}>{formatPublicLabel(item.name)}</h3>
                        <span className="shrink-0 rounded-full px-3 py-1.5 text-sm font-black" style={{ background: 'color-mix(in srgb, var(--ld-theme-secondary) 23%, var(--ld-theme-surface))', color: 'var(--ld-theme-primary)' }}>
                          {currencyFormatter.format(item.price)}
                        </span>
                      </div>
                      {item.description && <p className="mt-3 line-clamp-3 text-sm leading-6" style={{ color: 'var(--ld-theme-muted)' }}>{item.description}</p>}
                      <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
                        <span className="rounded-full border px-3 py-1.5 text-[10px] font-bold" style={{ borderColor: 'var(--ld-theme-border)', background: 'var(--ld-theme-background)', color: 'var(--ld-theme-muted)' }}>{formatPublicLabel(item.category.name)}</span>
                        {item._count.options > 0 && <span className="rounded-full px-3 py-1.5 text-[10px] font-bold" style={{ background: 'color-mix(in srgb, var(--ld-theme-accent) 10%, var(--ld-theme-surface))', color: 'var(--ld-theme-accent)' }}>{t('menu.options')}</span>}
                      </div>
                      <div className="mt-5 flex items-center justify-between border-t pt-4 text-xs font-black" style={{ borderColor: 'var(--ld-theme-border)', color: 'var(--ld-theme-primary)' }}>
                        <span>{content.catalogProductDetailsLabel}</span>
                        <span className="text-lg transition group-hover:translate-x-1" aria-hidden="true">→</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {pagination && pagination.totalPages > 1 && (
                <div className="mt-10 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((current) => current - 1)}
                    className="rounded-full border px-4 py-2.5 text-sm font-bold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ borderColor: 'var(--ld-theme-border)', background: 'var(--ld-theme-surface)', color: 'var(--ld-theme-muted)' }}
                  >
                    {t('locations.previous')}
                  </button>
                  <span className="rounded-full px-4 py-2 text-sm font-black" style={{ background: 'color-mix(in srgb, var(--ld-theme-secondary) 25%, var(--ld-theme-surface))', color: 'var(--ld-theme-primary)' }}>
                    {pagination.page} / {pagination.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage((current) => current + 1)}
                    className="rounded-full border px-4 py-2.5 text-sm font-bold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ borderColor: 'var(--ld-theme-border)', background: 'var(--ld-theme-surface)', color: 'var(--ld-theme-muted)' }}
                  >
                    {t('locations.next')}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {selectedItemId && <MenuItemModal itemId={selectedItemId} onClose={() => setSelectedItemId(null)} />}
    </main>
  );
}

function formatPublicLabel(value: string): string {
  return value
    .replace(/^\d+[_\-\s]+/, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildItemsUrl(categoryId: string | null, search: string, page: number): string {
  const params = new URLSearchParams();
  if (categoryId) params.set('categoryId', categoryId);
  if (search) params.set('search', search);
  if (page > 1) params.set('page', String(page));
  params.set('limit', '12');
  return `/api/menu/items?${params.toString()}`;
}
