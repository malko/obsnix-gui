import type { ReactNode } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';

type Props = {
  /** Stable identifier used to persist the open/closed state. */
  id: string;
  title: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
};

export const CollapsibleSection = ({ id, title, defaultOpen = true, className, children }: Props) => {
  const [open, setOpen] = usePersistentState<boolean>(`obsnix:section:${id}`, defaultOpen);

  return (
    <div className={`control-group collapsible ${open ? 'is-open' : 'is-collapsed'}${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className="collapsible-header"
        aria-expanded={open}
        aria-controls={`section-${id}`}
        onClick={() => setOpen(!open)}
      >
        <span className="collapsible-chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
        <h2>{title}</h2>
      </button>
      {open && (
        <div className="collapsible-content" id={`section-${id}`}>
          {children}
        </div>
      )}
    </div>
  );
};
