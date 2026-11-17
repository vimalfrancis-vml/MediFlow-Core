import type { FC } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRoleTheme } from '../constants/theme';

export const ApproverNav: FC = () => {
  const { user } = useAuth();
  const theme = getRoleTheme(user?.role || 'HOD');
  const isHod = user?.role === 'HOD' || user?.role === 'ADMIN';

  const items = [
    { name: 'Workflow Requests', path: '/approver', end: true },
    ...(isHod ? [{ name: 'Department Management', path: '/approver/department', end: false }] : []),
  ];

  return (
    <nav
      className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none py-0 -mb-px"
      aria-label="Approver navigation tabs"
    >
      {items.map((item) => (
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

