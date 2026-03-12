import { UserRole } from '@prisma/client';
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  role: z.nativeEnum(UserRole).default(UserRole.CUSTOMER)
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1)
});

export const forgotPasswordSchema = z.object({
  email: z.string().email()
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8)
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1)
});
