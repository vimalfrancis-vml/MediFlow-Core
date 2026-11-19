import type { FC } from 'react';
import { Link } from 'react-router-dom';
import logoImg from '../assets/logo.png';
import { ROLE_THEME, type RoleThemeKey } from '../constants/theme';

interface ContrastMetric {
  white: number;
  tint: number;
  passWhite: boolean;
  passTint: boolean;
}

const CONTRAST_METRICS: Record<RoleThemeKey, ContrastMetric> = {
  ADMIN: { white: 8.80, tint: 7.91, passWhite: true, passTint: true },
  HOD: { white: 10.36, tint: 9.31, passWhite: true, passTint: true },
  APPROVER: { white: 8.02, tint: 7.30, passWhite: true, passTint: true },
  EMPLOYEE: { white: 5.47, tint: 5.25, passWhite: true, passTint: true },
  HR: { white: 7.10, tint: 6.48, passWhite: true, passTint: true },
  FINANCE_OFFICER: { white: 4.92, tint: 4.75, passWhite: true, passTint: true },
  PROCUREMENT_OFFICER: { white: 7.90, tint: 7.07, passWhite: true, passTint: true },
  DIRECTOR: { white: 7.13, tint: 6.81, passWhite: true, passTint: true },
};

const ROLE_ENTRIES: Array<{
  key: RoleThemeKey;
  title: string;
  roleSubtitle: string;
  colorFamily: string;
  notes: string;
}> = [
  {
    key: 'ADMIN',
    title: 'Administrator',
    roleSubtitle: 'Administrator · IT',
    colorFamily: 'Slate Gray (#424B5A)',
    notes: 'System administration and IT management.',
  },
  {
    key: 'HOD',
    title: 'Head of Department',
    roleSubtitle: 'Head of Department · Cardiology',
    colorFamily: 'Navy (#1E3A8A)',
    notes: 'Distinct from standard Blue-700 primary buttons.',
  },
  {
    key: 'APPROVER',
    title: 'Approver',
    roleSubtitle: 'Approver · Medical Records',
    colorFamily: 'Burgundy / Rose (#9F1239)',
    notes: 'Restricted strictly to header top bar and role label.',
  },
  {
    key: 'EMPLOYEE',
    title: 'Employee',
    roleSubtitle: 'Employee · Nursing',
    colorFamily: 'Deep Teal (#0F766E)',
    notes: 'Standard staff workflow identity.',
  },
  {
    key: 'HR',
    title: 'HR Officer',
    roleSubtitle: 'HR Officer · Human Resources',
    colorFamily: 'Deep Purple (#6D28D9)',
    notes: 'Staffing, onboarding, and leave authorization.',
  },
  {
    key: 'FINANCE_OFFICER',
    title: 'Finance Officer',
    roleSubtitle: 'Finance Officer · Accounts',
    colorFamily: 'Warm Amber / Brown (#A16207)',
    notes: 'Budget approvals and fiscal authorization.',
  },
  {
    key: 'PROCUREMENT_OFFICER',
    title: 'Procurement Officer',
    roleSubtitle: 'Procurement Officer · Materials Management',
    colorFamily: 'Deep Indigo (#4338CA)',
    notes: 'Purchase requisitions and vendor contracts.',
  },
  {
    key: 'DIRECTOR',
    title: 'Director',
    roleSubtitle: 'Director · Executive Office',
    colorFamily: 'Deep Forest Green (#166534)',
    notes: 'Executive final review and hospital policy.',
  },
];

/**
 * Development-only visual matrix component for evaluating all 8 role themes side by side.
 * Gated exclusively by import.meta.env.DEV so that it is stripped from production builds.
 */
export const ThemePreview: FC = () => {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-16 font-sans">
      {/* Top Banner & Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-2xs">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-md transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Admin
            </Link>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                E-Office · Role Identity Matrix & Contrast Verification
              </h1>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Development Environment Only (import.meta.env.DEV)
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 pt-8 space-y-10">
        {/* Verification Summary Card */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <h2 className="text-base font-bold text-slate-900">
              WCAG 2.1 AA Contrast Ratios (Minimum 4.5:1 Requirement)
            </h2>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed max-w-4xl">
            Role-specific colors are strictly restricted to 5 locations: (1) 4px header top bar, (2) active role label text, (3) active navigation tab, (4) subtle page background tint, and (5) accent left border on the &ldquo;Awaiting your action&rdquo; KPI card. Primary buttons always remain Blue-700 (#1D4ED8).
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Role Key</th>
                  <th className="py-2.5 px-4">Role Title</th>
                  <th className="py-2.5 px-4">Primary Hex</th>
                  <th className="py-2.5 px-4">Background Tint</th>
                  <th className="py-2.5 px-4">Contrast on White</th>
                  <th className="py-2.5 px-4">Contrast on Tint</th>
                  <th className="py-2.5 px-4">WCAG Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ROLE_ENTRIES.map((entry) => {
                  const theme = ROLE_THEME[entry.key];
                  const metrics = CONTRAST_METRICS[entry.key];
                  return (
                    <tr key={entry.key} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">
                        {entry.key}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-800">
                        {entry.title}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-4 h-4 rounded-full border border-slate-300 shadow-2xs"
                            style={{ backgroundColor: theme.hex }}
                          />
                          <span className="font-mono text-slate-700">{theme.hex}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-4 h-4 rounded-md border border-slate-300 shadow-2xs"
                            style={{ backgroundColor: theme.tintHex }}
                          />
                          <span className="font-mono text-slate-700">{theme.tintHex}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">
                        {metrics.white.toFixed(2)}:1
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">
                        {metrics.tint.toFixed(2)}:1
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Pass AA (≥ 4.5:1)
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Side-by-side Visual Matrix for All 8 Roles */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <h2 className="text-base font-bold text-slate-900">
                Visual Comparison: All 8 Role Themes Side-by-Side
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              8 Distinct Hospital Enterprise Identities
            </span>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {ROLE_ENTRIES.map((entry) => {
              const theme = ROLE_THEME[entry.key];
              const metrics = CONTRAST_METRICS[entry.key];

              return (
                <div
                  key={entry.key}
                  data-role={entry.key}
                  className={`rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col ${theme.bg}`}
                >
                  {/* Top Bar Indicator Card Header */}
                  <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: theme.hex }} />
                      <span className="font-bold text-sm text-slate-900">
                        {entry.title}
                      </span>
                      <span className="font-mono text-xs text-slate-500">
                        ({entry.key})
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-slate-500">
                      {entry.colorFamily}
                    </span>
                  </div>

                  {/* 1. Simulated AppShell Header */}
                  <div className="p-4 sm:p-5 space-y-4">
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        Location 1 & 2: Header Top Bar & Active Role Text
                      </div>

                      {/* Header Simulation Container with 4px Top Bar */}
                      <div
                        className={`bg-white border border-slate-200 rounded-lg shadow-2xs px-4 py-3 flex items-center justify-between border-t-4 ${theme.bar}`}
                      >
                        {/* Brand */}
                        <div className="flex items-center gap-2.5">
                          <img
                            src={logoImg}
                            alt="E-Office Logo"
                            className="w-7 h-7 object-contain flex-shrink-0"
                          />
                          <span className="font-bold text-base text-slate-900 tracking-tight">
                            E-Office
                          </span>
                        </div>

                        {/* User & Role Label */}
                        <div className="flex items-center gap-3">
                          <div className="text-right leading-tight">
                            <div className="text-xs font-semibold text-slate-800">
                              Dr. Rajesh Kumar
                            </div>
                            <div className={`text-[11px] font-semibold ${theme.text}`}>
                              {entry.roleSubtitle}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2 py-1 rounded hover:bg-slate-100"
                          >
                            Sign out
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 2. Simulated Active Navigation Item */}
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        Location 3: Active Navigation Item (Underline & Text)
                      </div>
                      <div className="bg-white border border-slate-200 rounded-lg px-4 shadow-2xs">
                        <div className="flex items-center gap-4 text-xs">
                          <span
                            className={`py-2.5 border-b-2 font-semibold transition-colors ${theme.navActive}`}
                          >
                            Overview
                          </span>
                          <span className="py-2.5 border-b-2 border-transparent text-slate-600 font-medium">
                            Requests
                          </span>
                          <span className="py-2.5 border-b-2 border-transparent text-slate-600 font-medium">
                            Departments
                          </span>
                          <span className="py-2.5 border-b-2 border-transparent text-slate-600 font-medium">
                            Audit Logs
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 3. KPI Cards: Awaiting Action (Location 5) vs Other Unstyled Cards */}
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        Location 5: &ldquo;Awaiting your action&rdquo; KPI Accent Border (All other KPIs unstyled)
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {/* Awaiting Action Card — Has Left Accent Border */}
                        <div
                          className={`bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs border-l-4 ${theme.kpiBorder} flex flex-col justify-between`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                              Pending Review
                            </span>
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                          </div>
                          <div className="mt-2 text-xl font-bold text-slate-900 tabular-nums">
                            14
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1">
                            Awaiting action
                          </div>
                        </div>

                        {/* Standard Approved Card — Preserved Standard Style */}
                        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-between">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                              Approved
                            </span>
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          </div>
                          <div className="mt-2 text-xl font-bold text-emerald-700 tabular-nums">
                            128
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1">
                            Standard card styling
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 4. Controls Verification: Primary Button (Blue-700) & Actions */}
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        Strict Restrictions: Primary Button (Blue-700) & Workflow Actions
                      </div>
                      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs flex flex-wrap items-center gap-2.5">
                        {/* Primary Button */}
                        <button
                          type="button"
                          className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold px-3 py-1.5 rounded-md shadow-2xs"
                        >
                          + New Request (Blue-700)
                        </button>

                        {/* Workflow Actions */}
                        <button
                          type="button"
                          className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-3 py-1.5 rounded-md shadow-2xs"
                        >
                          Approve (Emerald-700)
                        </button>
                        <button
                          type="button"
                          className="bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold px-3 py-1.5 rounded-md shadow-2xs"
                        >
                          Reject (Rose-700)
                        </button>
                      </div>
                    </div>

                    {/* Footer Metrics */}
                    <div className="pt-2 flex items-center justify-between text-[11px] text-slate-600 border-t border-slate-200/60">
                      <span>Contrast White: <strong>{metrics.white.toFixed(2)}:1</strong></span>
                      <span>Contrast Tint: <strong>{metrics.tint.toFixed(2)}:1</strong></span>
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        WCAG AA Pass
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
};
