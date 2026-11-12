import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext.js';

const currentYear = new Date().getFullYear();

type PublicSocialLink = {
  id: string;
  label: string;
  url: string;
  sortOrder?: number;
};

function SocialMark({ id, label }: { id: string; label: string }) {
  if (id === 'facebook') {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
        <path fill="currentColor" d="M13.55 21v-8.2h2.76l.41-3.2h-3.17V7.56c0-.93.26-1.56 1.59-1.56h1.7V3.14c-.3-.04-1.34-.14-2.55-.14-2.52 0-4.25 1.54-4.25 4.36V9.6H7.18v3.2h2.86V21h3.51Z" />
      </svg>
    );
  }

  if (id === 'instagram') {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
        <rect x="3.15" y="3.15" width="17.7" height="17.7" rx="5.1" fill="none" stroke="currentColor" strokeWidth="2.15" />
        <circle cx="12" cy="12" r="4.05" fill="none" stroke="currentColor" strokeWidth="2.05" />
        <circle cx="17.75" cy="6.35" r="1.35" fill="currentColor" />
      </svg>
    );
  }

  if (id === 'tiktok') {
    const notePath = 'M19.59 6.69a4.83 4.83 0 0 1-3.77-4.24V2h-3.61v13.67a2.89 2.89 0 1 1-2.88-3.06c.3 0 .6.03.88.09V9.02a6.48 6.48 0 1 0 5.61 6.42V8.49a8.43 8.43 0 0 0 4.93 1.58V6.5a4.84 4.84 0 0 1-1.16.19Z';
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
        <path d={notePath} fill="#25F4EE" transform="translate(-1.05 0.25)" />
        <path d={notePath} fill="#FE2C55" transform="translate(0.95 -0.15)" />
        <path d={notePath} fill="#FFFFFF" />
      </svg>
    );
  }

  if (id === 'website') {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3.5 9h17M3.5 15h17M12 3c2.15 2.35 3.2 5.35 3.2 9s-1.05 6.65-3.2 9c-2.15-2.35-3.2-5.35-3.2-9S9.85 5.35 12 3Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3h7v7M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

function socialIconClasses(id: string) {
  if (id === 'facebook') return 'bg-[#1877F2] text-white shadow-[0_5px_14px_rgba(24,119,242,0.24)]';
  if (id === 'instagram') return 'bg-gradient-to-tr from-[#FEDA75] via-[#D62976] to-[#4F5BD5] text-white shadow-[0_5px_14px_rgba(214,41,118,0.22)]';
  if (id === 'tiktok') return 'bg-[#080808] text-white shadow-[0_5px_14px_rgba(0,0,0,0.24)]';
  if (id === 'website') return 'bg-[#E2B66C] text-[#351421] shadow-[0_5px_14px_rgba(226,182,108,0.2)]';
  return 'bg-[#F3E3D0] text-[#74152F] shadow-[0_5px_14px_rgba(0,0,0,0.12)]';
}

function getLinkHint(id: string) {
  if (id === 'website') return 'Visítanos';
  if (id === 'facebook' || id === 'instagram' || id === 'tiktok') return 'Síguenos';
  return 'Abrir enlace';
}

export default function Footer() {
  const location = useLocation();
  const handleFooterNavigationClick = (path: string) => {
    const isCurrentPage = path === '/'
      ? location.pathname === '/'
      : location.pathname === path || location.pathname.startsWith(`${path}/`);
    if (isCurrentPage) window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  };

  const { settings } = useTheme();
  const content = settings.storefrontContent;
  const brandName = settings.siteName || 'Las Delicias de la Tía';
  const logo = settings.logo || '/brand/las-delicias-de-la-tia-logo.png';
  const phone = settings.contactPhone || '301 468 4302';
  const whatsappRaw = (settings.contactWhatsapp || phone).replace(/\D/g, '');
  const whatsappNumber = whatsappRaw.length === 10 ? `57${whatsappRaw}` : whatsappRaw;
  const whatsappMessage = `Hola, quiero información sobre ${brandName}.`;
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;
  const [socialLinks, setSocialLinks] = useState<PublicSocialLink[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSocialLinks() {
      try {
        const response = await fetch('/api/social-links', {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (!response.ok) return;
        const result = await response.json();
        if (!result.success || !Array.isArray(result.data)) return;
        const safeLinks = result.data.filter((link: PublicSocialLink) => {
          if (!link || typeof link.label !== 'string' || typeof link.url !== 'string') return false;
          try {
            const url = new URL(link.url);
            return url.protocol === 'https:' && Boolean(url.hostname);
          } catch {
            return false;
          }
        });
        setSocialLinks(safeLinks);
      } catch {
        // Keep the footer usable if social links are not configured yet.
      }
    }

    void loadSocialLinks();
    return () => controller.abort();
  }, []);

  return (
    <>
      <footer data-ld-footer className="relative overflow-hidden bg-[#26121D] text-rose-50">
      <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[#A71942]/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 left-0 h-72 w-72 rounded-full bg-[#D88A9B]/10 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 pb-7 pt-12 sm:px-6 lg:px-8 lg:pt-16">
        <div className="mb-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.25fr_0.8fr_1fr] lg:gap-14">
          <div>
            <Link to="/" onClick={() => handleFooterNavigationClick('/')} className="mb-5 inline-flex items-center gap-4">
              <span className="flex h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-2xl border border-white/70 bg-white p-1 shadow-xl shadow-black/20">
                <img src={logo} alt={`Logo de ${brandName}`} className="h-full w-full object-contain" />
              </span>
              <span>
                <span className="block text-xl font-black leading-tight text-white">{brandName}</span>
                <span className="mt-1 block text-sm font-semibold text-[#F4B9C3]">{settings.taglinePrimary || 'Comidas para toda ocasión'}</span>
              </span>
            </Link>
            <p className="max-w-sm text-sm leading-7 text-rose-100/65">
              {content.footerBusinessDescription}
            </p>

          </div>

          <div>
                          <h3 className="mb-5 text-base font-extrabold tracking-wide text-white">{content.footerNavigationTitle}</h3>
            <ul className="space-y-3.5 text-sm text-rose-100/70">
              <li><Link to="/" onClick={() => handleFooterNavigationClick('/')} className="transition hover:pl-1 hover:text-white">{content.navHomeLabel}</Link></li>
              <li><Link to="/menu" onClick={() => handleFooterNavigationClick('/menu')} className="transition hover:pl-1 hover:text-white">{content.navCatalogLabel}</Link></li>
              {content.navShowGallery && <li><Link to="/gallery" onClick={() => handleFooterNavigationClick('/gallery')} className="transition hover:pl-1 hover:text-white">{content.navGalleryLabel}</Link></li>}
              {content.navShowEvents && <li><Link to="/events" onClick={() => handleFooterNavigationClick('/events')} className="transition hover:pl-1 hover:text-white">{content.navEventsLabel}</Link></li>}
            </ul>
          </div>

          <div>
                          <h3 className="mb-3 text-base font-extrabold tracking-wide text-white">{content.footerContactTitle}</h3>
            <p className="mb-5 max-w-sm text-sm leading-6 text-rose-100/65">
              {content.footerContactDescription}
            </p>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#A71942] to-[#C52D59] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-black/20 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.52 3.48A11.82 11.82 0 0012.08 0C5.53 0 .2 5.32.2 11.87c0 2.1.55 4.15 1.6 5.96L.1 24l6.34-1.66a11.9 11.9 0 005.64 1.43h.01c6.55 0 11.88-5.33 11.88-11.88 0-3.17-1.24-6.15-3.45-8.4zM12.09 21.75a9.9 9.9 0 01-5.04-1.38l-.36-.21-3.76.99 1-3.67-.24-.38a9.85 9.85 0 01-1.51-5.23c0-5.45 4.44-9.88 9.9-9.88a9.82 9.82 0 017 2.9 9.82 9.82 0 012.9 7c0 5.46-4.44 9.9-9.89 9.9zm5.43-7.41c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.08-.79.38-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.5 1.69.64.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.08-.13-.27-.2-.57-.35z" /></svg>
              {content.footerWhatsappButtonLabel}
            </a>
            {content.footerShowEventsButton && content.navShowEvents && (
              <Link to="/events" onClick={() => handleFooterNavigationClick('/events')} className="mt-3 inline-flex items-center rounded-xl border border-[#F4B9C3]/40 px-4 py-3 text-sm font-bold text-[#F4B9C3] transition hover:border-white hover:bg-white/10 hover:text-white">
                {content.footerEventsButtonLabel} →
              </Link>
            )}
            <p className="mt-4 text-sm font-semibold tracking-wide text-white">{phone}</p>
          </div>
        </div>

        {socialLinks.length > 0 && (
          <section aria-labelledby="footer-social-title" className="mb-10 overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.075] via-white/[0.035] to-[#A71942]/[0.12] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.12)] sm:p-7">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
              <div>
                <span className="inline-flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.24em] text-[#E5B66A]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#E5B66A]" /> {content.footerSocialEyebrow}
                </span>
                <h3 id="footer-social-title" className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl">{content.footerSocialTitle}</h3>
              </div>
              <p className="max-w-md text-sm leading-6 text-rose-100/65 sm:text-right">
                {content.footerSocialDescription}
              </p>
            </div>

            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-6">
              {socialLinks.map((link) => (
                <li key={link.id} className="min-w-0">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Abrir ${link.label} en una nueva pestaña`}
                    className="group flex min-h-[68px] min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-[#321D29]/90 px-2.5 py-2.5 transition-all duration-200 hover:-translate-y-1 hover:border-white/25 hover:bg-[#3A2230] hover:shadow-xl hover:shadow-black/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5B66A] sm:min-h-[72px] sm:gap-3 sm:px-3 sm:py-3"
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] transition-transform duration-200 group-hover:scale-105 sm:h-11 sm:w-11 sm:rounded-[14px] ${socialIconClasses(link.id)}`}>
                      <SocialMark id={link.id} label={link.label} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[11px] font-extrabold leading-tight tracking-tight text-white sm:text-[13px] sm:leading-snug ${['facebook', 'instagram', 'tiktok'].includes(link.id) ? 'whitespace-nowrap' : 'break-words'}`}>{link.label}</span>
                      <span className="mt-1 block text-[10px] font-medium text-rose-100/55">{getLinkHint(link.id)}</span>
                    </span>
                    <svg className="h-3 w-3 shrink-0 text-rose-100/35 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#E5B66A] sm:h-3.5 sm:w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M5 3h8v8M13 3 3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-col gap-4 border-t border-white/10 pt-6 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <p className="text-xs text-rose-100/55">© {currentYear} {brandName}. Todos los derechos reservados.</p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 text-xs text-rose-100/60">
            <Link to="/privacy-policy" className="transition hover:text-white">Política de privacidad</Link>
            <button type="button" onClick={() => window.dispatchEvent(new Event('open-cookie-settings'))} className="transition hover:text-white">Preferencias de cookies</button>
          </div>
        </div>
      </div>
    </footer>
      <a
        data-ld-whatsapp-float
        className="ld-whatsapp-float"
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Escribir por WhatsApp"
        title="Escribenos por WhatsApp"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path fill="currentColor" d="M20.52 3.48A11.82 11.82 0 0012.08 0C5.53 0 .2 5.32.2 11.87c0 2.1.55 4.15 1.6 5.96L.1 24l6.34-1.66a11.9 11.9 0 005.64 1.43h.01c6.55 0 11.88-5.33 11.88-11.88 0-3.17-1.24-6.15-3.45-8.4zM12.09 21.75a9.9 9.9 0 01-5.04-1.38l-.36-.21-3.76.99 1-3.67-.24-.38a9.85 9.85 0 01-1.51-5.23c0-5.45 4.44-9.88 9.9-9.88a9.82 9.82 0 017 2.9 9.82 9.82 0 012.9 7c0 5.46-4.44 9.9-9.89 9.9zm5.43-7.41c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.08-.79.38-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.5 1.69.64.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.08-.13-.27-.2-.57-.35z" />
        </svg>
      </a>
    </>
  );
}
