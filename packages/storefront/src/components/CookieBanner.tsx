import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'las-delicias-storage-notice-v1';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== 'accepted') {
        setVisible(true);
      }
    } catch {
      // Si el navegador bloquea el almacenamiento, el aviso puede cerrarse
      // durante la sesión, pero no se guarda una preferencia inexistente.
      setVisible(true);
    }

    const handleOpen = () => {
      setShowDetails(true);
      setVisible(true);
    };

    window.addEventListener('open-cookie-settings', handleOpen);
    return () => window.removeEventListener('open-cookie-settings', handleOpen);
  }, []);

  const acceptNotice = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'accepted');
    } catch {
      // El cierre sigue funcionando aunque el navegador no permita guardar.
    }
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <section
      aria-label="Aviso de almacenamiento local"
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-rose-200 bg-white shadow-[0_-8px_32px_rgba(50,21,34,0.12)]"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl">
            <h2 className="text-sm font-bold text-[#321522]">Uso del almacenamiento local</h2>
            <p className="mt-1 text-sm text-slate-600">
              Utilizamos almacenamiento local del navegador para conservar funciones esenciales de la tienda,
              como tu sesión, el idioma y el carrito de compras.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDetails((value) => !value)}
            className="text-sm font-semibold text-[#A71942] underline-offset-4 hover:underline"
          >
            {showDetails ? 'Ocultar detalles' : 'Ver detalles'}
          </button>
        </div>

        {showDetails && (
          <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-slate-700">
            <p>
              Esta información se guarda en tu propio navegador para que puedas continuar usando la tienda.
              Si borras los datos del sitio, es posible que debas iniciar sesión nuevamente y que el carrito se vacíe.
            </p>
            <p className="mt-2">
              Este aviso no activa herramientas publicitarias ni categorías opcionales de seguimiento.
            </p>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={acceptNotice}
            className="rounded-xl bg-[#A71942] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#821333] focus:outline-none focus:ring-2 focus:ring-[#A71942] focus:ring-offset-2"
          >
            Entendido
          </button>
        </div>
      </div>
    </section>
  );
}
