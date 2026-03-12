import { UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { AuthService } from './auth.service.js';

jest.mock('../../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    }
  }
}));

describe('AuthService', () => {
  const mockMailer = {
    sendWelcomeEmail: jest.fn(),
    sendVerificationEmail: jest.fn(),
    sendPasswordReset: jest.fn()
  } as any;

  const service = new AuthService(mockMailer);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers a new user and returns tokens', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockResolvedValue({
      id: '2df3cf46-a3a3-44e3-a1bf-dc01f5d616f4',
      email: 'new@snapmatch.app',
      fullName: 'New User',
      role: UserRole.CUSTOMER
    });

    const result = await service.register({
      email: 'new@snapmatch.app',
      password: 'very-strong-pass',
      name: 'New User',
      role: UserRole.CUSTOMER
    });

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(mockMailer.sendWelcomeEmail).toHaveBeenCalledTimes(1);
    expect(mockMailer.sendVerificationEmail).toHaveBeenCalledTimes(1);
  });

  it('throws conflict when email already exists', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' });

    await expect(
      service.register({
        email: 'taken@snapmatch.app',
        password: 'very-strong-pass',
        name: 'Taken',
        role: UserRole.CUSTOMER
      })
    ).rejects.toBeInstanceOf(AppError);
  });
});
