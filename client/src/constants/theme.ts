/**
 * Central ROLE_THEME configuration for E-Office Hospital Workflow Application.
 *
 * Visual design system rules:
 * - Role-specific colors appear ONLY in five explicitly permitted locations:
 *   1. The 4px top border of the application header (border-t-4 ${theme.bar}).
 *   2. The active role label text (${theme.text}).
 *   3. The active navigation item (${theme.navActive}).
 *   4. The subtle page background tint (${theme.bg}).
 *   5. One accent border on the "Awaiting your action" KPI card (${theme.kpiBorder}).
 * - All Tailwind class names must be literal strings.
 * - Primary buttons must always remain Blue-700 (#1D4ED8).
 * - Workflow actions must remain: Approve Emerald-700 (#047857), Reject Rose-700 (#BE123C).
 * - Burgundy/rose (#9F1239) is strictly restricted to Approver header top bar and role label.
 */

export const ROLE_THEME = {
  ADMIN: {
    bar: 'border-t-[#424B5A]',
    text: 'text-[#424B5A]',
    bg: 'bg-[#F1F3F5]',
    navActive: 'border-b-[#424B5A] text-[#424B5A]',
    kpiBorder: 'border-l-[#424B5A]',
    hex: '#424B5A',
    tintHex: '#F1F3F5',
    roleLabel: 'Administrator · IT',
    displayName: 'Administrator',
  },
  HOD: {
    bar: 'border-t-[#1E3A8A]',
    text: 'text-[#1E3A8A]',
    bg: 'bg-[#EFF3FB]',
    navActive: 'border-b-[#1E3A8A] text-[#1E3A8A]',
    kpiBorder: 'border-l-[#1E3A8A]',
    hex: '#1E3A8A',
    tintHex: '#EFF3FB',
    roleLabel: 'Head of Department',
    displayName: 'Head of Department',
  },
  APPROVER: {
    bar: 'border-t-[#9F1239]',
    text: 'text-[#9F1239]',
    bg: 'bg-[#FFF1F2]',
    navActive: 'border-b-[#9F1239] text-[#9F1239]',
    kpiBorder: 'border-l-[#9F1239]',
    hex: '#9F1239',
    tintHex: '#FFF1F2',
    roleLabel: 'Approver',
    displayName: 'Approver',
  },
  EMPLOYEE: {
    bar: 'border-t-[#0F766E]',
    text: 'text-[#0F766E]',
    bg: 'bg-[#F0FDFA]',
    navActive: 'border-b-[#0F766E] text-[#0F766E]',
    kpiBorder: 'border-l-[#0F766E]',
    hex: '#0F766E',
    tintHex: '#F0FDFA',
    roleLabel: 'Employee',
    displayName: 'Employee',
  },
  HR: {
    bar: 'border-t-[#6D28D9]',
    text: 'text-[#6D28D9]',
    bg: 'bg-[#F5F3FF]',
    navActive: 'border-b-[#6D28D9] text-[#6D28D9]',
    kpiBorder: 'border-l-[#6D28D9]',
    hex: '#6D28D9',
    tintHex: '#F5F3FF',
    roleLabel: 'HR Officer',
    displayName: 'HR Officer',
  },
  FINANCE_OFFICER: {
    bar: 'border-t-[#A16207]',
    text: 'text-[#A16207]',
    bg: 'bg-[#FFFBEB]',
    navActive: 'border-b-[#A16207] text-[#A16207]',
    kpiBorder: 'border-l-[#A16207]',
    hex: '#A16207',
    tintHex: '#FFFBEB',
    roleLabel: 'Finance Officer',
    displayName: 'Finance Officer',
  },
  PROCUREMENT_OFFICER: {
    bar: 'border-t-[#4338CA]',
    text: 'text-[#4338CA]',
    bg: 'bg-[#EEF2FF]',
    navActive: 'border-b-[#4338CA] text-[#4338CA]',
    kpiBorder: 'border-l-[#4338CA]',
    hex: '#4338CA',
    tintHex: '#EEF2FF',
    roleLabel: 'Procurement Officer',
    displayName: 'Procurement Officer',
  },
  DIRECTOR: {
    bar: 'border-t-[#166534]',
    text: 'text-[#166534]',
    bg: 'bg-[#F0FDF4]',
    navActive: 'border-b-[#166534] text-[#166534]',
    kpiBorder: 'border-l-[#166534]',
    hex: '#166534',
    tintHex: '#F0FDF4',
    roleLabel: 'Director',
    displayName: 'Director',
  },
} as const;

export type RoleThemeKey = keyof typeof ROLE_THEME;
export type RoleThemeDefinition = (typeof ROLE_THEME)[RoleThemeKey];
export type AppRole = RoleThemeKey | string;

/**
 * Backward compatibility interface for components importing RoleThemeConfig
 */
export interface RoleThemeConfig {
  headerBorderTop: string;
  roleLabel: string;
  roleTextColor: string;
  pageBackground: string;
  brand: string;
  bar: string;
  text: string;
  bg: string;
  navActive: string;
  kpiBorder: string;
}

/**
 * Resolve theme tokens for any role identifier with fallback to EMPLOYEE
 */
export function getRoleTheme(role?: string | null): RoleThemeDefinition {
  if (!role) return ROLE_THEME.EMPLOYEE;
  const upper = role.toUpperCase();
  if (upper in ROLE_THEME) {
    return ROLE_THEME[upper as RoleThemeKey];
  }
  // Backend database role aliases
  if (upper === 'PURCHASE_OFFICER') {
    return ROLE_THEME.PROCUREMENT_OFFICER;
  }
  if (upper === 'MEDICAL_SUPERINTENDENT' || upper === 'MAINTENANCE_OFFICER') {
    return ROLE_THEME.APPROVER;
  }
  return ROLE_THEME.EMPLOYEE;
}

/**
 * Produce human-readable role display name with optional department code
 */
export function getRoleDisplayName(role?: string | null, deptCode?: string | null): string {
  if (!role) return 'Employee';
  const upper = role.toUpperCase();
  let base = '';
  switch (upper) {
    case 'ADMIN':
      return 'Administrator · IT';
    case 'HOD':
      base = 'Head of Department';
      break;
    case 'APPROVER':
      base = 'Approver';
      break;
    case 'EMPLOYEE':
      base = 'Employee';
      break;
    case 'HR':
      base = 'HR Officer';
      break;
    case 'FINANCE_OFFICER':
      base = 'Finance Officer';
      break;
    case 'PROCUREMENT_OFFICER':
    case 'PURCHASE_OFFICER':
      base = 'Procurement Officer';
      break;
    case 'DIRECTOR':
      base = 'Director';
      break;
    case 'MEDICAL_SUPERINTENDENT':
      base = 'Medical Superintendent';
      break;
    case 'MAINTENANCE_OFFICER':
      base = 'Maintenance Officer';
      break;
    default:
      base = role.replace(/_/g, ' ');
  }
  return deptCode ? `${base} · ${deptCode}` : base;
}
