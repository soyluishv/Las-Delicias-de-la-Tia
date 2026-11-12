import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DEFAULT_STOREFRONT_CONTENT, type StorefrontContent } from './storefrontContent.js';

interface HeroSection {
  title?: string;
  subtitle?: string;
  ctaPrimaryText?: string;
  ctaPrimaryLink?: string;
  ctaSecondaryText?: string;
  ctaSecondaryLink?: string;
  backgroundImage?: string;
}

interface FeatureItem {
  icon: string;
  title: string;
  description: string;
}

interface CtaSection {
  title?: string;
  description?: string;
  buttonText?: string;
  buttonLink?: string;
}

export interface SiteSettings {
  id: string;
  siteName: string;
  siteTitle: string;
  favicon: string | null;
  logo: string | null;
  colorPrimary: string;
  colorSecondary: string;
  darkMode: 'light' | 'dark' | 'system';
  storefrontTemplate: string;
  heroSection: HeroSection | null;
  featuresSection: FeatureItem[] | null;
  ctaSection: CtaSection | null;
  homepageFeaturedImages: string[];
  taglinePrimary: string;
  taglineSecondary: string;
  contactPhone: string;
  contactWhatsapp: string;
  storefrontContent: StorefrontContent;
}

interface ThemeContextType {
  settings: SiteSettings;
  isDark: boolean;
}

const defaultSettings: SiteSettings = {
  id: 'default',
  siteName: 'Las Delicias de la Tía',
  siteTitle: 'Las Delicias de la Tía | Comidas para toda ocasión',
  favicon: null,
  logo: null,
  colorPrimary: '#C51E43',
  colorSecondary: '#FFF3E7',
  darkMode: 'light',
  storefrontTemplate: 'classic',
  heroSection: null,
  featuresSection: null,
  ctaSection: null,
  homepageFeaturedImages: [],
  taglinePrimary: 'Comidas para toda ocasión',
  taglineSecondary: 'Para cada antojo, una experiencia',
  contactPhone: '301 468 4302',
  contactWhatsapp: '3014684302',
  storefrontContent: DEFAULT_STOREFRONT_CONTENT,
};

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

const DEFAULT_DESIGN_TOKENS: DesignTokens = {
  // Identidad visual original protegida de Las Delicias de la Tía.
  primary: '#C51E43', secondary: '#FFF3E7', accent: '#B91F4C',
  background: '#FFF9F1', surface: '#FFFDF9', text: '#321522',
  muted: '#74666B', border: '#EADFD8', fontFamily: 'inter',
  cardRadius: 'comfortable', contentWidth: 'wide', shadow: 'soft',
};

function readDesignTokens(raw: string | undefined): DesignTokens {
  if (!raw) return DEFAULT_DESIGN_TOKENS;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_DESIGN_TOKENS;
    const candidate = value as Record<string, unknown>;
    const colors = ['primary', 'secondary', 'accent', 'background', 'surface', 'text', 'muted', 'border'] as const;
    const validColors = colors.every((key) => typeof candidate[key] === 'string' && /^#[0-9a-fA-F]{6}$/.test(candidate[key] as string));
    const validFont = ['inter', 'system', 'georgia'].includes(String(candidate.fontFamily));
    const validRadius = ['compact', 'comfortable', 'rounded'].includes(String(candidate.cardRadius));
    const validWidth = ['standard', 'wide', 'extra-wide'].includes(String(candidate.contentWidth));
    const validShadow = ['none', 'soft', 'elevated'].includes(String(candidate.shadow));
    if (!validColors || !validFont || !validRadius || !validWidth || !validShadow) return DEFAULT_DESIGN_TOKENS;
    return candidate as DesignTokens;
  } catch {
    return DEFAULT_DESIGN_TOKENS;
  }
}

function applyDesignTokens(tokens: DesignTokens) {
  const root = document.documentElement;
  applyColorVars('primary', tokens.primary);
  applyColorVars('secondary', tokens.secondary);
  root.style.setProperty('--ld-theme-primary', tokens.primary);
  root.style.setProperty('--ld-theme-secondary', tokens.secondary);
  root.style.setProperty('--ld-theme-accent', tokens.accent);
  root.style.setProperty('--ld-theme-background', tokens.background);
  root.style.setProperty('--ld-theme-surface', tokens.surface);
  root.style.setProperty('--ld-theme-text', tokens.text);
  root.style.setProperty('--ld-theme-muted', tokens.muted);
  root.style.setProperty('--ld-theme-border', tokens.border);

  const fontFamilies: Record<DesignTokens['fontFamily'], string> = {
    inter: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    system: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    georgia: 'Georgia, "Times New Roman", serif',
  };
  const radiusValues: Record<DesignTokens['cardRadius'], string> = {
    compact: '0.65rem', comfortable: '1.1rem', rounded: '1.6rem',
  };
  const widthValues: Record<DesignTokens['contentWidth'], string> = {
    standard: '1120px', wide: '1280px', 'extra-wide': '1440px',
  };
  const shadowValues: Record<DesignTokens['shadow'], { soft: string; card: string }> = {
    none: { soft: 'none', card: 'none' },
    soft: { soft: '0 12px 34px rgba(50, 21, 34, 0.07)', card: '0 14px 34px rgba(50, 21, 34, 0.09)' },
    elevated: { soft: '0 16px 42px rgba(30, 18, 24, 0.12)', card: '0 20px 48px rgba(30, 18, 24, 0.16)' },
  };
  root.style.setProperty('--ld-theme-font-family', fontFamilies[tokens.fontFamily]);
  root.style.setProperty('--ld-theme-card-radius', radiusValues[tokens.cardRadius]);
  root.style.setProperty('--ld-theme-content-width', widthValues[tokens.contentWidth]);
  root.style.setProperty('--ld-theme-shadow-soft', shadowValues[tokens.shadow].soft);
  root.style.setProperty('--ld-theme-shadow-card', shadowValues[tokens.shadow].card);
}

const ThemeContext = createContext<ThemeContextType>({
  settings: defaultSettings,
  isDark: false,
});

/**
 * Generate a 50–900 shade palette from a single hex color.
 * Uses HSL lightness shifts to produce 10 shades.
 */
function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function generatePalette(hex: string): Record<string, string> {
  const [h, s] = hexToHsl(hex);
  const shades: Record<string, number> = {
    '50': 96, '100': 90, '200': 80, '300': 70, '400': 60,
    '500': 50, '600': 40, '700': 33, '800': 26, '900': 20, '950': 12,
  };
  const result: Record<string, string> = {};
  for (const [key, lightness] of Object.entries(shades)) {
    result[key] = hslToHex(h, s, lightness);
  }
  return result;
}

function applyColorVars(prefix: string, hex: string) {
  const palette = generatePalette(hex);
  const root = document.documentElement;
  for (const [shade, color] of Object.entries(palette)) {
    root.style.setProperty(`--color-${prefix}-${shade}`, color);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setSettings((current) => ({ ...defaultSettings, ...json.data, storefrontContent: current.storefrontContent }));
        }
      })
      .catch(() => {});
  }, []);

  // Los textos editables se cargan desde el Worker del entorno actual.
  // Las lecturas de catálogo, precios, medios y zonas conservan su proxy de solo lectura.
  useEffect(() => {
    let active = true;
    fetch('/api/settings/storefront-content', { headers: { Accept: 'application/json' } })
      .then((response) => response.json())
      .then((json) => {
        if (active && json.success && json.data && typeof json.data === 'object') {
          setSettings((current) => ({
            ...current,
            storefrontContent: { ...DEFAULT_STOREFRONT_CONTENT, ...json.data },
          }));
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // Apply the complete storefront design system whenever its persisted tokens change.
  useEffect(() => {
    const tokens = readDesignTokens(settings.storefrontContent.designTokensJson);
    // Keep compatibility with older settings records if the JSON has not been saved yet.
    const resolved = settings.storefrontContent.designTokensJson
      ? tokens
      : { ...tokens, primary: settings.colorPrimary, secondary: settings.colorSecondary };
    applyDesignTokens(resolved);
  }, [settings.colorPrimary, settings.colorSecondary, settings.storefrontContent.designTokensJson]);

  // Manage dark mode
  useEffect(() => {
    const { darkMode } = settings;
    let dark = false;
    if (darkMode === 'dark') {
      dark = true;
    } else if (darkMode === 'system') {
      dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    setIsDark(dark);
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.darkMode]);

  // Update document title and favicon
  useEffect(() => {
    document.title = settings.siteTitle;
  }, [settings.siteTitle]);

  useEffect(() => {
    if (settings.favicon) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = settings.favicon;
    }
  }, [settings.favicon]);

  return (
    <ThemeContext.Provider value={{ settings, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
