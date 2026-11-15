import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "ghost" | "glass";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
  icon?: IconName;
  children?: ReactNode;
}

/** Botón con los tokens de marca. `glass` es para usar encima del mapa. */
export function Button({ variant = "primary", size = "md", icon, children, className = "", type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={`ui-btn ui-btn-${variant} ${size === "sm" ? "ui-btn-sm" : ""} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={size === "sm" ? 16 : 18} />}
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: IconName;
  pressed?: boolean;
  showLabel?: boolean;
  variant?: Variant;
}

/** Botón de icono accesible: `label` es obligatorio (aria-label o texto visible). */
export function IconButton({ label, icon, pressed, showLabel = false, variant = "glass", className = "", type = "button", ...rest }: IconButtonProps) {
  return (
    <button type={type} aria-label={showLabel ? undefined : label} aria-pressed={pressed} title={label}
      className={`ui-btn ui-btn-${variant} ${showLabel ? "flex-col gap-1 px-2 py-1.5 text-xs" : "px-2"} ${className}`} {...rest}>
      <Icon name={icon} />
      {showLabel && <span>{label}</span>}
    </button>
  );
}
