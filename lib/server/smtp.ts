import 'server-only';
import nodemailer from 'nodemailer';

/** SMTP-Versand (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE, MAIL_FROM). */
export const smtpConfigured = () => Boolean(process.env.SMTP_HOST && process.env.MAIL_FROM);

export function smtpTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' } : undefined,
  });
}

/** Absender mit eigenem Anzeigenamen, Adresse aus MAIL_FROM. */
export function mailFrom(name?: string) {
  const from = process.env.MAIL_FROM!;
  const address = from.match(/<([^>]+)>/)?.[1] || from;
  return name ? { name, address } : from;
}
