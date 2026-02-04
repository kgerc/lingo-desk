import { UserRole } from '@prisma/client';

/**
 * Permission definitions for the application
 * Each permission represents an action that can be performed
 */
export const PERMISSIONS = {
  // User management
  USERS_VIEW: 'users:view',
  USERS_CREATE: 'users:create',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',
  USERS_MANAGE_ROLES: 'users:manage_roles',

  // Students
  STUDENTS_VIEW: 'students:view',
  STUDENTS_CREATE: 'students:create',
  STUDENTS_UPDATE: 'students:update',
  STUDENTS_DELETE: 'students:delete',

  // Teachers
  TEACHERS_VIEW: 'teachers:view',
  TEACHERS_CREATE: 'teachers:create',
  TEACHERS_UPDATE: 'teachers:update',
  TEACHERS_DELETE: 'teachers:delete',

  // Courses
  COURSES_VIEW: 'courses:view',
  COURSES_CREATE: 'courses:create',
  COURSES_UPDATE: 'courses:update',
  COURSES_DELETE: 'courses:delete',

  // Lessons
  LESSONS_VIEW: 'lessons:view',
  LESSONS_CREATE: 'lessons:create',
  LESSONS_UPDATE: 'lessons:update',
  LESSONS_DELETE: 'lessons:delete',

  // Materials
  MATERIALS_VIEW: 'materials:view',
  MATERIALS_CREATE: 'materials:create',
  MATERIALS_UPDATE: 'materials:update',
  MATERIALS_DELETE: 'materials:delete',

  // Payments
  PAYMENTS_VIEW: 'payments:view',
  PAYMENTS_CREATE: 'payments:create',
  PAYMENTS_UPDATE: 'payments:update',
  PAYMENTS_DELETE: 'payments:delete',
  PAYMENTS_SEND_REMINDER: 'payments:send_reminder',

  // Teacher payouts
  PAYOUTS_VIEW: 'payouts:view',
  PAYOUTS_CREATE: 'payouts:create',
  PAYOUTS_UPDATE: 'payouts:update',
  PAYOUTS_APPROVE: 'payouts:approve',

  // Reports
  REPORTS_VIEW: 'reports:view',
  REPORTS_FINANCIAL: 'reports:financial',

  // Settings
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_UPDATE: 'settings:update',

  // Alerts
  ALERTS_VIEW: 'alerts:view',

  // Mailing
  MAILING_VIEW: 'mailing:view',
  MAILING_SEND: 'mailing:send',

  // Debtors
  DEBTORS_VIEW: 'debtors:view',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Role-based permission matrix
 * Defines which permissions each role has
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  // ADMIN - full access to everything
  ADMIN: Object.values(PERMISSIONS),

  // MANAGER - full access except some admin-only features
  MANAGER: [
    // Users
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_CREATE,
    PERMISSIONS.USERS_UPDATE,
    PERMISSIONS.USERS_DELETE,
    PERMISSIONS.USERS_MANAGE_ROLES,
    // Students
    PERMISSIONS.STUDENTS_VIEW,
    PERMISSIONS.STUDENTS_CREATE,
    PERMISSIONS.STUDENTS_UPDATE,
    PERMISSIONS.STUDENTS_DELETE,
    // Teachers
    PERMISSIONS.TEACHERS_VIEW,
    PERMISSIONS.TEACHERS_CREATE,
    PERMISSIONS.TEACHERS_UPDATE,
    PERMISSIONS.TEACHERS_DELETE,
    // Courses
    PERMISSIONS.COURSES_VIEW,
    PERMISSIONS.COURSES_CREATE,
    PERMISSIONS.COURSES_UPDATE,
    PERMISSIONS.COURSES_DELETE,
    // Lessons
    PERMISSIONS.LESSONS_VIEW,
    PERMISSIONS.LESSONS_CREATE,
    PERMISSIONS.LESSONS_UPDATE,
    PERMISSIONS.LESSONS_DELETE,
    // Materials
    PERMISSIONS.MATERIALS_VIEW,
    PERMISSIONS.MATERIALS_CREATE,
    PERMISSIONS.MATERIALS_UPDATE,
    PERMISSIONS.MATERIALS_DELETE,
    // Payments
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.PAYMENTS_CREATE,
    PERMISSIONS.PAYMENTS_UPDATE,
    PERMISSIONS.PAYMENTS_DELETE,
    PERMISSIONS.PAYMENTS_SEND_REMINDER,
    // Payouts
    PERMISSIONS.PAYOUTS_VIEW,
    PERMISSIONS.PAYOUTS_CREATE,
    PERMISSIONS.PAYOUTS_UPDATE,
    PERMISSIONS.PAYOUTS_APPROVE,
    // Reports
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_FINANCIAL,
    // Settings
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SETTINGS_UPDATE,
    // Alerts
    PERMISSIONS.ALERTS_VIEW,
    // Mailing
    PERMISSIONS.MAILING_VIEW,
    PERMISSIONS.MAILING_SEND,
    // Debtors
    PERMISSIONS.DEBTORS_VIEW,
  ],

  // HR (Kadrowy) - payments, teacher payouts, finance view
  HR: [
    // Students (view only for context)
    PERMISSIONS.STUDENTS_VIEW,
    // Teachers (view for payouts context)
    PERMISSIONS.TEACHERS_VIEW,
    // Payments - full access
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.PAYMENTS_CREATE,
    PERMISSIONS.PAYMENTS_UPDATE,
    PERMISSIONS.PAYMENTS_DELETE,
    PERMISSIONS.PAYMENTS_SEND_REMINDER,
    // Payouts - full access
    PERMISSIONS.PAYOUTS_VIEW,
    PERMISSIONS.PAYOUTS_CREATE,
    PERMISSIONS.PAYOUTS_UPDATE,
    PERMISSIONS.PAYOUTS_APPROVE,
    // Reports - financial only
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_FINANCIAL,
    // Debtors
    PERMISSIONS.DEBTORS_VIEW,
    // Alerts (for payment-related alerts)
    PERMISSIONS.ALERTS_VIEW,
  ],

  // METHODOLOGIST (Metodyk) - courses, lessons, materials view
  METHODOLOGIST: [
    // Students (view for course context)
    PERMISSIONS.STUDENTS_VIEW,
    // Teachers (view for course assignment)
    PERMISSIONS.TEACHERS_VIEW,
    // Courses - full access
    PERMISSIONS.COURSES_VIEW,
    PERMISSIONS.COURSES_CREATE,
    PERMISSIONS.COURSES_UPDATE,
    PERMISSIONS.COURSES_DELETE,
    // Lessons - full access
    PERMISSIONS.LESSONS_VIEW,
    PERMISSIONS.LESSONS_CREATE,
    PERMISSIONS.LESSONS_UPDATE,
    PERMISSIONS.LESSONS_DELETE,
    // Materials - full access
    PERMISSIONS.MATERIALS_VIEW,
    PERMISSIONS.MATERIALS_CREATE,
    PERMISSIONS.MATERIALS_UPDATE,
    PERMISSIONS.MATERIALS_DELETE,
    // Reports (educational reports)
    PERMISSIONS.REPORTS_VIEW,
    // Alerts
    PERMISSIONS.ALERTS_VIEW,
  ],

  // TEACHER - limited access to own data
  TEACHER: [
    PERMISSIONS.STUDENTS_VIEW,
    PERMISSIONS.COURSES_VIEW,
    PERMISSIONS.LESSONS_VIEW,
    PERMISSIONS.LESSONS_UPDATE, // Can update own lessons
    PERMISSIONS.MATERIALS_VIEW,
    PERMISSIONS.ALERTS_VIEW,
  ],

  // STUDENT - minimal access
  STUDENT: [
    PERMISSIONS.COURSES_VIEW,
    PERMISSIONS.LESSONS_VIEW,
    PERMISSIONS.MATERIALS_VIEW,
    PERMISSIONS.PAYMENTS_VIEW, // Own payments only
  ],

  // PARENT - access to children's data
  PARENT: [
    PERMISSIONS.STUDENTS_VIEW, // Own children only
    PERMISSIONS.COURSES_VIEW,
    PERMISSIONS.LESSONS_VIEW,
    PERMISSIONS.PAYMENTS_VIEW,
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every((permission) => hasPermission(role, permission));
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Role hierarchy for display purposes
 * Higher number = more privileges
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  ADMIN: 100,
  MANAGER: 90,
  HR: 50,
  METHODOLOGIST: 50,
  TEACHER: 30,
  STUDENT: 10,
  PARENT: 10,
};

/**
 * Polish role names for display
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrator',
  MANAGER: 'Manager',
  HR: 'Kadrowy',
  METHODOLOGIST: 'Metodyk',
  TEACHER: 'Lektor',
  STUDENT: 'Uczeń',
  PARENT: 'Rodzic',
};

/**
 * Role descriptions for display
 */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  ADMIN: 'Pełny dostęp do wszystkich funkcji systemu',
  MANAGER: 'Zarządzanie szkołą, uczniami, lektorami i kursami',
  HR: 'Dostęp do płatności, wypłat lektorów i raportów finansowych',
  METHODOLOGIST: 'Dostęp do kursów, lekcji i materiałów dydaktycznych',
  TEACHER: 'Prowadzenie lekcji i dostęp do materiałów',
  STUDENT: 'Dostęp do własnych kursów i lekcji',
  PARENT: 'Dostęp do danych dzieci',
};

/**
 * Get roles that can manage users (for dropdown filters etc.)
 */
export const STAFF_ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'HR', 'METHODOLOGIST', 'TEACHER'];

/**
 * Roles that can be assigned by managers
 */
export const ASSIGNABLE_ROLES: UserRole[] = ['MANAGER', 'HR', 'METHODOLOGIST', 'TEACHER'];
