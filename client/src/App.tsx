import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import NewRequestPage from './pages/NewRequestPage';
import RequestDetailsPage from './pages/RequestDetailsPage';
import ApproverDashboardPage from './pages/ApproverDashboardPage';
import ApproverDetailsPage from './pages/ApproverDetailsPage';
import UsersPage from './pages/UsersPage';
import UserDetailsPage from './pages/UserDetailsPage';
import DepartmentsPage from './pages/DepartmentsPage';
import DepartmentDetailsPage from './pages/DepartmentDetailsPage';

const ADMIN_ROLES = ['ADMIN'];
const APPROVER_ROLES = ['HOD', 'DIRECTOR', 'MEDICAL_SUPERINTENDENT', 'HR', 'PURCHASE_OFFICER', 'MAINTENANCE_OFFICER'];

/**
 * Guards a route by allowed roles.
 * If the user's role does not match, redirects them to their correct dashboard.
 */
function RoleRoute({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;

  if (!roles.includes(user.role)) {
    // Redirect to the correct dashboard for this role
    if (ADMIN_ROLES.includes(user.role)) return <Navigate to="/admin" replace />;
    if (APPROVER_ROLES.includes(user.role)) return <Navigate to="/approver" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Protected routes — require authentication */}
          <Route element={<ProtectedRoute />}>
            {/* Requester routes */}
            <Route
              path="/dashboard"
              element={
                <RoleRoute roles={['EMPLOYEE', ...ADMIN_ROLES, ...APPROVER_ROLES]}>
                  <DashboardPage />
                </RoleRoute>
              }
            />
            <Route path="/new-request" element={<NewRequestPage />} />
            <Route path="/request/:id" element={<RequestDetailsPage />} />

            {/* Admin-only routes */}
            <Route
              path="/admin"
              element={
                <RoleRoute roles={ADMIN_ROLES}>
                  <AdminDashboardPage />
                </RoleRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <RoleRoute roles={ADMIN_ROLES}>
                  <UsersPage />
                </RoleRoute>
              }
            />
            <Route
              path="/admin/users/:id"
              element={
                <RoleRoute roles={ADMIN_ROLES}>
                  <UserDetailsPage />
                </RoleRoute>
              }
            />
            <Route
              path="/admin/departments"
              element={
                <RoleRoute roles={ADMIN_ROLES}>
                  <DepartmentsPage />
                </RoleRoute>
              }
            />
            <Route
              path="/admin/departments/:id"
              element={
                <RoleRoute roles={ADMIN_ROLES}>
                  <DepartmentDetailsPage />
                </RoleRoute>
              }
            />

            {/* Approver routes — shared by HOD, Director, Medical Superintendent, etc. */}
            <Route
              path="/approver"
              element={
                <RoleRoute roles={APPROVER_ROLES}>
                  <ApproverDashboardPage />
                </RoleRoute>
              }
            />
            <Route
              path="/approver/request/:id"
              element={
                <RoleRoute roles={APPROVER_ROLES}>
                  <ApproverDetailsPage />
                </RoleRoute>
              }
            />
          </Route>

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
