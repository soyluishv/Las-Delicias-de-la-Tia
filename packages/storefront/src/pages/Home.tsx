import { Fragment, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext.js';
import { heroVariants } from '../templates/heroes/index.js';
import { featureVariants } from '../templates/features/index.js';
import { ctaVariants } from '../templates/ctas/index.js';
import type { TemplateId } from '../templates/index.js';
import { useApi } from '../hooks/useApi.js';

interface ShowcaseProduct {
  id: string;
  name: string;
  image?: string | null;
  price: number;
  isActive: boolean;
  trackStock?: boolean;
  stockQty?: number;
  images?: string[];
  category?: { id: string; name: string };
}

interface ShowcaseCategory {
  id: string;
  name: string;
  image?: string | null;
  images?: string[];
  isActive: boolean;
  parentId: string | null;
  _count?: { menuItems?: number };
}

type HomeSectionId = 'hero' | 'catalog' | 'events' | 'features' | 'closing';

const DEFAULT_HOME_SECTION_ORDER: HomeSectionId[] = ['hero', 'catalog', 'events', 'features', 'closing'];

function formatHomeCategoryLabel(value: string): string {
  return value
    .replace(/^\s*\d+[_\-\s]+/, '')
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeHomeSectionOrder(value: string | undefined): HomeSectionId[] {
  const validIds: HomeSectionId[] = DEFAULT_HOME_SECTION_ORDER;
  const requested = (value || '').split(',').map((item) => item.trim()).filter((item): item is HomeSectionId => validIds.includes(item as HomeSectionId));
  const unique = requested.filter((item, index) => requested.indexOf(item) === index);
  return [...unique, ...validIds.filter((item) => !unique.includes(item))];
}

export default function Home() {
  const { t } = useTranslation();
  const { settings } = useTheme();
  const content = settings.storefrontContent;
  const hero = settings.heroSection;
  const features = settings.featuresSection;
  const cta = settings.ctaSection;
  const templateId = (settings.storefrontTemplate || 'classic') as TemplateId;
  const HeroVariant = heroVariants[templateId];
  const FeaturesVariant = featureVariants[templateId];
  const CtaVariant = ctaVariants[templateId];

  const sections: Record<HomeSectionId, JSX.Element | null> = {
    hero: content.homeShowHeroSection ? (HeroVariant ? (
      <Suspense fallback={<div className="h-[34rem] animate-pulse bg-[#FFF4E8]" />}>
        <HeroVariant hero={hero} t={t} />
      </Suspense>
    ) : (
      <ClassicHero hero={hero} t={t} logo={settings.logo} settings={settings} content={content} />
    )) : null,
    catalog: content.homeShowCatalogSection ? <FeaturedCatalog content={content} /> : null,
    events: content.homeShowEventsSection && content.navShowEvents ? <EventsCallout content={content} /> : null,
    features: content.homeShowFeaturesSection ? (FeaturesVariant ? (
      <Suspense fallback={<div className="h-64 animate-pulse bg-[#FFF8F0]" />}>
        <FeaturesVariant features={features} t={t} />
      </Suspense>
    ) : (
      <ClassicFeatures features={features} content={content} />
    )) : null,
    closing: content.homeShowClosingSection ? (CtaVariant ? (
      <Suspense fallback={<div className="h-48 animate-pulse bg-[#321522]" />}>
        <CtaVariant cta={cta} t={t} />
      </Suspense>
    ) : (
      <ClassicCta cta={cta} content={content} />
    )) : null,
  };

  return (
    <div data-ld-page="home" className="ld-home">
      {normalizeHomeSectionOrder(content.homeSectionOrder).map((sectionId) => {
        const section = sections[sectionId];
        return section ? <Fragment key={sectionId}>{section}</Fragment> : null;
      })}
      {readBuilderSections(content.pageBuilderJson).filter((section) => section.visible).map((section) => (
        <BuilderHomeSection key={section.id} section={section} />
      ))}
    </div>
  );
}


type BuilderSectionType = 'announcement' | 'text' | 'imageText' | 'features' | 'cta';
interface BuilderHomeSectionData {
  id: string;
  type: BuilderSectionType;
  visible: boolean;
  eyebrow: string;
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  buttonLabel: string;
  buttonUrl: string;
  feature1Title: string;
  feature1Description: string;
  feature2Title: string;
  feature2Description: string;
  feature3Title: string;
  feature3Description: string;
}

function readBuilderSections(raw: string | undefined): BuilderHomeSectionData[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 10).filter((item): item is BuilderHomeSectionData => Boolean(
      item && typeof item === 'object' && typeof item.id === 'string' &&
      ['announcement', 'text', 'imageText', 'features', 'cta'].includes(item.type) &&
      typeof item.visible === 'boolean'
    )).map((item) => ({
      id: item.id, type: item.type, visible: item.visible,
      eyebrow: typeof item.eyebrow === 'string' ? item.eyebrow : '',
      title: typeof item.title === 'string' ? item.title : '',
      description: typeof item.description === 'string' ? item.description : '',
      imageUrl: typeof item.imageUrl === 'string' && (item.imageUrl.startsWith('/') && !item.imageUrl.startsWith('//') || /^https:\/\//i.test(item.imageUrl)) ? item.imageUrl : '',
      imageAlt: typeof item.imageAlt === 'string' ? item.imageAlt : '',
      buttonLabel: typeof item.buttonLabel === 'string' ? item.buttonLabel : '',
      buttonUrl: typeof item.buttonUrl === 'string' && (item.buttonUrl.startsWith('/') && !item.buttonUrl.startsWith('//') || /^https:\/\//i.test(item.buttonUrl) || /^mailto:/i.test(item.buttonUrl) || /^tel:/i.test(item.buttonUrl) || item.buttonUrl.startsWith('#')) ? item.buttonUrl : '/menu',
      feature1Title: typeof item.feature1Title === 'string' ? item.feature1Title : '',
      feature1Description: typeof item.feature1Description === 'string' ? item.feature1Description : '',
      feature2Title: typeof item.feature2Title === 'string' ? item.feature2Title : '',
      feature2Description: typeof item.feature2Description === 'string' ? item.feature2Description : '',
      feature3Title: typeof item.feature3Title === 'string' ? item.feature3Title : '',
      feature3Description: typeof item.feature3Description === 'string' ? item.feature3Description : '',
    }));
  } catch {
    return [];
  }
}

function BuilderHomeSection({ section }: { section: BuilderHomeSectionData }) {
  const button = section.buttonLabel ? (
    <a href={section.buttonUrl || '/menu'} className="inline-flex items-center justify-center rounded-xl bg-[var(--ld-theme-primary,#74152f)] px-6 py-3 text-sm font-bold text-white shadow transition hover:brightness-110">{section.buttonLabel} <span className="ml-2" aria-hidden="true">→</span></a>
  ) : null;
  const intro = (
    <>
      {section.eyebrow && <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--ld-theme-accent,#b91e4c)]">{section.eyebrow}</p>}
      {section.title && <h2 className="mt-2 text-2xl font-black leading-tight text-[var(--ld-theme-text,#321522)] sm:text-3xl">{section.title}</h2>}
      {section.description && <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[var(--ld-theme-muted,#74666b)] sm:text-base">{section.description}</p>}
    </>
  );

  if (section.type === 'announcement') {
    return <section className="bg-[var(--ld-theme-primary,#74152f)] px-4 py-5 text-center text-white"><div className="mx-auto max-w-7xl">{section.eyebrow && <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">{section.eyebrow}</p>}{section.title && <h2 className="mt-1 text-lg font-black">{section.title}</h2>}{section.description && <p className="mt-1 text-sm text-white/85">{section.description}</p>}</div></section>;
  }

  if (section.type === 'imageText') {
    return <section className="px-4 py-12 sm:px-6 lg:px-8"><div className={`mx-auto grid max-w-7xl items-center gap-8 rounded-[var(--ld-theme-card-radius,1.1rem)] border border-[var(--ld-theme-border,#eadfd8)] bg-[var(--ld-theme-surface,#fffdf9)] p-5 shadow-[var(--ld-theme-shadow-soft,0_12px_34px_rgba(50,21,34,0.07))] ${section.imageUrl ? 'md:grid-cols-2' : ''} md:p-8`}>{section.imageUrl && <img src={section.imageUrl} alt={section.imageAlt} loading="lazy" className="max-h-[430px] w-full rounded-[var(--ld-theme-card-radius,1.1rem)] object-cover" />}<div>{intro}{button && <div className="mt-5">{button}</div>}</div></div></section>;
  }

  if (section.type === 'features') {
    const items = [
      [section.feature1Title, section.feature1Description],
      [section.feature2Title, section.feature2Description],
      [section.feature3Title, section.feature3Description],
    ].filter((item) => item[0] || item[1]);
    return <section className="bg-[var(--ld-theme-background,#fff9f1)] px-4 py-12 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl">{intro}<div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map(([title, description], index) => <article key={`${title}-${index}`} className="rounded-[var(--ld-theme-card-radius,1.1rem)] border border-[var(--ld-theme-border,#eadfd8)] bg-[var(--ld-theme-surface,#fffdf9)] p-6 shadow-[var(--ld-theme-shadow-soft,0_12px_34px_rgba(50,21,34,0.07))]"><h3 className="font-bold text-[var(--ld-theme-text,#321522)]">{title || `Beneficio ${index + 1}`}</h3><p className="mt-2 text-sm leading-6 text-[var(--ld-theme-muted,#74666b)]">{description}</p></article>)}</div></div></section>;
  }

  if (section.type === 'cta') {
    const ctaButton = section.buttonLabel ? <a href={section.buttonUrl || '/menu'} className="inline-flex items-center justify-center rounded-xl bg-[var(--ld-theme-secondary,#e7b75c)] px-6 py-3 text-sm font-bold text-[var(--ld-theme-text,#321522)] shadow transition hover:brightness-105">{section.buttonLabel} <span className="ml-2" aria-hidden="true">→</span></a> : null;
    return <section className="px-4 py-12 sm:px-6 lg:px-8"><div className="mx-auto max-w-5xl rounded-[var(--ld-theme-card-radius,1.1rem)] bg-[var(--ld-theme-primary,#74152f)] px-6 py-10 text-center text-white shadow-[var(--ld-theme-shadow-card,0_14px_34px_rgba(50,21,34,0.09))] sm:px-10">{section.eyebrow && <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">{section.eyebrow}</p>}{section.title && <h2 className="mt-2 text-2xl font-black sm:text-3xl">{section.title}</h2>}{section.description && <p className="mx-auto mt-3 max-w-3xl whitespace-pre-line text-sm leading-7 text-white/85">{section.description}</p>}{ctaButton && <div className="mt-6">{ctaButton}</div>}</div></section>;
  }

  return <section className="px-4 py-12 sm:px-6 lg:px-8"><div className="mx-auto max-w-4xl rounded-[var(--ld-theme-card-radius,1.1rem)] border border-[var(--ld-theme-border,#eadfd8)] bg-[var(--ld-theme-surface,#fffdf9)] p-6 shadow-[var(--ld-theme-shadow-soft,0_12px_34px_rgba(50,21,34,0.07))] sm:p-8">{intro}{button && <div className="mt-5">{button}</div>}</div></section>;
}

function ClassicHero({ hero, t, logo, settings, content }: {
  hero: { title?: string; subtitle?: string; ctaPrimaryText?: string; ctaPrimaryLink?: string; backgroundImage?: string } | null;
  t: (key: string) => string;
  logo: string | null;
  settings: ReturnType<typeof useTheme>['settings'];
  content: ReturnType<typeof useTheme>['settings']['storefrontContent'];
}) {
  const { data } = useApi<ShowcaseProduct[]>('/api/menu/items?limit=8');
  const photos = (data || []).filter((item) => item.isActive && item.image && (!item.trackStock || (item.stockQty ?? 0) > 0)).slice(0, 3);
  const configuredPhotos = settings.homepageFeaturedImages?.length === 3
    ? settings.homepageFeaturedImages
    : [];
  const mainPhoto = configuredPhotos[0] || photos[0]?.image;
  const secondPhoto = configuredPhotos[1] || photos[1]?.image;
  const thirdPhoto = configuredPhotos[2] || photos[2]?.image;

  return (
    <section data-ld-section="hero" className="relative isolate overflow-hidden bg-[radial-gradient(circle_at_82%_25%,rgba(231,183,92,0.22),transparent_25%),linear-gradient(115deg,#FFF8EF_0%,#FFFEFC_48%,#FBE8E6_100%)]">
      <div className="pointer-events-none absolute -left-28 top-20 h-80 w-80 rounded-full bg-[#F2C9B9]/35 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 -top-28 h-96 w-96 rounded-full bg-[#E7B75C]/20 blur-3xl" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16 lg:px-8 lg:py-20">
        <div className="relative z-10 max-w-2xl text-center lg:text-left">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#E7B75C]/50 bg-white/85 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#7A1734] shadow-sm">
            <span className="h-2 w-2 rounded-full bg-[#BD1748] shadow-[0_0_0_4px_rgba(189,23,72,0.12)]" />
            {content.homeHeroBadge}
          </div>
          <h1 className="text-4xl font-black leading-[1.04] tracking-[-0.045em] text-[#74152F] sm:text-5xl lg:text-[4.25rem]">
            {content.homeHeroTitle}
          </h1>
          <p className="mt-6 text-lg font-extrabold leading-snug text-[#8B2940] sm:text-xl">
            {content.homeHeroSubtitle}
          </p>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[#5D5260] sm:text-lg lg:mx-0">
            {content.homeHeroDescription}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
            <Link to={hero?.ctaPrimaryLink || '/menu'} className="group inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#8F173A] via-[#BD1748] to-[#D63863] px-7 py-4 text-sm font-black text-white shadow-[0_14px_28px_rgba(143,23,58,0.24)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(143,23,58,0.3)]">
              {content.homeHeroPrimaryLabel || hero?.ctaPrimaryText || t('home.viewMenu')} <span className="text-lg transition group-hover:translate-x-1" aria-hidden="true">→</span>
            </Link>
            {content.homeShowHeroEventsButton && content.navShowEvents && (
              <Link to="/events" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-[#A71942] bg-white/90 px-7 py-4 text-sm font-black text-[#8F173A] shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#E7B75C] hover:bg-[#FFF8E9]">
                {content.homeHeroEventsLabel} <span className="text-[#B68635]" aria-hidden="true">✦</span>
              </Link>
            )}
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-bold text-[#725A5D] lg:justify-start">
            <span className="inline-flex items-center gap-2"><span className="text-[#B68635]">✦</span> {content.homeBenefit1}</span>
            <span className="inline-flex items-center gap-2"><span className="text-[#B68635]">✦</span> {content.homeBenefit2}</span>
            <span className="inline-flex items-center gap-2"><span className="text-[#B68635]">✦</span> {content.homeBenefit3}</span>
          </div>
        </div>

        <div className="relative mx-auto h-[420px] w-full max-w-[570px] sm:h-[490px] lg:h-[520px]">
          <div className="absolute -inset-7 rounded-[3rem] bg-gradient-to-br from-[#E7B75C]/35 via-[#E7B75C]/10 to-[#BD1748]/20 blur-2xl" />
          <div className="ld-home-hero-gallery relative grid h-full min-h-0 grid-cols-[1.18fr_0.95fr] gap-3 overflow-hidden rounded-[2.2rem] border border-white/80 bg-white/70 p-3 shadow-[0_28px_80px_rgba(72,25,39,0.16)] backdrop-blur-sm sm:gap-4 sm:p-4">
            <div className="relative h-full min-h-0 overflow-hidden rounded-[1.7rem] bg-gradient-to-br from-[#7A1734] via-[#BD1748] to-[#E7B75C]">
              {mainPhoto ? <img src={mainPhoto} alt={`Producto destacado de ${settings.siteName}`} className="absolute inset-0 h-full w-full object-cover" /> : <img src={logo || '/brand/las-delicias-de-la-tia-logo.png'} alt={`Logotipo de ${settings.siteName}`} className="absolute inset-0 h-full w-full bg-white object-contain p-4" />}
              <div className="absolute inset-0 bg-gradient-to-t from-[#29121D]/75 via-transparent to-[#29121D]/10" />
              <div className="ld-home-hero-photo-copy absolute bottom-4 left-4 right-4 text-white sm:bottom-6 sm:left-6">
                <span className="ld-home-hero-photo-badge inline-flex rounded-full border border-white/35 bg-white/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] backdrop-blur">{content.homeHeroPhotoBadge}</span>
                <p className="ld-home-hero-photo-title mt-2 text-xl font-black leading-tight sm:text-2xl">{content.homeHeroPhotoTitle}</p>
              </div>
            </div>
            <div className="flex h-full min-h-0 min-w-0 flex-col gap-3 sm:gap-4">
              <div className="relative min-h-0 flex-1 overflow-hidden rounded-[1.5rem] bg-[#F8E9D6]">
                {secondPhoto ? <img src={secondPhoto} alt={`Otra imagen de ${settings.siteName}`} className="absolute inset-0 h-full w-full object-cover" /> : <img src={logo || '/brand/las-delicias-de-la-tia-logo.png'} alt="Las Delicias de la Tía" className="absolute inset-0 h-full w-full bg-white object-contain p-4" />}
                <span className="ld-home-hero-side-caption absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1 text-[10px] font-extrabold text-[#74152F] shadow">{content.homeHeroSideCaption1}</span>
              </div>
              <div className="relative min-h-0 flex-1 overflow-hidden rounded-[1.5rem] bg-[#F8E9D6]">
                {thirdPhoto ? <img src={thirdPhoto} alt={`Producto de ${settings.siteName}`} className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#FFF6E8] to-[#F4D9D1] p-4 text-center"><span className="text-4xl text-[#A77B36]">✦</span></div>}
                <span className="ld-home-hero-side-caption absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1 text-[10px] font-extrabold text-[#74152F] shadow">{content.homeHeroSideCaption2}</span>
              </div>
              <div className="relative flex shrink-0 items-center gap-2 rounded-[1.4rem] border border-[#E7B75C]/50 bg-[#FFF9ED] p-2.5 shadow-sm sm:gap-3 sm:p-3">
                <img src={logo || '/brand/las-delicias-de-la-tia-logo.png'} alt={`Logotipo de ${settings.siteName}`} className="h-9 w-9 shrink-0 rounded-xl bg-white object-contain p-1 shadow-sm sm:h-11 sm:w-11" />
                <div className="ld-home-hero-logo-copy min-w-0 flex-1 pr-1">
                  <p className="text-[11px] font-black leading-tight text-[#74152F] sm:text-xs">{content.homeHeroLogoTitle}</p>
                  <p className="mt-1 text-[9px] leading-[1.3] text-[#755E5B] sm:text-[10px] sm:leading-[1.35]">{content.homeHeroLogoDescription}</p>
                </div>
                <span className="absolute right-2 top-2 text-sm text-[#B68635]" aria-hidden="true">✦</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturedCatalog({ content }: { content: ReturnType<typeof useTheme>['settings']['storefrontContent'] }) {
  const { data: categories } = useApi<ShowcaseCategory[]>('/api/menu/categories');
  const { data: products, isLoading } = useApi<ShowcaseProduct[]>('/api/menu/items?limit=12');
  const availableProducts = (products || []).filter((product) => product.isActive && (!product.trackStock || (product.stockQty ?? 0) > 0));
  const categoryList = (categories || []).filter((category) => category.isActive && !category.parentId && (category._count?.menuItems ?? 0) > 0).slice(0, 4);
  const productList = availableProducts.slice(0, 4);

  const categoryPreviewImage = (category: ShowcaseCategory) => {
    const representative = availableProducts.find((product) => product.category?.id === category.id && (product.images?.[0] || product.image));
    return representative?.images?.[0] || representative?.image || category.images?.find((image) => image && !image.includes('/category-images/')) || null;
  };
  const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

  return (
    <section data-ld-section="catalog" className="relative overflow-hidden bg-[#FFF9F1] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
      <div className="pointer-events-none absolute -left-28 top-12 h-80 w-80 rounded-full bg-[#F4D9D1]/60 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-[#E7B75C]/15 blur-3xl" />
      <div className="relative mx-auto max-w-7xl">
        <div className="mb-9 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#E7B75C]/60 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#8F173A] shadow-sm"><span className="text-[#B68635]">✦</span> {content.homeCatalogEyebrow}</span>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-[#321522] sm:text-4xl lg:text-5xl">{content.homeCatalogTitle}</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#6C5B5C] sm:text-base">{content.homeCatalogDescription}</p>
          </div>
          <Link to="/menu" className="inline-flex w-fit items-center justify-center gap-2 rounded-xl bg-[#74152F] px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-[#74152F]/15 transition hover:-translate-y-1 hover:bg-[#9C1B42]">{content.homeCatalogButtonLabel} <span aria-hidden="true">→</span></Link>
        </div>

        {categoryList.length > 0 && (
          <div className="ld-home-category-grid mb-11 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {categoryList.map((category) => (
              <Link key={category.id} to={`/menu?category=${encodeURIComponent(category.id)}`} className="group relative min-h-[125px] overflow-hidden rounded-2xl border border-white bg-[#EAD9C6] shadow-[0_10px_25px_rgba(50,21,34,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-xl sm:min-h-[155px]">
                {categoryPreviewImage(category) ? (
                  <img src={categoryPreviewImage(category) || undefined} alt={`Preparación de ${formatHomeCategoryLabel(category.name)}`} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-110" />
                ) : (
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(231,183,92,0.42),transparent_42%),linear-gradient(135deg,#7A1734,#BD1748_58%,#E7B75C)]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#29121D]/80 via-[#29121D]/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-3 sm:p-4"><span className="ld-home-category-label text-sm font-black leading-tight text-white sm:text-base">{formatHomeCategoryLabel(category.name)}</span><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E7B75C] text-[#321522] transition group-hover:translate-x-1">→</span></div>
              </Link>
            ))}
          </div>
        )}

        <div className="mb-5 flex items-center justify-between gap-4">
          <div><p className="ld-readable-eyebrow">{content.homeFeaturedEyebrow}</p><h3 className="mt-1 text-2xl font-black text-[#321522] sm:text-3xl">{content.homeFeaturedTitle}</h3></div>
          <span className="hidden rounded-full border border-[#E7B75C]/50 bg-white px-4 py-2 text-xs font-bold text-[#8F173A] sm:inline-flex">{content.homeFeaturedBadge}</span>
        </div>

        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-80 animate-pulse rounded-[1.6rem] bg-white shadow-sm" />)}</div>
        ) : productList.length > 0 ? (
          <div className="ld-home-product-grid grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {productList.map((product, index) => (
              <Link key={product.id} to={`/menu?search=${encodeURIComponent(product.name)}`} className="group relative overflow-hidden rounded-[1.7rem] border border-[#EDE0D5] bg-white shadow-[0_10px_30px_rgba(50,21,34,0.07)] transition duration-300 hover:-translate-y-2 hover:border-[#E7B75C] hover:shadow-[0_24px_48px_rgba(50,21,34,0.14)]">
                <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-[#F6E5D5] to-[#F7E4E6]">
                  {(product.images?.[0] || product.image) ? <img src={product.images?.[0] || product.image || undefined} alt={product.name} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-110" /> : <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_25%_20%,rgba(231,183,92,0.3),transparent_42%),linear-gradient(135deg,#FFF1E5,#F7DDE0)] text-6xl" aria-hidden="true">{content.catalogProductPlaceholderEmoji}</div>}
                  <span className="absolute left-3 top-3 rounded-full border border-white/70 bg-[#FFF9ED]/95 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#74152F] shadow">{content.homeProductCardBadge}</span>
                  <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#29121D]/25 to-transparent" />
                </div>
                <div className="p-4 sm:p-5">
                  <h4 className="line-clamp-1 text-base font-black text-[#321522] transition group-hover:text-[#BD1748]">{product.name}</h4>
                  <div className="mt-4 flex items-center justify-between border-t border-[#F0E5DC] pt-3"><span className="text-base font-black text-[#8F173A]">{money.format(product.price)}</span><span className="inline-flex items-center gap-1 rounded-full bg-[#FFF4E4] px-3 py-2 text-[10px] font-black text-[#754D20] transition group-hover:bg-[#E7B75C] group-hover:text-[#321522]">{content.homeProductCardButton} <span aria-hidden="true">→</span></span></div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-[1.7rem] border border-dashed border-[#E7B75C] bg-white px-6 py-12 text-center"><p className="text-lg font-black text-[#321522]">{content.homeCatalogEmptyTitle}</p><p className="mt-2 text-sm text-[#74666A]">{content.homeCatalogEmptyDescription}</p><Link to="/menu" className="mt-5 inline-flex rounded-xl bg-[#74152F] px-5 py-3 text-sm font-black text-white">{content.homeCatalogButtonLabel}</Link></div>
        )}
      </div>
    </section>
  );
}

function EventsCallout({ content }: { content: ReturnType<typeof useTheme>['settings']['storefrontContent'] }) {
  return (
    <section data-ld-section="events" className="relative isolate overflow-hidden bg-[#321522] px-4 py-14 text-white sm:px-6 lg:px-8 lg:py-16">
      <div className="pointer-events-none absolute -right-16 -top-24 h-80 w-80 rounded-full bg-[#BD1748]/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 left-1/4 h-80 w-80 rounded-full bg-[#E7B75C]/15 blur-3xl" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-8 rounded-[2rem] border border-[#E7B75C]/25 bg-white/[0.04] p-6 sm:p-8 lg:grid-cols-[1.4fr_0.8fr] lg:p-10">
        <div>
          <span className="inline-flex rounded-full border border-[#E7B75C]/50 bg-[#E7B75C]/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#F1D18E]">{content.homeEventsBadge}</span>
          <h2 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">{content.homeEventsTitle}</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-rose-100/80 sm:text-base">{content.homeEventsDescription}</p>
          <p className="mt-4 text-xs font-bold text-[#EBCB91]">{content.homeEventsServiceNote}</p>
        </div>
        <div className="flex flex-col items-stretch gap-3 lg:items-end">
          <Link to="/events" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#E7B75C] to-[#F4D99B] px-7 py-4 text-sm font-black text-[#321522] shadow-xl shadow-black/20 transition hover:-translate-y-1 hover:brightness-105">{content.homeEventsPrimaryLabel} <span aria-hidden="true">→</span></Link>
          <Link to="/menu" className="inline-flex items-center justify-center rounded-xl border border-white/25 px-6 py-3 text-sm font-bold text-white transition hover:border-[#E7B75C] hover:bg-white/10">{content.homeEventsSecondaryLabel}</Link>
        </div>
      </div>
    </section>
  );
}

interface FeatureItem { icon: string; title: string; description: string; }
function ClassicFeatures({ features, content }: { features: FeatureItem[] | null; content: ReturnType<typeof useTheme>['settings']['storefrontContent'] }) {
  const items = features && features.length > 0 ? features : [
    { icon: '✦', title: content.homeFeature1Title, description: content.homeFeature1Description },
    { icon: '♡', title: content.homeFeature2Title, description: content.homeFeature2Description },
    { icon: '✧', title: content.homeFeature3Title, description: content.homeFeature3Description },
  ];
  return (
    <section data-ld-section="features" className="bg-[#FFFDF9] px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
      <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
        {items.slice(0, 3).map((item, index) => (
          <div key={`${item.title}-${index}`} className="group rounded-[1.6rem] border border-[#EFE2D5] bg-white p-6 text-center shadow-[0_8px_25px_rgba(50,21,34,0.05)] transition duration-300 hover:-translate-y-1 hover:border-[#E7B75C] hover:shadow-lg sm:p-8">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FFF0D1] to-[#F7DDE0] text-2xl font-black text-[#8F173A] shadow-inner">{item.icon || '✦'}</span>
            <h3 className="mt-5 text-lg font-black text-[#321522]">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[#716269]">{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

interface CtaSection { title?: string; description?: string; buttonText?: string; buttonLink?: string; }
function ClassicCta({ cta, content }: { cta: CtaSection | null; content: ReturnType<typeof useTheme>['settings']['storefrontContent'] }) {
  return (
    <section className="relative overflow-hidden bg-[linear-gradient(120deg,#FFF5E8,#FBE7E8)] px-4 py-14 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#E7B75C]/20 blur-3xl" />
      <div className="relative mx-auto max-w-4xl text-center">
        <span className="ld-readable-eyebrow">{content.homeClosingEyebrow}</span>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-[#74152F] sm:text-4xl">{content.homeClosingTitle || cta?.title || '¿Se te antojó algo rico?'}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#6C5B5C] sm:text-base">{content.homeClosingDescription || cta?.description || 'Explora nuestro catálogo.'}</p>
        <Link to={cta?.buttonLink || '/menu'} className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-[#74152F] px-7 py-4 text-sm font-black text-white shadow-lg shadow-[#74152F]/20 transition hover:-translate-y-1 hover:bg-[#A71942]">{content.homeClosingButtonLabel || cta?.buttonText || 'Ver menú'} <span aria-hidden="true">→</span></Link>
      </div>
    </section>
  );
}
