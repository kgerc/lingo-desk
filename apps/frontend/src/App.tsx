import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { Suspense, lazy, ReactNode } from 'react'
import { useAuthStore } from './stores/authStore'
import Layout from './components/Layout'

// Lazy load pages for code splitting - reduces initial bundle by ~60%
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const StudentsPage = lazy(() => import('./pages/StudentsPage'))
const TeachersPage = lazy(() => import('./pages/TeachersPage'))
const CoursesPage = lazy(() => import('./pages/CoursesPage'))
const GroupsPage = lazy(() => import('./pages/GroupsPage'))
const MaterialsPage = lazy(() => import('./pages/MaterialsPage'))
const LessonsPage = lazy(() => import('./pages/LessonsPage'))
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'))
const AlertsPage = lazy(() => import('./pages/AlertsPage'))
const TeacherSchedulePage = lazy(() => import('./pages/TeacherSchedulePage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const DebtorsPage = lazy(() => import('./pages/DebtorsPage'))
const NotificationSettingsPage = lazy(() => import('./pages/NotificationSettingsPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const MailingsPage = lazy(() => import('./pages/MailingsPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))

// Wrapper to handle Suspense inside Layout
const LazyPage = ({ children }: { children: ReactNode }) => (
  <Suspense>
    {children}
  </Suspense>
)

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#fff',
            color: '#363636',
            padding: '16px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" />
            ) : (
              <Suspense>
                <LoginPage />
              </Suspense>
            )
          }
        />
        <Route
          path="/register"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" />
            ) : (
              <Suspense>
                <RegisterPage />
              </Suspense>
            )
          }
        />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Layout>
                <Navigate to="/dashboard" />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/dashboard"
          element={
            isAuthenticated ? (
              <Layout>
                <LazyPage><DashboardPage /></LazyPage>
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/alerts"
          element={
            isAuthenticated ? (
              <Layout>
                <LazyPage><AlertsPage /></LazyPage>
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/users"
          element={
            isAuthenticated ? (
              useAuthStore.getState().user?.role === 'ADMIN' || useAuthStore.getState().user?.role === 'MANAGER' ? (
                <Layout>
                  <LazyPage><UsersPage /></LazyPage>
                </Layout>
              ) : (
                <Navigate to="/dashboard" />
              )
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/students"
          element={
            isAuthenticated ? (
              <Layout>
                <LazyPage><StudentsPage /></LazyPage>
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/teachers"
          element={
            isAuthenticated ? (
              <Layout>
                <LazyPage><TeachersPage /></LazyPage>
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/courses"
          element={
            isAuthenticated ? (
              <Layout>
                <LazyPage><CoursesPage /></LazyPage>
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/mailing"
          element={
            isAuthenticated ? (
              useAuthStore.getState().user?.role === 'ADMIN' || useAuthStore.getState().user?.role === 'MANAGER' ? (
                <Layout>
                  <LazyPage><MailingsPage /></LazyPage>
                </Layout>
              ) : (
                <Navigate to="/dashboard" />
              )
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/groups"
          element={
            isAuthenticated ? (
              <Layout>
                <LazyPage><GroupsPage /></LazyPage>
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/materials"
          element={
            isAuthenticated ? (
              <Layout>
                <LazyPage><MaterialsPage /></LazyPage>
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/lessons"
          element={
            isAuthenticated ? (
              <Layout>
                <LazyPage><LessonsPage /></LazyPage>
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/calendar"
          element={
            isAuthenticated ? (
              <Navigate to="/lessons" replace />
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/payments"
          element={
            isAuthenticated ? (
              <Layout>
                <LazyPage><PaymentsPage /></LazyPage>
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/teacher/schedule"
          element={
            isAuthenticated ? (
              <Layout>
                <LazyPage><TeacherSchedulePage /></LazyPage>
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/settings"
          element={
            isAuthenticated ? (
              useAuthStore.getState().user?.role === 'ADMIN' || useAuthStore.getState().user?.role === 'MANAGER' ? (
                <Layout>
                  <LazyPage><SettingsPage /></LazyPage>
                </Layout>
              ) : (
                <Navigate to="/dashboard" />
              )
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/debtors"
          element={
            isAuthenticated ? (
              <Layout>
                <LazyPage><DebtorsPage /></LazyPage>
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/reports"
          element={
            isAuthenticated ? (
              <Layout>
                <LazyPage><ReportsPage /></LazyPage>
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/settings/notifications"
          element={
            isAuthenticated ? (
              <Layout>
                <LazyPage><NotificationSettingsPage /></LazyPage>
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        {/* Catch-all route - redirect unknown paths */}
        <Route
          path="*"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
