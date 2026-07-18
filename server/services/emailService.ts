import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Resend } from 'resend';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Generic Email Provider Interface
export interface EmailProvider {
  send(to: string, subject: string, html: string): Promise<void>;
}

// Email format validation helper (supporting name-addr formats like "ELRAWDA <noreply@yourdomain.com>")
export function isValidEmail(email: string): boolean {
  if (!email) return false;
  const nameEmailRegex = /^[^<>@\s]+.*<([^\s@]+@[^\s@]+\.[^\s@]+)>$/;
  const match = email.match(nameEmailRegex);
  if (match) {
    return true;
  }
  const simpleEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return simpleEmailRegex.test(email.trim());
}

// -------------------------------------------------------------------------
// HTML Email Layout & Decoupled Architecture
// -------------------------------------------------------------------------

export interface BaseEmailLayoutOptions {
  title: string;
  brandName?: string;
  brandSubtitle?: string;
  recipientEmail: string;
  bodyHtml: string;
}

export function generateBaseLayout(options: BaseEmailLayoutOptions): string {
  const brandName = options.brandName || process.env.APP_NAME || 'ELRAWDA';
  const brandSubtitle = options.brandSubtitle || 'Wealth Management';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f8fafc;
      color: #334155;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 40px 20px;
      box-sizing: border-box;
    }
    .container {
      max-width: 500px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
      padding: 32px 24px;
      text-align: center;
    }
    .logo-container {
      display: inline-flex;
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background-color: rgba(255, 255, 255, 0.2);
      align-items: center;
      justify-content: center;
      margin-bottom: 12px;
      font-family: 'Poppins', sans-serif;
      font-weight: bold;
      font-size: 24px;
      color: #ffffff;
    }
    .brand-name {
      color: #ffffff;
      margin: 0;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 0.5px;
    }
    .brand-subtitle {
      color: #e0e7ff;
      margin: 4px 0 0 0;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      font-weight: 600;
    }
    .content {
      padding: 32px 24px;
    }
    h2 {
      color: #1e293b;
      margin-top: 0;
      font-size: 20px;
      font-weight: 700;
      line-height: 1.3;
    }
    p {
      font-size: 14px;
      line-height: 1.6;
      color: #475569;
      margin: 0 0 16px 0;
    }
    .code-card {
      background-color: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      margin: 24px 0;
    }
    .code-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #64748b;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .code-value {
      font-family: Menlo, Monaco, Consolas, 'Courier New', monospace;
      font-size: 32px;
      font-weight: 800;
      color: #1e293b;
      letter-spacing: 6px;
      margin: 0;
    }
    .security-notice {
      background-color: #fffaf0;
      border: 1px solid #feebc8;
      border-radius: 10px;
      padding: 16px;
      margin-top: 24px;
    }
    .security-title {
      font-size: 12px;
      font-weight: 700;
      color: #dd6b20;
      margin: 0 0 4px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .security-text {
      font-size: 12px;
      line-height: 1.5;
      color: #7b341e;
      margin: 0;
    }
    .footer {
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 24px;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
      line-height: 1.5;
    }
    .footer a {
      color: #3b82f6;
      text-decoration: none;
    }
    .footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo-container">${brandName.charAt(0)}</div>
        <h1 class="brand-name">${brandName}</h1>
        <div class="brand-subtitle">${brandSubtitle}</div>
      </div>
      <div class="content">
        ${options.bodyHtml}
      </div>
      <div class="footer">
        &copy; 2026 ${brandName} Wealth Management. All rights reserved.<br>
        This email was sent to ${options.recipientEmail} as part of your active security flow.
      </div>
    </div>
  </div>
</body>
</html>
`;
}

export interface EmailTemplate {
  subject: string;
  html: string;
}

export function generatePasswordResetEmail(email: string, code: string): EmailTemplate {
  const appName = process.env.APP_NAME || 'ELRAWDA';
  const bodyHtml = `
    <h2>Reset Your Password</h2>
    <p>Hello,</p>
    <p>We received a request to recover your family wealth console account password for <strong>${email}</strong>.</p>
    
    <div class="code-card">
      <div class="code-label">Verification Code</div>
      <div class="code-value">${code}</div>
    </div>
    
    <p>This code expires in <strong>10 minutes</strong> and can only be used once.</p>
    
    <div class="security-notice">
      <h3 class="security-title">Security Warning</h3>
      <p class="security-text">Never share this code with anyone. Our support team will never ask you for this verification code. If you did not make this request, you can safely ignore this email.</p>
    </div>
  `;

  return {
    subject: `Reset Your Password - ${appName}`,
    html: generateBaseLayout({
      title: 'Reset Your Password',
      recipientEmail: email,
      bodyHtml
    })
  };
}

// -------------------------------------------------------------------------
// Reliability & Error Handling Helpers
// -------------------------------------------------------------------------

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Email timeout occurred')), timeoutMs)
    )
  ]);
}

function isTemporaryError(error: any): boolean {
  if (!error) return false;
  const message = (error.message || '').toLowerCase();
  
  if (message.includes('timeout') || message.includes('timed out')) {
    return true;
  }
  
  const networkErrorCodes = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED'];
  if (error.code && networkErrorCodes.includes(error.code)) {
    return true;
  }
  
  const status = error.statusCode || error.status || (error.error && error.error.statusCode);
  if (status === 429 || (status >= 500 && status < 600)) {
    return true;
  }
  
  return false;
}

async function sendWithRetry<T>(fn: () => Promise<T>, maxRetries = 1): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await withTimeout(fn(), 10000); // 10s timeout
    } catch (error: any) {
      attempt++;
      if (attempt > maxRetries || !isTemporaryError(error)) {
        throw error;
      }
      console.warn(`Retry attempt executed. Error: ${error.message}. Retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// -------------------------------------------------------------------------
// Concrete Email Providers
// -------------------------------------------------------------------------

// Local Debug Provider
export class DebugFileEmailProvider implements EmailProvider {
  private debugFilePath: string;

  constructor() {
    this.debugFilePath = path.resolve(__dirname, '../../emails_debug.html');
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    await fs.writeFile(this.debugFilePath, html, 'utf8');
    console.log(`Email written to emails_debug.html`);
  }
}

// Resend Production Provider
export class ResendEmailProvider implements EmailProvider {
  private resend: Resend;
  private from: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.EMAIL_FROM;

    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not defined.');
    }
    if (!fromEmail) {
      throw new Error('EMAIL_FROM is not defined.');
    }

    this.resend = new Resend(apiKey);
    this.from = fromEmail;
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    if (!isValidEmail(this.from)) {
      throw new Error(`Invalid sender email address (EMAIL_FROM): ${this.from}`);
    }
    if (!isValidEmail(to)) {
      throw new Error(`Invalid recipient email address (to): ${to}`);
    }

    try {
      await sendWithRetry(async () => {
        const { data, error } = await this.resend.emails.send({
          from: this.from,
          to: [to],
          subject: subject,
          html: html,
        });

        if (error) {
          throw Object.assign(new Error(error.message || 'Unknown Resend error'), {
            statusCode: (error as any).statusCode || (error as any).status
          });
        }
        return data;
      });

      console.log('Password reset email sent successfully.');
    } catch (err: any) {
      console.error('Password reset email failed. Debug info:', err);
      // Mask internal errors to protect backend details/keys from client leak
      throw new Error('Failed to send verification email. Please try again later.');
    }
  }
}

// SMTP Provider Stub
export class SmtpEmailProvider implements EmailProvider {
  constructor(private config: any) {}
  async send(to: string, subject: string, html: string): Promise<void> {
    console.log(`[SMTP PROVIDER] Email would be sent to ${to} using host: ${this.config.host}`);
  }
}

// SendGrid Provider Stub
export class SendgridEmailProvider implements EmailProvider {
  async send(to: string, subject: string, html: string): Promise<void> {
    console.log(`[SENDGRID PROVIDER] Email would be sent to ${to} with subject: ${subject}`);
  }
}

// Mailgun Provider Stub
export class MailgunEmailProvider implements EmailProvider {
  async send(to: string, subject: string, html: string): Promise<void> {
    console.log(`[MAILGUN PROVIDER] Email would be sent to ${to} with subject: ${subject}`);
  }
}

// -------------------------------------------------------------------------
// Startup Validation & Manager
// -------------------------------------------------------------------------

export function validateEmailConfig(): void {
  if (process.env.NODE_ENV === 'production') {
    const configuredProvider = process.env.EMAIL_PROVIDER;
    const providerType = configuredProvider ? configuredProvider.toLowerCase().trim() : 'resend';

    if (providerType === 'resend') {
      if (!process.env.RESEND_API_KEY) {
        console.error('CRITICAL STARTUP ERROR: RESEND_API_KEY environment variable is missing.');
        process.exit(1);
      }
      if (!process.env.EMAIL_FROM) {
        console.error('CRITICAL STARTUP ERROR: EMAIL_FROM environment variable is missing.');
        process.exit(1);
      }
      if (!isValidEmail(process.env.EMAIL_FROM)) {
        console.error(`CRITICAL STARTUP ERROR: EMAIL_FROM address "${process.env.EMAIL_FROM}" is invalid.`);
        process.exit(1);
      }
    } else if (providerType === 'smtp') {
      if (!process.env.SMTP_HOST) {
        console.error('CRITICAL STARTUP ERROR: SMTP_HOST environment variable is missing.');
        process.exit(1);
      }
    } else if (providerType !== 'debug' && providerType !== 'sendgrid' && providerType !== 'mailgun') {
      console.error(`CRITICAL STARTUP ERROR: Unsupported email provider "${providerType}" requested in production.`);
      process.exit(1);
    }
  }
}

function getEmailProvider(): EmailProvider {
  const configuredProvider = process.env.EMAIL_PROVIDER;
  const isProduction = process.env.NODE_ENV === 'production';

  let providerType = 'debug';
  if (configuredProvider) {
    providerType = configuredProvider.toLowerCase().trim();
  } else if (isProduction) {
    providerType = 'resend';
  }

  let provider: EmailProvider;
  switch (providerType) {
    case 'resend':
      provider = new ResendEmailProvider();
      break;
    case 'smtp':
      provider = new SmtpEmailProvider({
        host: process.env.SMTP_HOST || '',
        port: Number(process.env.SMTP_PORT) || 587,
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      });
      break;
    case 'sendgrid':
      provider = new SendgridEmailProvider();
      break;
    case 'mailgun':
      provider = new MailgunEmailProvider();
      break;
    case 'debug':
    default:
      provider = new DebugFileEmailProvider();
      break;
  }

  console.log(`Email provider initialized. Selected provider: ${providerType}`);
  return provider;
}

// Mailer Service Singleton Interface
class EmailService {
  private provider!: EmailProvider;

  constructor() {
    try {
      this.provider = getEmailProvider();
    } catch (err: any) {
      // In development, handle setup error gracefully so the server doesn't crash on boot
      if (process.env.NODE_ENV === 'production') {
        console.error('CRITICAL ERROR: Failed to construct email provider in production:', err.message);
        process.exit(1);
      } else {
        console.warn('Warning: Failed to construct email provider in development:', err.message);
        // Fallback to debug provider in development if setup fails
        this.provider = new DebugFileEmailProvider();
      }
    }
  }

  // Allow dynamic replacement of provider in tests or advanced setups
  setProvider(provider: EmailProvider) {
    this.provider = provider;
  }

  async sendResetEmail(to: string, code: string): Promise<void> {
    const template = generatePasswordResetEmail(to, code);
    await this.provider.send(to, template.subject, template.html);
  }
}

export const emailService = new EmailService();
