import { useState, useRef, useEffect, type ReactNode, type FC } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NotificationCenter } from './NotificationCenter';
import { getRoleTheme, getRoleDisplayName, type AppRole } from '../constants/theme';
import { FirstLoginModal } from './FirstLoginModal';
import { ChangePasswordModal } from './ChangePasswordModal';
import logoImg from '../assets/logo.png';

export { ROLE_THEME } from '../constants/theme';

export interface AppShellProps {
  role?: AppRole;
  title?: string;
  brandPrefix?: string;
  nav?: ReactNode;
  actionBar?: ReactNode;
  isStickyHeader?: boolean;
  contentClassName?: string;
  children: ReactNode;
}

export const AppShell: FC<AppShellProps> = ({
  role,
  title,
  nav,
  actionBar,
  isStickyHeader = true,
  contentClassName,
  children,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);

  // Dynamic active role derived from explicit prop, authentication state, or default fallback
  const activeRole = role || user?.role || 'EMPLOYEE';
  const theme = getRoleTheme(activeRole);
  const brandTitle = title || 'E-Office';

  const handleLogout = () => {
    setIsUserMenuOpen(false);
    logout();
    navigate('/login', { replace: true });
  };

  // Determine user role display with department context if available
  const roleDisplay = getRoleDisplayName(activeRole, user?.departmentCode);
  const initials = `${user?.firstName?.[0] || 'U'}${user?.lastName?.[0] || ''}`.toUpperCase();

  return (
    <div
      data-role={activeRole}
      className={`min-h-screen ${theme.bg} flex flex-col font-sans text-slate-900 antialiased`}
    >
      {/* Mandatory First Login Password Change Modal */}
      <FirstLoginModal />

      {/* Self-Service Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />

      {/* Top Application Header with 4px role-colored top bar */}
      <header
        className={`bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between shadow-2xs border-t-4 ${theme.bar} ${
          isStickyHeader ? 'sticky top-0 z-40' : ''
        }`}
      >
        {/* Brand: E-Office & Hospital Logo */}
        <Link to="/" className="flex items-center gap-2.5 sm:gap-3 hover:opacity-90 transition-opacity">
          <img
            src={logoImg}
            alt="E-Office Logo"
            className="w-8 h-8 sm:w-9 sm:h-9 object-contain flex-shrink-0"
          />
          <span className="font-bold text-lg sm:text-xl text-slate-900 tracking-tight whitespace-nowrap">
            {brandTitle}
          </span>
        </Link>

        {/* User Info & Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          <NotificationCenter />

          {/* Account Menu Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600"
              aria-expanded={isUserMenuOpen}
              aria-haspopup="true"
            >
              <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                {initials}
              </div>
              <div className="hidden md:flex flex-col items-start leading-tight text-left">
                <span className="text-xs font-semibold text-slate-800">
                  {user ? `${user.firstName} ${user.lastName}` : 'Signed-in User'}
                </span>
                <span className={`text-[10px] font-semibold ${theme.text}`}>
                  {roleDisplay}
                </span>
              </div>
              <svg
                className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-4 py-2.5 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {user ? `${user.firstName} ${user.lastName}` : 'Hospital User'}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                  <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded ${theme.bg} ${theme.text}`}>
                    {roleDisplay}
                  </span>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      navigate('/profile');
                    }}
                    className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2.5 transition-colors"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>My Profile</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setIsChangePasswordOpen(true);
                    }}
                    className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2.5 transition-colors"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    <span>Change Password</span>
                  </button>
                </div>

                <div className="border-t border-slate-100 pt-1">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors font-medium"
                  >
                    <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Action Bar (if present) */}
      {actionBar}

      {/* Subnavigation Bar */}
      {nav && (
        <div className="bg-white border-b border-slate-200 sticky top-[57px] sm:top-[61px] z-30 shadow-2xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            {nav}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className={contentClassName || 'flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-5'}>
        {children}
      </main>
    </div>
  );
};
