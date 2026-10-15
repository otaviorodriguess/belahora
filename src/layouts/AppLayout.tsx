import type { ReactNode } from 'react';
import { CalendarDays, House, Search, Settings2, Plus, Sparkles } from 'lucide-react';
import type { Page } from '../types';
export function AppLayout({
  page,
  setPage,
  children,
  onAdd,
  studio,
  professional,
  readOnly = false,
}: {
  page: Page;
  setPage: (p: Page) => void;
  children: ReactNode;
  onAdd: () => void;
  studio: string;
  professional: string;
  readOnly?: boolean;
}) {
  const items = [
    { id: 'home' as const, label: 'Início', icon: House },
    { id: 'agenda' as const, label: 'Agenda', icon: CalendarDays },
    { id: 'search' as const, label: 'Buscar', icon: Search },
    { id: 'settings' as const, label: 'Configurações', icon: Settings2 },
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="#agenda" className="brand" onClick={() => setPage('agenda')}>
          <img src="/favicon.svg" alt="" />
          <div>
            Bela Hora<span>AGENDA & CUIDADO</span>
          </div>
        </a>
        <div className="studio-label">
          <span>SEU ESPAÇO</span>
          <strong>{studio}</strong>
        </div>
        <nav aria-label="Navegação principal">
          {items.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={page === id ? 'nav-item active' : 'nav-item'}
              aria-current={page === id ? 'page' : undefined}
              onClick={() => setPage(id)}
            >
              <Icon size={20} />
              <span>{label}</span>
              {page === id && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Sparkles size={22} />
          <p>
            Mais leveza na rotina.
            <br />
            Mais tempo para cuidar.
          </p>
          <div className="professional">
            <div className="avatar">{professional ? professional[0].toUpperCase() : 'A'}</div>
            <div>
              <strong>{professional || 'Seu espaço'}</strong>
              <span>Profissional de estética</span>
            </div>
          </div>
        </div>
      </aside>
      <main className="main-content">
        <div className="mobile-brand">
          <div>
            <img src="/favicon.svg" alt="" />
            <span>Bela Hora</span>
          </div>
          <span className="mobile-studio">{studio}</span>
        </div>
        {children}
      </main>
      <button className="fab" aria-label="Novo agendamento" disabled={readOnly} onClick={onAdd}>
        <Plus size={25} />
        <span>Novo agendamento</span>
      </button>
      <nav className="bottom-nav" aria-label="Navegação mobile">
        {items.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            aria-current={page === id ? 'page' : undefined}
            className={page === id ? 'active' : ''}
            onClick={() => setPage(id)}
          >
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

