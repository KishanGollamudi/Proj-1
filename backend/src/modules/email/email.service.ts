import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export class EmailService {
  private transporter =
    env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS
      ? nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_PORT === 465,
          auth: {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS
          }
        })
      : null;

  async send(payload: EmailPayload): Promise<void> {
    if (!this.transporter) {
      logger.info('Email transport not configured; skipping email', payload);
      return;
    }

    await this.transporter.sendMail({
      from: env.EMAIL_FROM ?? 'no-reply@snapmatch.app',
      ...payload
    });
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    await this.send({
      to,
      subject: 'Welcome to SnapMatch',
      html: `<p>Hi ${name},</p><p>Welcome to SnapMatch. Your account is ready.</p>`
    });
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const verifyUrl = `${env.APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
    await this.send({
      to,
      subject: 'Verify your email',
      html: `<p>Please verify your account by clicking <a href="${verifyUrl}">here</a>.</p>`
    });
  }

  async sendBookingConfirmation(to: string, bookingId: string): Promise<void> {
    await this.send({
      to,
      subject: 'Booking confirmation',
      html: `<p>Your booking <strong>${bookingId}</strong> has been created.</p>`
    });
  }

  async sendPaymentReceived(to: string, bookingId: string): Promise<void> {
    await this.send({
      to,
      subject: 'Payment received',
      html: `<p>Payment has been received for booking <strong>${bookingId}</strong>.</p>`
    });
  }

  async sendBookingReminder(to: string, bookingId: string): Promise<void> {
    await this.send({
      to,
      subject: 'Booking reminder',
      html: `<p>Reminder: your booking <strong>${bookingId}</strong> is coming up soon.</p>`
    });
  }

  async sendPasswordReset(to: string, token: string): Promise<void> {
    const resetUrl = `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
    await this.send({
      to,
      subject: 'Reset your password',
      html: `<p>Reset your password by clicking <a href="${resetUrl}">this link</a>.</p>`
    });
  }
}

export const emailService = new EmailService();
