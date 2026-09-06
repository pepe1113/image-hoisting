import {
  LayoutDashboard,
  Check,
  ChevronDown,
  CircleHelp,
  Copy,
  IdCard,
  ImageUp,
  KeyRound,
  Menu,
  Moon,
  Plus,
  Sun,
  X,
} from "lucide-react";

interface IconProps {
  className?: string;
}

interface MenuIconProps extends IconProps {
  open: boolean;
}

interface ThemeIconProps extends IconProps {
  dark: boolean;
}

export function CopyIcon({ className = "button-icon" }: IconProps) {
  return <Copy className={className} aria-hidden="true" />;
}

export function CheckIcon({ className = "button-icon" }: IconProps) {
  return <Check className={className} aria-hidden="true" />;
}

export function MenuIcon({ open, className = "header-icon" }: MenuIconProps) {
  const Icon = open ? X : Menu;
  return <Icon className={className} aria-hidden="true" />;
}

export function KeyIcon({ className = "header-icon" }: IconProps) {
  return <KeyRound className={className} aria-hidden="true" />;
}

export function ProfileIcon({ className = "header-icon" }: IconProps) {
  return <IdCard className={className} aria-hidden="true" />;
}

export function PlusIcon({ className = "header-icon" }: IconProps) {
  return <Plus className={className} aria-hidden="true" />;
}

export function ChevronDownIcon({ className = "header-icon" }: IconProps) {
  return <ChevronDown className={className} aria-hidden="true" />;
}

export function ThemeIcon({ dark, className = "header-icon" }: ThemeIconProps) {
  const Icon = dark ? Sun : Moon;
  return <Icon className={className} aria-hidden="true" />;
}

export function CloseIcon() {
  return <X className="button-icon" aria-hidden="true" />;
}

export function InfoIcon() {
  return <CircleHelp className="button-icon" aria-hidden="true" />;
}

export function BrandIcon() {
  return <ImageUp className="header-icon" aria-hidden="true" />;
}

export function GridViewIcon({ className = "button-icon" }: IconProps) {
  return <LayoutDashboard className={className} aria-hidden="true" />;
}

export function ListViewIcon({ className = "button-icon" }: IconProps) {
  return <Menu className={className} aria-hidden="true" />;
}
