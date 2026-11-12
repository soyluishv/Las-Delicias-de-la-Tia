import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';

type Role = 'SUPER_ADMIN' | 'MANAGER' | 'STAFF';
type Card = {
  title: string;
  description: string;
  link: string;
  group: string;
  roles: Role[];
  status: 'Conectado' | 'Interfaz preparada';
  icon: string;
};

const cards: Card[] = [
  { title: 'Datos del negocio', description: 'Nombre comercial, título de la tienda, frases y datos de contacto.', link: '/settings/general', group: 'Negocio', roles: ['SUPER_ADMIN', 'MANAGER'], status: 'Conectado', icon: '✳' },
  { title: 'Identidad visual', description: 'Logotipo original, icono de la tienda y presentación de la marca.', link: '/design/branding', group: 'Negocio', roles: ['SUPER_ADMIN'], status: 'Conectado', icon: '◈' },
  { title: 'Portada de la tienda', description: 'Elegir y cambiar las tres fotografías destacadas que aparecen en el inicio.', link: '/settings/homepage', group: 'Negocio', roles: ['SUPER_ADMIN', 'MANAGER'], status: 'Conectado', icon: '▧' },
  { title: 'Redes sociales y enlaces', description: 'Configura Facebook, Instagram, TikTok, tu página web y dos enlaces adicionales.', link: '/settings/social-links', group: 'Negocio', roles: ['SUPER_ADMIN', 'MANAGER'], status: 'Conectado', icon: '↗' },
  { title: 'Contenido de la tienda', description: 'Adapta los textos de portada, catálogo, navegación, carrito, compra y pie de página.', link: '/settings/storefront-content', group: 'Negocio', roles: ['SUPER_ADMIN', 'MANAGER'], status: 'Conectado', icon: '✎' },
  { title: 'Diseño visual de la tienda', description: 'Configura la paleta completa, tipografía, fondos, proporciones y estilo de tarjetas.', link: '/settings/theme', group: 'Negocio', roles: ['SUPER_ADMIN', 'MANAGER'], status: 'Conectado', icon: '🎨' },
  { title: 'Constructor de portada', description: 'Añade bloques de contenido, imágenes, beneficios y llamadas a la acción; ordénalos y controla su visibilidad.', link: '/design/pages', group: 'Negocio', roles: ['SUPER_ADMIN', 'MANAGER'], status: 'Conectado', icon: '▦' },
  { title: 'Dirección privada', description: 'Dirección base, barrio, municipio y departamento. No se publica a los clientes.', link: '/settings/location', group: 'Operación', roles: ['SUPER_ADMIN'], status: 'Interfaz preparada', icon: '⌖' },
  { title: 'Horarios', description: 'Días de atención, apertura, cierre y excepciones por fechas especiales.', link: '/settings/hours', group: 'Operación', roles: ['SUPER_ADMIN', 'MANAGER'], status: 'Interfaz preparada', icon: '◷' },
  { title: 'Pedidos y recogidas', description: 'Activar pedidos, domicilios, recogida, tiempos de preparación y anticipación.', link: '/settings/orders', group: 'Operación', roles: ['SUPER_ADMIN', 'MANAGER'], status: 'Interfaz preparada', icon: '▤' },
  { title: 'Zonas de domicilio', description: 'Barrios atendidos, cobertura, tarifas y valores mínimos.', link: '/delivery-zones', group: 'Operación', roles: ['SUPER_ADMIN', 'MANAGER'], status: 'Conectado', icon: '⌁' },
  { title: 'Medios de pago', description: 'Configurar Bancolombia, Nequi y llave Bre-B.', link: '/settings/payment', group: 'Pagos', roles: ['SUPER_ADMIN'], status: 'Conectado', icon: '$' },
];

const groups = ['Negocio', 'Operación', 'Pagos'];

export default function Settings() {
  const { user } = useAuth();
  const visible = cards.filter((card) => user && card.roles.includes(user.role as Role));

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header className="overflow-hidden rounded-2xl bg-[#2B1720] px-6 py-7 text-white shadow-sm sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#E9B9A9]">Las Delicias de la Tía</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Configuración del negocio</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">Administra desde un solo lugar la identidad, la operación y los medios de pago de tu negocio.</p>
          </div>
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90">Panel de administración</span>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {groups.map((group) => (
          <div key={group} className="rounded-xl border border-[#E9DDD7] bg-white px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Sección</p>
            <p className="mt-1 font-semibold text-[#3B222B]">{group}</p>
          </div>
        ))}
      </div>

      {groups.map((group) => {
        const items = visible.filter((card) => card.group === group);
        if (!items.length) return null;
        return (
          <section key={group} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#3B222B]">{group}</h2>
              <span className="text-xs text-gray-500">{items.length} {items.length === 1 ? 'opción' : 'opciones'}</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((card) => (
                <Link key={card.link} to={card.link} className="group flex min-h-40 flex-col rounded-2xl border border-[#E8DDD7] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#C98B78] hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F8EEE8] text-xl font-semibold text-[#8F4F43]">{card.icon}</span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${card.status === 'Conectado' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{card.status}</span>
                  </div>
                  <h3 className="mt-4 font-semibold text-[#3B222B] group-hover:text-[#8F4F43]">{card.title}</h3>
                  <p className="mt-1 text-sm leading-5 text-gray-600">{card.description}</p>
                  <span className="mt-auto pt-4 text-xs font-semibold text-[#8F4F43]">Abrir configuración <span aria-hidden="true">→</span></span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Las opciones marcadas como «Interfaz preparada» ya tienen su espacio de administración diseñado; su guardado se conectará en la siguiente etapa. Las opciones «Conectado» utilizan las funciones actuales del sistema.
      </p>
    </div>
  );
}
