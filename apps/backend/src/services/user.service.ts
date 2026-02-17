import { UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import prisma from '../utils/prisma';
import emailService from './email.service';
import { ASSIGNABLE_ROLES, ROLE_HIERARCHY } from '../config/permissions';

export interface CreateUserData {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone?: string;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  role?: UserRole;
  isActive?: boolean;
}

export interface UserFilters {
  role?: UserRole;
  isActive?: boolean;
  search?: string;
}

class UserService {
  /**
   * Get all users in an organization with optional filters
   */
  async getUsers(organizationId: string, filters?: UserFilters) {
    const where: any = {
      organizationId,
    };

    if (filters?.role) {
      where.role = filters.role;
    } else {
      // Exclude STUDENT and PARENT - they are managed in dedicated modules
      where.role = { notIn: ['STUDENT', 'PARENT'] };
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        avatarUrl: true,
      },
      orderBy: [
        { isActive: 'desc' },
        { lastName: 'asc' },
        { firstName: 'asc' },
      ],
    });

    return users;
  }

  /**
   * Get a user by ID
   */
  async getUserById(userId: string, organizationId: string) {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        avatarUrl: true,
        profile: {
          select: {
            dateOfBirth: true,
            address: true,
            notes: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  /**
   * Invite a new user to the organization
   * Creates user with temporary password and sends invitation email
   */
  async inviteUser(organizationId: string, data: CreateUserData, _invitedBy: string) {
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error('Użytkownik z tym adresem email już istnieje');
    }

    // Validate role
    if (!ASSIGNABLE_ROLES.includes(data.role) && data.role !== 'ADMIN') {
      throw new Error('Nieprawidłowa rola użytkownika');
    }

    // Generate temporary password
    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        organizationId,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: data.role,
        passwordHash,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Get organization name for email
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });

    // Send invitation email with temporary password
    try {
      await emailService.sendUserInvitation({
        to: data.email,
        firstName: data.firstName,
        organizationName: organization?.name || 'LingoDesk',
        temporaryPassword,
        role: data.role,
      });
    } catch (error) {
      console.error('Failed to send invitation email:', error);
      // Don't fail the whole operation, user is created
    }

    return user;
  }

  /**
   * Update a user's details
   */
  async updateUser(
    userId: string,
    organizationId: string,
    data: UpdateUserData,
    updatedBy: { id: string; role: UserRole }
  ) {
    // Get current user data
    const currentUser = await prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
      },
    });

    if (!currentUser) {
      throw new Error('User not found');
    }

    // Check if trying to change role
    if (data.role && data.role !== currentUser.role) {
      // Cannot change own role
      if (userId === updatedBy.id) {
        throw new Error('Nie możesz zmienić własnej roli');
      }

      // Check role hierarchy - can only modify users with lower rank
      const updaterRank = ROLE_HIERARCHY[updatedBy.role];
      const targetCurrentRank = ROLE_HIERARCHY[currentUser.role];
      const targetNewRank = ROLE_HIERARCHY[data.role];

      if (targetCurrentRank >= updaterRank || targetNewRank >= updaterRank) {
        throw new Error('Nie masz uprawnień do zmiany tej roli');
      }

      // Validate new role is assignable
      if (!ASSIGNABLE_ROLES.includes(data.role) && data.role !== 'ADMIN') {
        throw new Error('Nieprawidłowa rola użytkownika');
      }
    }

    // Cannot deactivate yourself
    if (data.isActive === false && userId === updatedBy.id) {
      throw new Error('Nie możesz dezaktywować własnego konta');
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: data.role,
        isActive: data.isActive,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updatedUser;
  }

  /**
   * Deactivate a user (soft delete)
   */
  async deactivateUser(userId: string, organizationId: string, deactivatedBy: { id: string; role: UserRole }) {
    // Cannot deactivate yourself
    if (userId === deactivatedBy.id) {
      throw new Error('Nie możesz dezaktywować własnego konta');
    }

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check role hierarchy
    const deactivatorRank = ROLE_HIERARCHY[deactivatedBy.role];
    const targetRank = ROLE_HIERARCHY[user.role];

    if (targetRank >= deactivatorRank) {
      throw new Error('Nie masz uprawnień do dezaktywacji tego użytkownika');
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });

    return updatedUser;
  }

  /**
   * Reactivate a user
   */
  async reactivateUser(userId: string, organizationId: string) {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });

    return updatedUser;
  }

  /**
   * Reset user password and send new temporary password
   */
  async resetUserPassword(userId: string, organizationId: string) {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Generate new temporary password
    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Get organization name for email
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });

    // Send password reset email
    await emailService.sendPasswordReset({
      to: user.email,
      firstName: user.firstName,
      organizationName: organization?.name || 'LingoDesk',
      temporaryPassword,
    });

    return { success: true };
  }

  /**
   * Generate a secure temporary password
   */
  private generateTemporaryPassword(): string {
    // Generate 12-character password with mixed case, numbers and special chars
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    const randomBytes = crypto.randomBytes(12);
    for (let i = 0; i < 12; i++) {
      password += chars[randomBytes[i] % chars.length];
    }
    return password;
  }

  /**
   * Get user statistics for dashboard
   */
  async getUserStats(organizationId: string) {
    // Exclude STUDENT and PARENT - they are managed in dedicated modules
    const staffFilter = { organizationId, role: { notIn: ['STUDENT', 'PARENT'] as UserRole[] } };

    const [total, active, byRole] = await Promise.all([
      prisma.user.count({ where: staffFilter }),
      prisma.user.count({ where: { ...staffFilter, isActive: true } }),
      prisma.user.groupBy({
        by: ['role'],
        where: staffFilter,
        _count: true,
      }),
    ]);

    return {
      total,
      active,
      inactive: total - active,
      byRole: byRole.reduce(
        (acc, item) => {
          acc[item.role] = item._count;
          return acc;
        },
        {} as Record<UserRole, number>
      ),
    };
  }
}

export default new UserService();
