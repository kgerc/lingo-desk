import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './stores/authStore'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import StudentsPage from './pages/StudentsPage'
import TeachersPage from './pages/TeachersPage'
import CoursesPage from './pages/CoursesPage'
import CourseTypesPage from './pages/CourseTypesPage'
import GroupsPage from './pages/GroupsPage'
import MaterialsPage from './pages/MaterialsPage'
import LessonsPage from './pages/LessonsPage'
import PaymentsPage from './pages/PaymentsPage'
import AlertsPage from './pages/AlertsPage'
import TeacherSchedulePage from './pages/TeacherSchedulePage'
import TeacherAvailabilityPage from './pages/TeacherAvailabilityPage'
import SettingsPage from './pages/SettingsPage'
import DebtorsPage from './pages/DebtorsPage'
import NotificationSettingsPage from './pages/NotificationSettingsPage'
import Layout from './components/Layout'

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
          element={isAuthenticated ? <Navigate to="/dashboard" /> : <LoginPage />}
        />
        <Route
          path="/register"
          element={isAuthenticated ? <Navigate to="/dashboard" /> : <RegisterPage />}
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
                <DashboardPage />
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
                <AlertsPage />
              </Layout>
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
                <StudentsPage />
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
                <TeachersPage />
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
                <CoursesPage />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/course-types"
          element={
            isAuthenticated ? (
              useAuthStore.getState().user?.role === 'ADMIN' || useAuthStore.getState().user?.role === 'MANAGER' ? (
                <Layout>
                  <CourseTypesPage />
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
                <GroupsPage />
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
                <MaterialsPage />
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
                <LessonsPage />
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
                <PaymentsPage />
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
                <TeacherSchedulePage />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        <Route
          path="/teacher/availability"
          element={
            isAuthenticated ? (
              <Layout>
                <TeacherAvailabilityPage />
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
                  <SettingsPage />
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
                <DebtorsPage />
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
                <NotificationSettingsPage />
              </Layout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
