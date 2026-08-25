import type { ReactNode } from "react";

interface IconProps {
  className?: string;
}

interface MenuIconProps extends IconProps {
  open: boolean;
}

interface ThemeIconProps extends IconProps {
  dark: boolean;
}

function IconFrame({
  className,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function CopyIcon({ className = "button-icon" }: IconProps) {
  return (
    <IconFrame className={className}>
      <path d="m8 9-3 3 3 3m8-6 3 3-3 3m-3-8-2 10" />
    </IconFrame>
  );
}

export function CheckIcon({ className = "button-icon" }: IconProps) {
  return (
    <IconFrame className={className}>
      <path d="m5 12 4 4L19 6" />
    </IconFrame>
  );
}

export function MenuIcon({
  open,
  className = "header-icon",
}: MenuIconProps) {
  return (
    <IconFrame className={className}>
      {open ? (
        <path d="m6 6 12 12M18 6 6 18" />
      ) : (
        <path d="M4 7h16M4 12h16M4 17h16" />
      )}
    </IconFrame>
  );
}

export function KeyIcon({ className = "header-icon" }: IconProps) {
  return (
    <IconFrame className={className}>
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 8-8m-3 3 2 2m-5 1 2 2" />
    </IconFrame>
  );
}

export function ProfileIcon({ className = "header-icon" }: IconProps) {
  return (
    <IconFrame className={className}>
      <path d="M5 7.5h14M7 4.5h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z" />
      <path d="M8 11h8m-8 4h5" />
    </IconFrame>
  );
}

export function PlusIcon({ className = "header-icon" }: IconProps) {
  return (
    <IconFrame className={className}>
      <path d="M12 5v14M5 12h14" />
    </IconFrame>
  );
}

export function ThemeIcon({
  dark,
  className = "header-icon",
}: ThemeIconProps) {
  return dark ? (
    <IconFrame className={className}>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4m10.6 10.6 1.4 1.4m0-13.4-1.4 1.4M6.7 17.3l-1.4 1.4" />
    </IconFrame>
  ) : (
    <IconFrame className={className}>
      <path d="M20 15.2A8.2 8.2 0 0 1 8.8 4a7.9 7.9 0 1 0 11.2 11.2Z" />
    </IconFrame>
  );
}

export function SettingsIcon({ className = "header-icon" }: IconProps) {
  return (
    <IconFrame className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </IconFrame>
  );
}

export function GridViewIcon() {
  return <span aria-hidden="true">▦</span>;
}

export function ListViewIcon() {
  return <span aria-hidden="true">☷</span>;
}

export function CloseIcon() {
  return <span aria-hidden="true">×</span>;
}

export function BrandIcon() {
  return <span aria-hidden="true">⤴︎</span>;
}
