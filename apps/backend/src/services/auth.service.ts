import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../utils/prisma';
import { UserRole } from '@prisma/client';
import emailService from './email.service';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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

    // Account has no password (Google-only)
    if (!user.passwordHash) {
      throw new Error('To konto używa logowania przez Google. Użyj przycisku „Zaloguj przez Google".');
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

    // Record login in student history (only for STUDENT role)
    if (user.role === 'STUDENT') {
      const student = await prisma.student.findFirst({
        where: { userId: user.id, organizationId: user.organizationId },
        select: { id: true, organizationId: true },
      });
      if (student) {
        await prisma.studentLoginHistory.create({
          data: {
            studentId: student.id,
            organizationId: student.organizationId,
          },
        }).catch(() => {
          // Non-critical: don't fail login if history write fails
        });
      }
    }

    // Generate token
    const token = this.generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    });

    // Fetch full user with organization (same shape as getMe)
    const fullUser = await this.getMe(user.id);

    return {
      user: fullUser,
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

  async googleAuth(idToken: string) {
    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload) throw new Error('Nieprawidłowy token Google');

    const { sub: googleId, email, given_name: firstName, family_name: lastName, email_verified, picture: avatarUrl } = payload;

    if (!email) throw new Error('Konto Google nie ma powiązanego adresu email');
    if (!email_verified) throw new Error('Adres email w koncie Google nie jest zweryfikowany');

    // Case 1: user with this googleId exists → login
    let user = await prisma.user.findUnique({ where: { googleId } });

    if (user) {
      if (!user.isActive) throw new Error('Konto jest dezaktywowane');
      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      const fullUser = await this.getMe(user.id);
      return { user: fullUser, token: this.generateToken({ id: user.id, email: user.email, role: user.role, organizationId: user.organizationId }) };
    }

    // Case 2: user with same email exists → link Google to existing account
    const existingByEmail = await prisma.user.findUnique({ where: { email } });

    if (existingByEmail) {
      if (!existingByEmail.isActive) throw new Error('Konto jest dezaktywowane');
      user = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: { googleId, avatarUrl: existingByEmail.avatarUrl || avatarUrl || null, lastLoginAt: new Date() },
      });
      const fullUser = await this.getMe(user.id);
      return { user: fullUser, token: this.generateToken({ id: user.id, email: user.email, role: user.role, organizationId: user.organizationId }), linked: true };
    }

    // Case 3: new user → register with Google
    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: `${firstName || email}'s School`,
          slug: this.generateSlug(`${firstName || email}'s School`),
        },
      });
      await tx.organizationSettings.create({ data: { organizationId: organization.id } });

      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash: null,
          googleId,
          firstName: firstName || email.split('@')[0],
          lastName: lastName || '',
          avatarUrl: avatarUrl || null,
          organizationId: organization.id,
          role: UserRole.MANAGER,
        },
        select: { id: true, email: true, firstName: true, lastName: true, role: true, organizationId: true },
      });

      await tx.userOrganization.create({
        data: { userId: newUser.id, organizationId: organization.id, role: UserRole.MANAGER },
      });
      await tx.userProfile.create({ data: { userId: newUser.id } });

      return newUser;
    });

    const fullUser = await this.getMe(result.id);
    return {
      user: fullUser,
      token: this.generateToken({ id: result.id, email: result.email, role: result.role, organizationId: result.organizationId }),
    };
  }

  private generateToken(payload: {
    id: string;
    email: string;
    role: UserRole;
    organizationId: string;
  }): string {
    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN as any,
    });
  }

  async forgotPassword(email: string) {
    // Always return success — never reveal whether email exists
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) return;

    // Invalidate any previous unused tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });

    const organization = await prisma.organization.findUnique({ where: { id: user.organizationId } });

    await emailService.sendPasswordResetLink({
      to: user.email,
      firstName: user.firstName,
      organizationName: organization?.name || 'LingoDesk',
      token,
    });
  }

  async resetPassword(token: string, newPassword: string) {
    const record = await prisma.passwordResetToken.findUnique({ where: { token } });

    if (!record) {
      throw new Error('Token jest nieprawidłowy lub wygasł. Wygeneruj nowy link resetujący.');
    }

    if (record.usedAt) {
      throw new Error('Token został już użyty. Wygeneruj nowy link resetujący.');
    }

    if (record.expiresAt < new Date()) {
      throw new Error('Token wygasł. Wygeneruj nowy link resetujący.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);
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
