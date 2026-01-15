import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';
import { UserRole } from '@prisma/client';

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName?: string;
  role?: UserRole;
}

interface LoginData {
  email: string;
  password: string;
}

export class AuthService {
  private readonly JWT_SECRET: string;
  private readonly JWT_EXPIRES_IN: string;

  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
  }

  async register(data: RegisterData) {
    const { email, password, firstName, lastName, organizationName, role } = data;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Default role is MANAGER (not ADMIN)
    const userRole = role || UserRole.MANAGER;

    // Use transaction to ensure all entities are created together
    const result = await prisma.$transaction(async (tx) => {
      // Create organization (always created during registration)
      const organization = await tx.organization.create({
        data: {
          name: organizationName || `${firstName}'s School`,
          slug: this.generateSlug(organizationName || `${firstName}'s School`),
        },
      });

      // Create default organization settings
      await tx.organizationSettings.create({
        data: {
          organizationId: organization.id,
        },
      });

      // Create user with MANAGER role by default
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          organizationId: organization.id,
          role: userRole,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          organizationId: true,
        },
      });

      // Create UserOrganization link (for multi-org support)
      await tx.userOrganization.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: userRole,
        },
      });

      // Create user profile
      await tx.userProfile.create({
        data: {
          userId: user.id,
        },
      });

      return user;
    });

    // Generate token
    const token = this.generateToken(result);

    return {
      user: result,
      token,
    };
  }

  async login(data: LoginData) {
    const { email, password } = data;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate token
    const token = this.generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
      },
      token,
    };
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatarUrl: true,
        role: true,
        organizationId: true,
        isActive: true,
        createdAt: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            primaryColor: true,
            timezone: true,
            currency: true,
          },
        },
        profile: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  private generateToken(payload: {
    id: string;
    email: string;
    role: UserRole;
    organizationId: string;
  }): string {
    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN,
    });
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      + '-' + Math.random().toString(36).substring(2, 8);
  }
}

export default new AuthService();
