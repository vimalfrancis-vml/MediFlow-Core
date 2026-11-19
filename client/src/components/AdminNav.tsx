import type { FC } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRoleTheme } from '../constants/theme';

interface AdminNavItem {
  name: string;
  path: string;
  end?: boolean;
}

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { name: 'Overview', path: '/admin', end: true },
  { name: 'Approval Intelligence', path: '/admin/approval-intelligence' },
  { name: 'Users', path: '/admin/users' },
  { name: 'Departments', path: '/admin/departments' },
  { name: 'Positions', path: '/admin/positions' },
  { name: 'Roles', path: '/admin/roles' },
  { name: 'Workflows', path: '/admin/workflows' },
  { name: 'Terminology', path: '/admin/terminology' },
  { name: 'Audit logs', path: '/admin/audit-logs' },
];

export const AdminNav: FC = () => {
  const { user } = useAuth();
  const theme = getRoleTheme(user?.role || 'ADMIN');

  return (
    <nav
      className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none py-0 -mb-px"
      aria-label="Admin navigation tabs"
    >
      {ADMIN_NAV_ITEMS.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.end}
          className={({ isActive }) =>
            `px-3 py-3 text-sm whitespace-nowrap transition-colors inline-flex items-center border-b-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 ${
              isActive
                ? `${theme.navActive} font-semibold`
                : 'border-transparent text-slate-600 hover:text-slate-900 font-medium hover:border-slate-300'
            }`
          }
        >
          {item.name}
        </NavLink>
      ))}
    </nav>
  );
};
