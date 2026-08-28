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

export function ChevronDownIcon({ className = "header-icon" }: IconProps) {
  return (
    <IconFrame className={className}>
      <path d="m7 10 5 5 5-5" />
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

export function GridViewIcon() {
  return <span aria-hidden="true">▦</span>;
}

export function ListViewIcon() {
  return <span aria-hidden="true">☷</span>;
}

export function CloseIcon() {
  return <span aria-hidden="true">×</span>;
}

export function InfoIcon() {
  return <span aria-hidden="true">i</span>;
}

export function BrandIcon() {
  return <span aria-hidden="true">⤴︎</span>;
}
