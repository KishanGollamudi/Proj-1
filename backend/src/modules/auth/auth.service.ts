import { UserRole, VerificationStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/app-error.js';
import {
  signAccessToken,
  signEmailVerificationToken,
  signRefreshToken,
  signResetPasswordToken,
  verifyJwt
} from '../../utils/jwt.js';
import { emailService, EmailService } from '../email/email.service.js';

interface RegisterInput {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}

interface LoginInput {
  email: string;
  password: string;
}

export class AuthService {
  constructor(private readonly mailer: EmailService = emailService) {}

  async register(input: RegisterInput): Promise<{ accessToken: string; refreshToken: string }> {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });

    if (existing) {
      throw new AppError('Email is already registered', 409);
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({
      data: {
        email: input.email,
        fullName: input.name,
        passwordHash,
        role: input.role
      }
    });

    const baseUser = { userId: user.id, email: user.email, role: user.role };
    const accessToken = signAccessToken(baseUser);
    const refreshToken = signRefreshToken(baseUser);
    const verifyToken = signEmailVerificationToken(baseUser);

    await Promise.all([
      this.mailer.sendWelcomeEmail(user.email, user.fullName),
      this.mailer.sendVerificationEmail(user.email, verifyToken)
    ]);

    return { accessToken, refreshToken };
  }

  async login(input: LoginInput): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await prisma.user.findUnique({ where: { email: input.email } });

    if (!user?.passwordHash) {
      throw new AppError('Invalid credentials', 401);
    }

    const passwordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!passwordValid) {
      throw new AppError('Invalid credentials', 401);
    }

    const baseUser = { userId: user.id, email: user.email, role: user.role };
    return {
      accessToken: signAccessToken(baseUser),
      refreshToken: signRefreshToken(baseUser)
    };
  }

  async verifyEmail(token: string): Promise<void> {
    const payload = verifyJwt(token);

    if (payload.type !== 'verify-email') {
      throw new AppError('Invalid verification token', 400);
    }

    await prisma.user.update({
      where: { id: payload.userId },
      data: { verificationStatus: VerificationStatus.VERIFIED }
    });
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return;
    }

    const resetToken = signResetPasswordToken({ userId: user.id, email: user.email, role: user.role });
    await this.mailer.sendPasswordReset(user.email, resetToken);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const payload = verifyJwt(token);

    if (payload.type !== 'reset-password') {
      throw new AppError('Invalid reset token', 400);
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: payload.userId },
      data: { passwordHash }
    });
  }

  refreshToken(refreshToken: string): { accessToken: string; refreshToken: string } {
    const payload = verifyJwt(refreshToken);

    if (payload.type !== 'refresh') {
      throw new AppError('Invalid refresh token', 401);
    }

    const baseUser = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role
    };

    return {
      accessToken: signAccessToken(baseUser),
      refreshToken: signRefreshToken(baseUser)
    };
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        avatarUrl: true,
        role: true,
        verificationStatus: true,
        createdAt: true
      }
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  }
}

export const authService = new AuthService();
