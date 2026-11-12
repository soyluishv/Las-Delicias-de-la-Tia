/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PUBLIC_STOREFRONT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
