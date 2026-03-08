import crypto from 'crypto';

// Mock email service - in production, integrate with SendGrid, AWS SES, etc.
export class EmailService {
  async sendVerificationCode(email: string, code: string): Promise<boolean> {
    // In production, replace with actual email service
    console.log(`[EMAIL] Verification code for ${email}: ${code}`);
    // Simulate sending email
    return true;
  }

  generateCode(): string {
    return crypto.randomInt(100000, 999999).toString();
  }
}

export const emailService = new EmailService();
