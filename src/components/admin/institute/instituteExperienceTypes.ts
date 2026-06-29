import type { ReactNode } from "react";

export type InstituteExperienceTone = "neutral" | "good" | "warning" | "danger" | "info";

export interface InstituteBadgeItem {
  label: string;
  description?: string | null;
  tone?: InstituteExperienceTone;
}

export interface InstituteActionItem {
  label: string;
  description?: string | null;
  href?: string | null;
  onClick?: (() => void) | null;
  disabled?: boolean;
  tone?: InstituteExperienceTone;
}

export interface InstituteInsightItem {
  label: string;
  value?: string | number | null;
  description?: string | null;
  tone?: InstituteExperienceTone;
}

export interface InstituteDecisionItem {
  label: string;
  reason: string;
  meta?: string | null;
  tone?: InstituteExperienceTone;
}

export interface InstitutePanelBaseProps {
  eyebrow?: string | null;
  title: string;
  description?: string | null;
  children?: ReactNode;
  footer?: ReactNode;
  actions?: InstituteActionItem[];
  tone?: InstituteExperienceTone;
  className?: string;
}
