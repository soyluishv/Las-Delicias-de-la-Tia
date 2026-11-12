import { defineConfig, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';

const PRODUCTION_API_ORIGIN = 'https://las-delicias-admin.pages.dev';

/**
 * Solo las lecturas públicas del catálogo y de la configuración comercial
 * usan producción durante el desarrollo local.
 * Las imágenes nuevas se consultan primero en el Worker local; si no existen allí,
 * se usa un respaldo de solo lectura de los medios públicos. Todas las escrituras siguen locales.
 */
function isProductionReadOnlyPath(pathname: string): boolean {
  return (
    pathname === '/api/menu/categories' ||
    pathname === '/api/menu/items' ||
    /^\/api\/menu\/items\/[^/]+$/.test(pathname) ||
    pathname === '/api/settings' ||
    pathname === '/api/delivery-zones' ||
    pathname === '/api/payment-methods'
  );
}

function localMediaFirstFallbackProxy() {
  return {
    name: 'las-delicias-local-media-first',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== 'GET') {
          next();
          return;
        }

        const requestUrl = req.url || '/';
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(requestUrl, 'http://localhost');
        } catch {
          next();
          return;
        }

        if (!parsedUrl.pathname.startsWith('/api/media/')) {
          next();
          return;
        }

        const acceptHeader = req.headers?.accept;
        const headers = { Accept: typeof acceptHeader === 'string' ? acceptHeader : '*/*' };

        void (async () => {
          // Primero consulta R2 local: así se muestran las imágenes cargadas durante la prueba.
          let imageResponse = await fetch(new URL(`${parsedUrl.pathname}${parsedUrl.search}`, 'http://127.0.0.1:8788'), {
            method: 'GET',
            headers,
          });
          let source = 'local-worker';

          // Si la imagen no existe en el R2 local, conserva la visualización del catálogo
          // consultando en solo lectura la copia pública de medios.
          if (imageResponse.status === 404) {
            imageResponse = await fetch(new URL(`${parsedUrl.pathname}${parsedUrl.search}`, PRODUCTION_API_ORIGIN), {
              method: 'GET',
              headers,
            });
            source = 'production-read-only-fallback';
          }

          res.statusCode = imageResponse.status;
          res.setHeader('x-las-delicias-media-source', source);
          res.setHeader('x-content-type-options', 'nosniff');
          for (const headerName of ['content-type', 'cache-control', 'etag', 'last-modified']) {
            const headerValue = imageResponse.headers.get(headerName);
            if (headerValue) res.setHeader(headerName, headerValue);
          }
          res.end(Buffer.from(await imageResponse.arrayBuffer()));
        })().catch((error: unknown) => {
          console.error('[Las Delicias] Error consultando fotografía local o de respaldo:', error);
          if (res.writableEnded) return;
          res.statusCode = 502;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.setHeader('cache-control', 'no-store');
          res.end(JSON.stringify({
            success: false,
            error: 'No fue posible cargar la fotografía. Comprueba que el Worker local esté activo.',
          }));
        });
      });
    },
  };
}

function productionReadOnlyApiProxy() {
  return {
    name: 'las-delicias-production-read-only-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        // Nunca enviar escrituras, HEAD ni métodos desconocidos a producción.
        if (req.method !== 'GET') {
          next();
          return;
        }

        const requestUrl = req.url || '/';
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(requestUrl, 'http://localhost');
        } catch {
          next();
          return;
        }

        if (!isProductionReadOnlyPath(parsedUrl.pathname)) {
          next();
          return;
        }

        const upstreamUrl = new URL(`${parsedUrl.pathname}${parsedUrl.search}`, PRODUCTION_API_ORIGIN);
        const acceptHeader = req.headers?.accept;
        const accept = typeof acceptHeader === 'string' ? acceptHeader : '*/*';

        void (async () => {
          const upstream = await fetch(upstreamUrl, {
            method: 'GET',
            headers: { Accept: accept },
          });

          res.statusCode = upstream.status;
          res.setHeader('x-las-delicias-data-source', 'production-read-only');
          res.setHeader('x-content-type-options', 'nosniff');

          const contentType = upstream.headers.get('content-type');
          if (contentType) res.setHeader('content-type', contentType);

          const etag = upstream.headers.get('etag');
          if (etag) res.setHeader('etag', etag);

          const lastModified = upstream.headers.get('last-modified');
          if (lastModified) res.setHeader('last-modified', lastModified);

          // Evita que los datos de precio/catálogo queden obsoletos en pruebas.
          res.setHeader('cache-control', 'no-store');

          const body = Buffer.from(await upstream.arrayBuffer());
          res.end(body);
        })().catch((error: unknown) => {
          console.error('[Las Delicias] Error consultando lectura de producción:', error);
          if (res.writableEnded) return;
          res.statusCode = 502;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.setHeader('cache-control', 'no-store');
          res.setHeader('x-las-delicias-data-source', 'production-read-only-error');
          res.end(JSON.stringify({
            success: false,
            error: 'No fue posible consultar los datos públicos de producción. Revisa la conexión e inténtalo de nuevo.',
          }));
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localMediaFirstFallbackProxy(), productionReadOnlyApiProxy()],
  server: {
    port: 5174,
    proxy: {
      // Las operaciones no incluidas en la lista de lectura de producción
      // permanecen dirigidas al Worker local.
      '/api': {
        target: 'http://127.0.0.1:8788',
        changeOrigin: true,
      },
      '/uploads': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
});
