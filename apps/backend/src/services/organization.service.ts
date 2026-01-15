import prisma from '../utils/prisma';

export interface UpdateOrganizationData {
  name?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  taxId?: string;
  description?: string;
  logoUrl?: string;
  primaryColor?: string;
  timezone?: string;
  currency?: string;
  country?: string;
}

export interface CreateOrganizationData extends UpdateOrganizationData {
  name: string;
  slug: string;
}

export interface UpdateOrganizationSettingsData {
  lessonReminderHours?: number;
  budgetAlertThresholdHours?: number;
  autoGenerateLessonsEnabled?: boolean;
  settings?: Record<string, any>;
}

class OrganizationService {
  async getOrganizationById(id: string) {
    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        settings: true,
      },
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    return organization;
  }

  async getUserOrganizations(userId: string) {
    const userOrganizations = await prisma.userOrganization.findMany({
      where: {
        userId,
        isActive: true,
      },
      include: {
        organization: {
          include: {
            settings: true,
          },
        },
      },
      orderBy: [
        { isPrimary: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    return userOrganizations;
  }

  async updateOrganization(id: string, data: UpdateOrganizationData, userId: string) {
    // Verify user has permission to update this organization (ADMIN or MANAGER)
    const userOrg = await prisma.userOrganization.findFirst({
      where: {
        userId,
        organizationId: id,
        role: {
          in: ['ADMIN', 'MANAGER'],
        },
      },
    });

    if (!userOrg) {
      throw new Error('You do not have permission to update this organization');
    }

    const organization = await prisma.organization.update({
      where: { id },
      data,
      include: {
        settings: true,
      },
    });

    return organization;
  }

  async createOrganization(data: CreateOrganizationData, userId: string) {
    // Create organization
    const organization = await prisma.organization.create({
      data: {
        name: data.name,
        slug: data.slug,
        address: data.address,
        city: data.city,
        postalCode: data.postalCode,
        phone: data.phone,
        email: data.email,
        website: data.website,
        taxId: data.taxId,
        description: data.description,
        logoUrl: data.logoUrl,
        primaryColor: data.primaryColor,
        timezone: data.timezone,
        currency: data.currency,
        country: data.country,
      },
      include: {
        settings: true,
      },
    });

    // Add user as MANAGER to this organization
    await prisma.userOrganization.create({
      data: {
        userId,
        organizationId: organization.id,
        role: 'MANAGER',
        isPrimary: false,
      },
    });

    // Create default organization settings
    await prisma.organizationSettings.create({
      data: {
        organizationId: organization.id,
      },
    });

    return organization;
  }

  async switchOrganization(userId: string, organizationId: string) {
    // Verify user has access to this organization
    const userOrg = await prisma.userOrganization.findFirst({
      where: {
        userId,
        organizationId,
        isActive: true,
      },
      include: {
        organization: {
          include: {
            settings: true,
          },
        },
      },
    });

    if (!userOrg) {
      throw new Error('You do not have access to this organization');
    }

    // Set all user organizations as non-primary
    await prisma.userOrganization.updateMany({
      where: { userId },
      data: { isPrimary: false },
    });

    // Set selected organization as primary
    await prisma.userOrganization.update({
      where: {
        id: userOrg.id,
      },
      data: { isPrimary: true },
    });

    // Also update user's primary organizationId
    await prisma.user.update({
      where: { id: userId },
      data: { organizationId },
    });

    return userOrg;
  }

  async addUserToOrganization(
    organizationId: string,
    userId: string,
    role: 'ADMIN' | 'MANAGER' | 'TEACHER' | 'STUDENT' | 'PARENT',
    requestingUserId: string
  ) {
    // Verify requesting user has permission (ADMIN or MANAGER)
    const requestingUserOrg = await prisma.userOrganization.findFirst({
      where: {
        userId: requestingUserId,
        organizationId,
        role: {
          in: ['ADMIN', 'MANAGER'],
        },
      },
    });

    if (!requestingUserOrg) {
      throw new Error('You do not have permission to add users to this organization');
    }

    // Check if user is already in organization
    const existingUserOrg = await prisma.userOrganization.findFirst({
      where: {
        userId,
        organizationId,
      },
    });

    if (existingUserOrg) {
      // If exists but inactive, reactivate
      if (!existingUserOrg.isActive) {
        return await prisma.userOrganization.update({
          where: { id: existingUserOrg.id },
          data: {
            isActive: true,
            role,
          },
        });
      }
      throw new Error('User is already in this organization');
    }

    // Add user to organization
    const userOrg = await prisma.userOrganization.create({
      data: {
        userId,
        organizationId,
        role,
        isPrimary: false,
      },
    });

    return userOrg;
  }

  async removeUserFromOrganization(
    organizationId: string,
    userId: string,
    requestingUserId: string
  ) {
    // Verify requesting user has permission (ADMIN or MANAGER)
    const requestingUserOrg = await prisma.userOrganization.findFirst({
      where: {
        userId: requestingUserId,
        organizationId,
        role: {
          in: ['ADMIN', 'MANAGER'],
        },
      },
    });

    if (!requestingUserOrg) {
      throw new Error('You do not have permission to remove users from this organization');
    }

    // Find user organization
    const userOrg = await prisma.userOrganization.findFirst({
      where: {
        userId,
        organizationId,
      },
    });

    if (!userOrg) {
      throw new Error('User is not in this organization');
    }

    // Soft delete - set as inactive
    await prisma.userOrganization.update({
      where: { id: userOrg.id },
      data: { isActive: false },
    });

    return { success: true };
  }

  async updateOrganizationSettings(
    organizationId: string,
    data: UpdateOrganizationSettingsData,
    userId: string
  ) {
    // Verify user has permission to update settings (ADMIN or MANAGER)
    const userOrg = await prisma.userOrganization.findFirst({
      where: {
        userId,
        organizationId,
        role: {
          in: ['ADMIN', 'MANAGER'],
        },
      },
    });

    if (!userOrg) {
      throw new Error('You do not have permission to update organization settings');
    }

    // Upsert organization settings
    const settings = await prisma.organizationSettings.upsert({
      where: { organizationId },
      create: {
        organizationId,
        ...data,
      },
      update: data,
    });

    return settings;
  }
}

export const organizationService = new OrganizationService();
