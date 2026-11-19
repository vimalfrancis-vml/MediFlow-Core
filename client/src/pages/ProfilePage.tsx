import { useState, useEffect, type FC } from 'react';
import { useAuth } from '../context/AuthContext';
import { AppShell } from '../components/AppShell';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { api, type UserItem } from '../services/api';
import { getRoleDisplayName, getRoleTheme } from '../constants/theme';
import { Link } from 'react-router-dom';

type TabType = 'overview' | 'security' | 'preferences' | 'activity';

export const ProfilePage: FC = () => {
  const { user, refreshUserProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  // Profile data & form states
  const [profile, setProfile] = useState<UserItem | null>(null);
  const [phone, setPhone] = useState('');
  const [language, setLanguage] = useState('en');
  const [emailNotif, setEmailNotif] = useState(true);
  const [inAppNotif, setInAppNotif] = useState(true);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch full user profile
  useEffect(() => {
    let isMounted = true;
    api.getProfile()
      .then((res) => {
        if (!isMounted) return;
        const u = res.data;
        setProfile(u);
        setPhone(u.phone || '');
        setLanguage(u.languagePreference || 'en');
        if (u.notificationPreferences) {
          setEmailNotif(Boolean(u.notificationPreferences.email !== false));
          setInAppNotif(Boolean(u.notificationPreferences.inApp !== false));
        }
      })
      .catch(() => {
        // Fallback to AuthContext user
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const res = await api.updateProfile({
        phone: phone.trim(),
        languagePreference: language,
        notificationPreferences: {
          email: emailNotif,
          inApp: inAppNotif,
        },
      });

      setProfile(res.data);
      await refreshUserProfile();
      setStatusMessage({ type: 'success', text: 'Preferences updated successfully.' });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to update preferences. Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const userRole = user?.role || 'EMPLOYEE';
  const theme = getRoleTheme(userRole);
  const roleDisplay = getRoleDisplayName(userRole, user?.departmentCode);

  if (isLoading) {
    return (
      <AppShell title="E-Office">
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 text-sm">
          Loading profile...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="E-Office">
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />

      <div className="space-y-6">
        {/* Header Breadcrumb & Title */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-700 text-white flex items-center justify-center font-bold text-2xl shadow-sm">
                {`${user?.firstName?.[0] || 'U'}${user?.lastName?.[0] || ''}`.toUpperCase()}
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  {user ? `${user.firstName} ${user.lastName}` : 'My Account'}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                  <span>{user?.email}</span>
                  <span>•</span>
                  <span>Employee ID: <strong className="text-slate-700 font-semibold">{user?.employeeId}</strong></span>
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${theme.bg} ${theme.text}`}>
                    {roleDisplay}
                  </span>
                  <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    {user?.departmentCode || 'General Staff'}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsChangePasswordOpen(true)}
              className="self-start sm:self-center px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <span>Change Password</span>
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 mt-6 -mb-6 space-x-6">
            {(['overview', 'security', 'preferences', 'activity'] as TabType[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-xs font-semibold uppercase tracking-wider transition-colors relative ${
                  activeTab === tab
                    ? 'text-blue-700 border-b-2 border-blue-700'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Identity Card */}
            <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Profile Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">First Name</span>
                  <span className="text-slate-900 font-semibold">{user?.firstName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Last Name</span>
                  <span className="text-slate-900 font-semibold">{user?.lastName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Official Email</span>
                  <span className="text-slate-900 font-semibold">{user?.email}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Employee ID</span>
                  <span className="text-slate-900 font-semibold">{user?.employeeId}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Department</span>
                  <span className="text-slate-900 font-semibold">
                    {profile?.department?.name || profile?.department?.code || user?.departmentCode}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Contact Phone</span>
                  <span className="text-slate-900 font-semibold">{profile?.phone || 'Not provided'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">System Role</span>
                  <span className="text-slate-900 font-semibold">{roleDisplay}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Account Status</span>
                  <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Active
                  </span>
                </div>
              </div>
            </div>

            {/* Role-Specific Quick Links Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Role Context
              </h2>
              <div className="space-y-3 text-xs">
                {userRole === 'ADMIN' && (
                  <div className="space-y-2">
                    <p className="text-slate-600">You hold Administrator privileges with system-wide authority.</p>
                    <div className="pt-2 flex flex-col gap-2">
                      <Link to="/admin" className="text-blue-700 hover:underline font-semibold flex items-center gap-1">
                        → Admin Overview
                      </Link>
                      <Link to="/admin/users" className="text-blue-700 hover:underline font-semibold flex items-center gap-1">
                        → User Management
                      </Link>
                      <Link to="/admin/roles" className="text-blue-700 hover:underline font-semibold flex items-center gap-1">
                        → Roles & Permissions
                      </Link>
                    </div>
                  </div>
                )}

                {userRole === 'HOD' && (
                  <div className="space-y-2">
                    <p className="text-slate-600">
                      You are Head of Department for{' '}
                      <strong className="text-slate-900">{profile?.department?.name || user?.departmentCode}</strong>.
                    </p>
                    <Link to="/approver" className="text-blue-700 hover:underline font-semibold block pt-2">
                      → View Pending Department Approvals
                    </Link>
                  </div>
                )}

                {userRole !== 'ADMIN' && userRole !== 'HOD' && (
                  <div className="space-y-2">
                    <p className="text-slate-600">Standard user account with department workflow access.</p>
                    <Link to="/employee" className="text-blue-700 hover:underline font-semibold block pt-2">
                      → My Service Requests
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Security */}
        {activeTab === 'security' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6 max-w-3xl">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Authentication & Password Security
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage your credentials and session protection.
              </p>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 block">Account Password</span>
                <span className="text-[11px] text-slate-500">
                  Secured with bcrypt hash encryption. Requires at least 12 characters.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsChangePasswordOpen(true)}
                className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
              >
                Change Password
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
              <span className="font-bold text-slate-900 block">Session Security Status</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-600">
                <div>
                  <span className="text-slate-400 block text-[11px]">Authentication Method</span>
                  <span className="font-semibold text-slate-800">Bearer JWT (HS256)</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Concurrent Session Protection</span>
                  <span className="font-semibold text-emerald-700">Active (Token Versioning)</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Transport Security</span>
                  <span className="font-semibold text-slate-800">TLS Encrypted In-Transit</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Password Change Policy</span>
                  <span className="font-semibold text-slate-800">12–72 UTF-8 Bytes, Complexity Enforced</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Preferences */}
        {activeTab === 'preferences' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6 max-w-2xl">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Personal Preferences
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Update your contact details and notification settings. Name and email can only be modified by an administrator.
              </p>
            </div>

            {statusMessage && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-700'
                }`}
              >
                <span>{statusMessage.type === 'success' ? '✓' : '⚠'}</span>
                <span>{statusMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleSavePreferences} className="space-y-5">
              {/* Phone Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-800"
                />
              </div>

              {/* Language Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Language Preference
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 text-slate-800 bg-white"
                >
                  <option value="en">English (Default)</option>
                  <option value="ml">Malayalam (മലയാളം)</option>
                  <option value="hi">Hindi (हिन्दी)</option>
                </select>
              </div>

              {/* Notification Preferences */}
              <div className="space-y-3 pt-2">
                <span className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Notification Channels
                </span>
                <label className="flex items-center space-x-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailNotif}
                    onChange={(e) => setEmailNotif(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <span>Receive email alerts on workflow updates</span>
                </label>
                <label className="flex items-center space-x-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inAppNotif}
                    onChange={(e) => setInAppNotif(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <span>Display in-app notification badge & popups</span>
                </label>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 text-white text-xs font-semibold shadow transition-colors"
                >
                  {isSaving ? 'Saving Preferences...' : 'Save Preferences'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 4: Activity */}
        {activeTab === 'activity' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4 max-w-3xl">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Recent Activity & Sessions
            </h2>
            <p className="text-xs text-slate-500">
              Account activity log for audit transparency.
            </p>

            <div className="divide-y divide-slate-100 text-xs">
              <div className="py-3 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800 block">Current Active Session</span>
                  <span className="text-slate-500">Web Browser • E-Office Portal</span>
                </div>
                <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-full text-[11px]">
                  Online Now
                </span>
              </div>
              <div className="py-3 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800 block">Password Status</span>
                  <span className="text-slate-500">
                    {user?.mustChangePassword ? 'Temporary Password Assigned' : 'Normal / Verified'}
                  </span>
                </div>
                <span className="text-slate-600">Encrypted</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default ProfilePage;
