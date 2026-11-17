import type { FC, ReactNode } from 'react';
import { AppShell } from './AppShell';

export interface DashboardLayoutProps {
  role?: string;
  title?: string;
  brandPrefix?: string;
  nav?: ReactNode;
  actionBar?: ReactNode;
  isStickyHeader?: boolean;
  contentClassName?: string;
  children: ReactNode;
}

/**
 * Single shared application layout container.
 * Delegates directly to AppShell to ensure consistent E-Office branding,
 * role-based theming, dynamic active role detection, and single layout architecture.
 */
export const DashboardLayout: FC<DashboardLayoutProps> = ({
  role,
  title = 'E-Office',
  brandPrefix,
  nav,
  actionBar,
  isStickyHeader = true,
  contentClassName,
  children,
}) => {
  return (
    <AppShell
      role={role}
      title={title}
      brandPrefix={brandPrefix}
      nav={nav}
      actionBar={actionBar}
      isStickyHeader={isStickyHeader}
      contentClassName={contentClassName}
    >
      {children}
    </AppShell>
  );
};
