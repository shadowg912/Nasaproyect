"use client";
import { type ReactNode, useEffect, useRef } from "react";
import { IconButton } from "./Button";

interface PanelProps {
  id: string;
  title: ReactNode;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
  /** Mueve el foco al panel al abrirlo (diálogo no modal). */
  autoFocus?: boolean;
  actions?: ReactNode;
}

/** Panel flotante sobre el mapa: región etiquetada, Esc cierra y el foco entra al abrir. */
export function Panel({ id, title, onClose, children, className = "", autoFocus = true, actions }: PanelProps) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  return (
    <section
      ref={ref}
      id={id}
      role="dialog"
      aria-modal="false"
      aria-labelledby={`${id}-title`}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape" && onClose) {
          e.stopPropagation();
          onClose();
        }
      }}
      className={`glass ui-panel ${className}`}
    >
      <header className="ui-panel-header">
        <h2 id={`${id}-title`} className="text-sm uppercase tracking-wide">{title}</h2>
        <div className="flex items-center gap-1">
          {actions}
          {onClose && <IconButton label="Cerrar" icon="close" onClick={onClose} className="!min-h-8" />}
        </div>
      </header>
      <div className="ui-panel-body">{children}</div>
    </section>
  );
}
