import crypto from "crypto";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import type { Booking, EmailSettings } from "@shared/schema";
import { decryptSecret } from "./crypto";
import { storage } from "./storage";

interface MailContext {
  tenantDisplayName: string;
  resourceLabel: string;
  booking: Booking;
}

type EmailTemplate = {
  subject: string;
  text: string;
  html: string;
};

function formatBookingRange(booking: Booking) {
  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);
  return `${start.toLocaleString()} to ${end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function buildVerificationTemplate(tenantDisplayName: string, code: string): EmailTemplate {
  return {
    subject: `${tenantDisplayName}: your verification code`,
    text: `Use this verification code to confirm your booking request with ${tenantDisplayName}: ${code}\n\nThe code expires in 10 minutes.`,
    html: `<p>Use this verification code to confirm your booking request with <strong>${tenantDisplayName}</strong>:</p><p style="font-size:24px;font-weight:700;letter-spacing:0.12em">${code}</p><p>The code expires in 10 minutes.</p>`,
  };
}

function buildConfirmationTemplate(context: MailContext): EmailTemplate {
  return {
    subject: `${context.tenantDisplayName}: booking confirmed`,
    text: `Your booking is confirmed.\n\nStudio: ${context.tenantDisplayName}\nBooking: ${context.resourceLabel}\nTime: ${formatBookingRange(context.booking)}\n${context.booking.notes ? `Notes: ${context.booking.notes}\n` : ""}`,
    html: `<p>Your booking is confirmed.</p><p><strong>Studio:</strong> ${context.tenantDisplayName}<br /><strong>Booking:</strong> ${context.resourceLabel}<br /><strong>Time:</strong> ${formatBookingRange(context.booking)}</p>${context.booking.notes ? `<p><strong>Notes:</strong> ${context.booking.notes}</p>` : ""}`,
  };
}

function buildCancellationTemplate(context: MailContext): EmailTemplate {
  return {
    subject: `${context.tenantDisplayName}: booking cancelled`,
    text: `Your booking has been cancelled.\n\nStudio: ${context.tenantDisplayName}\nBooking: ${context.resourceLabel}\nTime: ${formatBookingRange(context.booking)}`,
    html: `<p>Your booking has been cancelled.</p><p><strong>Studio:</strong> ${context.tenantDisplayName}<br /><strong>Booking:</strong> ${context.resourceLabel}<br /><strong>Time:</strong> ${formatBookingRange(context.booking)}</p>`,
  };
}

function buildReminderTemplate(context: MailContext): EmailTemplate {
  return {
    subject: `${context.tenantDisplayName}: booking reminder`,
    text: `Reminder: you have an upcoming booking.\n\nStudio: ${context.tenantDisplayName}\nBooking: ${context.resourceLabel}\nTime: ${formatBookingRange(context.booking)}`,
    html: `<p>Reminder: you have an upcoming booking.</p><p><strong>Studio:</strong> ${context.tenantDisplayName}<br /><strong>Booking:</strong> ${context.resourceLabel}<br /><strong>Time:</strong> ${formatBookingRange(context.booking)}</p>`,
  };
}

function buildTestTemplate(): EmailTemplate {
  return {
    subject: "JustSo. email settings test",
    text: "This is a test email from the JustSo. admin email settings screen. Your SMTP configuration is working.",
    html: "<p>This is a test email from the <strong>JustSo.</strong> admin email settings screen.</p><p>Your SMTP configuration is working.</p>",
  };
}

export class EmailConfigurationError extends Error {}

export class EmailService {
  generateCode() {
    return crypto.randomInt(100000, 999999).toString();
  }

  getDecryptedPassword(settings: EmailSettings) {
    return decryptSecret(settings.smtpPasswordEncrypted);
  }

  async getMaskedSettings() {
    const settings = await storage.getEmailSettings();
    if (!settings) {
      return null;
    }

    return {
      ...settings,
      smtpPasswordEncrypted: settings.smtpPasswordEncrypted ? "•••• saved" : "",
    };
  }

  private async getConfiguredSettings() {
    const settings = await storage.getEmailSettings();
    if (!settings || !settings.enabled) {
      throw new EmailConfigurationError("Admin email settings are not configured or are disabled.");
    }

    return {
      ...settings,
      smtpPassword: this.getDecryptedPassword(settings),
    };
  }

  private createTransport(settings: EmailSettings & { smtpPassword: string }) {
    const secure = settings.securityMode === "ssl";
    const options: SMTPTransport.Options = {
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure,
      auth: {
        user: settings.smtpUsername,
        pass: settings.smtpPassword,
      },
    };

    if (settings.securityMode === "none") {
      options.ignoreTLS = true;
    }

    return nodemailer.createTransport(options);
  }

  async verifyTransport(settingsOverride?: EmailSettings & { smtpPassword: string }) {
    const settings = settingsOverride || (await this.getConfiguredSettings());
    const transport = this.createTransport(settings);
    await transport.verify();
  }

  private async sendTemplate(to: string, template: EmailTemplate, settingsOverride?: EmailSettings & { smtpPassword: string }) {
    const settings = settingsOverride || (await this.getConfiguredSettings());
    const transport = this.createTransport(settings);
    await transport.sendMail({
      from: `"${settings.fromName}" <${settings.fromEmail}>`,
      to,
      replyTo: settings.replyToEmail || undefined,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
  }

  async sendVerificationCode(email: string, code: string, tenantDisplayName: string) {
    await this.sendTemplate(email, buildVerificationTemplate(tenantDisplayName, code));
  }

  async sendTestEmail(email: string) {
    await this.sendTemplate(email, buildTestTemplate());
  }

  async sendBookingConfirmation(email: string, context: MailContext) {
    await this.sendTemplate(email, buildConfirmationTemplate(context));
  }

  async sendBookingCancellation(email: string, context: MailContext) {
    await this.sendTemplate(email, buildCancellationTemplate(context));
  }

  async sendBookingReminder(email: string, context: MailContext) {
    await this.sendTemplate(email, buildReminderTemplate(context));
  }
}

export const emailService = new EmailService();
