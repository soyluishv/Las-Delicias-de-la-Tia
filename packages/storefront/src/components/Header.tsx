import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCart } from '../context/CartContext.js';
import { useTheme } from '../context/ThemeContext.js';

export default function Header() {
  const { t } = useTranslation();
  const { itemCount, setIsOpen: openCart } = useCart();
  const location = useLocation();
  const { settings } = useTheme();
  const content = settings.storefrontContent;
  const brandName = settings.siteName || 'Las Delicias de la Tía';
  const logo = settings.logo || '/brand/las-delicias-de-la-tia-logo.png';
  const tagline = settings.taglinePrimary || 'Comidas para toda ocasión';
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { to: '/', label: content.navHomeLabel, visible: true },
    { to: '/menu', label: content.navCatalogLabel, visible: true },
    { to: '/events', label: content.navEventsLabel, visible: content.navShowEvents },
    { to: '/gallery', label: content.navGalleryLabel, visible: content.navShowGallery },
  ].filter((link) => link.visible);

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
  const closeMobile = () => setMobileOpen(false);

  const handleNavigationClick = (path: string) => {
    closeMobile();
    const isCurrentPage = path === '/'
      ? location.pathname === '/'
      : location.pathname === path || location.pathname.startsWith(`${path}/`);
    if (isCurrentPage) window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  };

  const CartIcon = () => (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l2.1 10.1a2 2 0 002 1.6h8.8a2 2 0 001.9-1.4L22 7H6M10 20a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z" />
    </svg>
  );

  return (
    <header data-ld-header className="sticky top-0 z-50 border-b border-[#F1DFDA] bg-white/95 shadow-[0_5px_24px_rgba(50,21,34,0.06)] backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[76px] items-center justify-between gap-4">
          <Link to="/" onClick={() => handleNavigationClick('/')} className="group flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-0.5 shadow-sm ring-1 ring-rose-100 transition duration-300 group-hover:-rotate-2 group-hover:scale-[1.04] sm:h-14 sm:w-14">
              <img src={logo} alt={`Logo de ${brandName}`} className="h-full w-full object-contain" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-black leading-tight tracking-tight text-[#321522] sm:text-xl">{brandName}</span>
              <span className="mt-1 hidden text-[10px] font-extrabold tracking-[0.16em] text-[#A71942] sm:block">{tagline.toLocaleUpperCase()}</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegación principal">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => handleNavigationClick(link.to)}
                className={`rounded-full px-4 py-2.5 text-sm font-bold transition-all duration-200 ${
                  isActive(link.to)
                    ? link.to === '/events'
                      ? 'bg-gradient-to-r from-[#A71942] to-[#C52D59] text-white shadow-md shadow-rose-900/15'
                      : 'bg-[#FFF0F1] text-[#A71942] ring-1 ring-rose-100'
                    : 'text-slate-600 hover:bg-[#FFF5F3] hover:text-[#A71942]'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center lg:flex">
            <button
              type="button"
              onClick={() => openCart(true)}
              aria-label={t('nav.openCart')}
              className="relative inline-flex h-11 items-center gap-2 rounded-full border border-[#EEDBD7] bg-white px-4 text-sm font-extrabold text-[#681A35] shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-[#A71942]"
            >
              <CartIcon />
              <span>{content.cartButtonLabel}</span>
              {itemCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#A71942] px-1 text-[10px] font-black text-white">{itemCount > 9 ? '9+' : itemCount}</span>}
            </button>
          </div>

          <div className="flex items-center gap-1 lg:hidden">
            <button
              type="button"
              onClick={() => openCart(true)}
              aria-label={t('nav.openCart')}
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-rose-100 text-[#681A35] transition hover:bg-rose-50"
            >
              <CartIcon />
              {itemCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#A71942] px-1 text-[9px] font-bold text-white">{itemCount > 9 ? '9+' : itemCount}</span>}
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen((open) => !open)}
              aria-label={t('nav.toggleMenu')}
              aria-expanded={mobileOpen}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-rose-100 text-[#681A35] transition hover:bg-rose-50"
            >
              {mobileOpen ? (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" /></svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" /></svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-rose-100 bg-white px-4 pb-5 pt-3 shadow-lg lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1" aria-label="Navegación móvil">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => handleNavigationClick(link.to)}
                className={`rounded-xl px-4 py-3 text-sm font-bold transition ${isActive(link.to) ? (link.to === '/events' ? 'bg-[#A71942] text-white' : 'bg-rose-50 text-[#A71942]') : 'text-slate-700 hover:bg-rose-50 hover:text-[#A71942]'}`}
              >
                {link.label}
              </Link>
            ))}
            <button type="button" onClick={() => { openCart(true); closeMobile(); }} className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#321522] px-4 py-3 text-sm font-extrabold text-white">
              <CartIcon /> {content.cartButtonLabel} {itemCount > 0 ? `(${itemCount})` : ''}
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
