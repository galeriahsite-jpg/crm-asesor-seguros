"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/* ============================================================
   LUMO · Iconos de línea (SVG stroke, estilo cuaderno)
   ============================================================ */

export type IconName =
  | 'hoy' | 'user' | 'calendar' | 'ventas' | 'clientes'
  | 'bell' | 'phone' | 'edit' | 'trash' | 'search'
  | 'arrow' | 'chart' | 'folder' | 'settings' | 'alert'
  | 'check' | 'note' | 'shield' | 'rocket' | 'refresh'
  | 'doc' | 'heart' | 'star' | 'logout' | 'plus';

const PATHS: Record<IconName, React.ReactNode> = {
  hoy: (<><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" /></>),
  user: (<><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1.2-3.5 4-5 7-5s5.8 1.5 7 5" /></>),
  calendar: (<><rect x="4" y="5.5" width="16" height="15" rx="2.5" /><path d="M4 10h16M8.5 3.5v3.5M15.5 3.5v3.5" /></>),
  ventas: (<><circle cx="12" cy="12" r="8.5" /><path d="M14.8 9.2c-.5-.9-1.6-1.4-2.8-1.4-1.5 0-2.8.8-2.8 2.1 0 2.8 5.9 1.4 5.9 4.2 0 1.3-1.4 2.1-3.1 2.1-1.3 0-2.5-.6-3-1.6M12 6v1.8M12 16.2V18" /></>),
  clientes: (<><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H12v16H5.5A1.5 1.5 0 0 1 4 18.5z" /><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H12v16h6.5a1.5 1.5 0 0 0 1.5-1.5z" /></>),
  bell: (<><path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10z" /><path d="M10 19a2.2 2.2 0 0 0 4 0" /></>),
  phone: (<path d="M6 4h3l1.5 4L8.5 9.5a11 11 0 0 0 6 6L16 13.5l4 1.5v3a2 2 0 0 1-2 2A14 14 0 0 1 4 6a2 2 0 0 1 2-2z" />),
  edit: (<><path d="M15.5 4.5l4 4L8 20H4v-4z" /><path d="M13 7l4 4" /></>),
  trash: (<><path d="M5 7h14M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2" /><path d="M6.5 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5L17.5 7" /></>),
  search: (<><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" /></>),
  arrow: (<path d="M5 12h14M13 6l6 6-6 6" />),
  chart: (<><path d="M4 20h16" /><path d="M7 20v-6M12 20V9M17 20V5" /></>),
  folder: (<path d="M4 7a2 2 0 0 1 2-2h4l2 2.5h6a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />),
  settings: (<><circle cx="12" cy="12" r="3" /><path d="M12 3.5v2.3M12 18.2v2.3M20.5 12h-2.3M5.8 12H3.5M18 6l-1.6 1.6M7.6 16.4L6 18M18 18l-1.6-1.6M7.6 7.6L6 6" /></>),
  alert: (<><path d="M12 4L3 19.5h18z" /><path d="M12 10v4.5M12 17.2v.3" /></>),
  check: (<><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.5l2.5 2.5 4.8-5.3" /></>),
  note: (<><path d="M6 3.5h12a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5z" /><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" /></>),
  shield: (<path d="M12 3.5l7 2.5v5.5c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z" />),
  rocket: (<><path d="M12 15c-1-4 0-8.5 3.5-11 2 1 3.5 3 3.5 6-2.5 3.5-4.5 5.5-7 5z" transform="rotate(45 12 12)" /><path d="M9 15l-3 3M12 17l-1 3M7 12l-3 1" /></>),
  refresh: (<><path d="M19 12a7 7 0 1 1-2-4.9" /><path d="M19 4v4h-4" /></>),
  doc: (<><path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z" /><path d="M14 3.5V8h4.5" /></>),
  heart: (<path d="M12 20s-7.5-4.5-7.5-10A4.2 4.2 0 0 1 12 7.3 4.2 4.2 0 0 1 19.5 10c0 5.5-7.5 10-7.5 10z" />),
  star: (<path d="M12 4l2.4 5 5.6.7-4.1 3.8 1.1 5.5-5-2.8-5 2.8 1.1-5.5L4 9.7 9.6 9z" />),
  logout: (<><path d="M14 4H6a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 6 20h8" /><path d="M10 12h10M16.5 8l3.5 4-3.5 4" /></>),
  plus: (<path d="M12 5v14M5 12h14" />),
};

export function Icon({ name, size = 20, className = '', strokeWidth = 1.8 }: {
  name: IconName; size?: number; className?: string; strokeWidth?: number;
}) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

/* ============================================================
   LUMO · Navegación inferior
   ============================================================ */

const NAV_ITEMS: { href: string; icon: IconName; label: string }[] = [
  { href: '/', icon: 'hoy', label: 'Hoy' },
  { href: '/prospectos', icon: 'user', label: 'Prospectos' },
  { href: '/agenda', icon: 'calendar', label: 'Agenda' },
  { href: '/ventas', icon: 'ventas', label: 'Ventas' },
  { href: '/clientes', icon: 'clientes', label: 'Clientes' },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-card/95 backdrop-blur-md border-t border-ink/10 flex justify-around items-center h-20 z-20 px-2">
      {NAV_ITEMS.map((item) => {
        const activo = item.href === '/'
          ? pathname === '/'
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center w-full py-2 transition-colors ${
              activo ? 'text-azul' : 'text-ink-faint hover:text-ink'
            }`}
          >
            <Icon name={item.icon} size={22} strokeWidth={activo ? 2.2 : 1.8} className="mb-1" />
            <span className={`text-[10px] ${activo ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/* ============================================================
   LUMO · Flujo de proceso
   Cada módulo muestra en qué paso del proceso comercial vive,
   qué se hace ahí y qué sigue. El proceso es siempre el mismo:
   Captar → Contactar → Diagnosticar → Cotizar → Cerrar → Cuidar
   ============================================================ */

const ETAPAS_PROCESO = ['Captar', 'Contactar', 'Diagnosticar', 'Cotizar', 'Cerrar', 'Cuidar'];

export function FlujoProceso({ paso, texto }: { paso: number; texto: string }) {
  return (
    <div className="px-6 pt-4">
      <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap pb-1 [-ms-overflow-style:none] [scrollbar-width:none]">
        {ETAPAS_PROCESO.map((e, i) => (
          <span key={e} className="flex items-center gap-1 shrink-0">
            <span className={`text-[10px] font-bold px-2 py-1 rounded-md tracking-wide ${
              i === paso
                ? 'bg-azul text-white'
                : i < paso
                  ? 'bg-azul-soft text-azul'
                  : 'bg-card text-ink-faint border border-ink/10'
            }`}>{i + 1} {e}</span>
            {i < ETAPAS_PROCESO.length - 1 && <span className="text-ink-faint text-[10px]">→</span>}
          </span>
        ))}
      </div>
      <p className="text-xs text-ink-soft mt-1.5 leading-snug">{texto}</p>
    </div>
  );
}

/* ============================================================
   LUMO · Encabezado de página
   ============================================================ */

export function PageHeader({ titulo, subtitulo, children }: {
  titulo: string; subtitulo?: string; children?: React.ReactNode;
}) {
  return (
    <header className="px-6 pt-10 pb-5 sticky top-0 z-10 bg-paper/90 backdrop-blur-md border-b border-ink/10 flex justify-between items-end">
      <div>
        {subtitulo && <p className="font-hand text-lg text-ink-soft leading-none mb-1">{subtitulo}</p>}
        <h1 className="text-4xl font-bold text-ink tracking-tight">{titulo}</h1>
      </div>
      {children && <div className="flex gap-2 items-center pb-1">{children}</div>}
    </header>
  );
}
