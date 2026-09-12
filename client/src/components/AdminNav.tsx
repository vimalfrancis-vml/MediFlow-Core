import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface NavItem {
  name: string;
  path: string;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Overview', path: '/admin' },
  { name: 'Users', path: '/admin/users' },
  { name: 'Departments', path: '/admin/departments' },
  { name: 'Roles', path: '/admin/roles' },
  { name: 'Workflows', path: '/admin/workflows' },
  { name: 'Terminology', path: '/admin/terminology' },
  { name: 'Audit Logs', path: '/admin/audit-logs' },
];

export const AdminNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="admin-nav flex items-center gap-1 sm:gap-2 overflow-x-auto py-2 scrollbar-none" aria-label="Admin Navigation">
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.path === '/admin'
            ? location.pathname === '/admin'
            : location.pathname.startsWith(item.path);

        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            aria-current={isActive ? 'page' : undefined}
            className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-all whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 ${
              isActive
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/70 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border border-transparent'
            }`}
          >
            {item.name}
          </button>
        );
      })}
    </nav>
  );
};
