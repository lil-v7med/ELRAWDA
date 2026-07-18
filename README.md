# ELRAWDA Email Delivery Integration Guide

This guide explains how the email delivery system is structured, how to configure environment variables, switch between providers, and troubleshoot delivery issues.

---

## 1. Required Environment Variables

All configuration is managed through environment variables. Copy the `.env.example` template to `.env` in the root of the project:

```env
# App Configuration
NODE_ENV=development
APP_NAME=ELRAWDA
APP_URL=http://localhost:3000

# Email Delivery Configuration
# Supported values: resend, smtp, sendgrid, mailgun, debug
EMAIL_PROVIDER=resend
EMAIL_FROM=ELRAWDA <noreply@yourdomain.com>

# Resend API Key
RESEND_API_KEY=re_your_api_key_here
```

> [!WARNING]
> Do not check the `.env` file into Git. It is automatically ignored in `.gitignore`.

---

## 2. How to Configure Resend

To use the Resend provider in production:

1. **Sign Up**: Create an account at [resend.com](https://resend.com).
2. **API Key**: Generate a new API Key from your dashboard and paste it into the `RESEND_API_KEY` field in `.env`.
3. **Verify Domain**: 
   - Add your domain to the Resend dashboard.
   - Configure the required DNS records (SPF, DKIM, MX) in your DNS provider (e.g., Cloudflare, Namecheap) to verify ownership and authorize email sending.
4. **Sender Email**: Set `EMAIL_FROM` to an email address using your verified domain (e.g., `ELRAWDA <noreply@yourdomain.com>`).
   - *Note*: During testing (when not using a verified domain), you can set `EMAIL_FROM` to `onboarding@resend.dev` and send to your registered account email.

---

## 3. How to Switch Email Providers

You can switch the email provider at any time by updating the `EMAIL_PROVIDER` variable in `.env`:

* **`debug`**: Writes the generated HTML emails to `emails_debug.html` in the project root. Useful for local development and inspecting layouts.
* **`resend`**: Dispatches real emails through the Resend API using the official Node.js SDK.
* **`smtp`**: Legacy SMTP server delivery. Requires setting `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS`.
* **`sendgrid`** / **`mailgun`**: Future extension stubs.

If `EMAIL_PROVIDER` is not specified:
- If `NODE_ENV=production`, it defaults to `resend`.
- Otherwise, it defaults to `debug`.

---

## 4. Development vs. Production Behavior

### Development Mode (`NODE_ENV=development`)
- Uses the `DebugFileEmailProvider` by default.
- Generated emails are saved as `emails_debug.html`. Open it in any browser to inspect the visual rendering of the email.
- Any configuration setup issues (e.g., missing API key) log a warning but **do not crash the server on startup**.

### Production Mode (`NODE_ENV=production`)
- Uses the `ResendEmailProvider` by default.
- **Fail-Fast Validation**: The server validates environment variables at startup. If `RESEND_API_KEY` or `EMAIL_FROM` is missing or invalid, the server logs a critical error and exits immediately to prevent running in a misconfigured state.
- **Reliability Checks**: Real delivery is wrapped with a **10-second timeout** and an automatic **one-time retry** for temporary failures (network errors, rate-limiting, or server issues).
- **Security**: Raw API errors and connection issues are caught and logged securely. The client only receives a generic `Failed to send verification email` error to prevent exposing internal keys or infrastructure details.

---

## 5. Troubleshooting Delivery Issues

### Server crashes at startup
- **Cause**: Missing or invalid `RESEND_API_KEY` or `EMAIL_FROM` while running in production mode (`NODE_ENV=production`).
- **Solution**: Set the environment variables in `.env` or run in development mode (`NODE_ENV=development`).

### "Failed to send verification email" error in browser
- Check the server console logs for `Password reset email failed.` followed by specific debug info:
  - **Unverified domain error**: Verify that the domain in `EMAIL_FROM` is verified on your Resend dashboard.
  - **401 Unauthorized**: Ensure your `RESEND_API_KEY` is active and correct.
  - **429 Rate Limit**: The retry mechanism automatically handles temporary rate limits, but if it persist, verify if your Resend plan permits your request frequency.
  - **Network Timeout / Connection Refused**: Verify the server has internet access and can connect to the Resend API endpoint (`api.resend.com`).
