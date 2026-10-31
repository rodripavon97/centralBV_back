# CentralBV Backend
[![Build NestJS APP](https://github.com/rodripavon97/centralBV_back/actions/workflows/ci.yml/badge.svg)](https://github.com/rodripavon97/centralBV_back/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/rodripavon97/centralBV_back/branch/develop/graph/badge.svg?token=LBHU24T6H1)](https://codecov.io/gh/rodripavon97/centralBV_back)



API backend for **CentralBV**, built with [NestJS](https://nestjs.com) and [Supabase](https://supabase.com).

## Requirements

- Node.js 20+
- [pnpm](https://pnpm.io)

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Copy [`.env.example`](.env.example) to `.env` and fill in your values:

```bash
cp .env.example .env
```

## Run

```bash
# development (watch mode)
pnpm run start:dev

# production
pnpm run build
pnpm run start:prod
```

Run the test suite with coverage:

```bash
pnpm run test:cov
```

The server listens on `http://localhost:3000` by default (or the port set in `PORT`).

## Password recovery

`POST /auth/forgot-password` generates a single-use Supabase recovery link and emails it to the user. The link points to `PASSWORD_RESET_REDIRECT_URL`; the frontend then sends the access token to `POST /auth/reset-password`.

The link validity is **not** controlled by the API. Configure it in the Supabase dashboard:

1. **Authentication → Providers → Email → Email OTP Expiration**: set `7200` seconds (2 hours).
2. **Authentication → URL Configuration → Redirect URLs**: add the exact URL used in `PASSWORD_RESET_REDIRECT_URL` (for example `http://localhost:5173/update-password`). Without it, Supabase falls back to the Site URL.
3. **Authentication → Rate Limits**: adjust the email/OTP limits if needed.

Notes:

- Supabase issues a new recovery token on every request and invalidates the previous one, so only the latest link works.
- Once used, the token cannot be reused; `POST /auth/reset-password` then returns a "link expired or already used" error.
- Keep the "expires in 2 hours" text in `src/mail/templates/welcome-email.template.ts` in sync if you change the Supabase setting.

Security hardening:

- Rate limits: `forgot-password` allows 3 requests/min per IP and `reset-password` 5/min (global default: 100/min). Set `TRUST_PROXY=true` when the API runs behind a proxy/CDN so the real client IP is used.
- `reset-password` only accepts access tokens whose `amr` claim comes from an email link (`recovery`, `otp` or `magiclink`). A token from a normal password login is rejected.
- Before changing the password, all of the user's sessions are revoked with `auth.admin.signOut(recoveryToken, 'global')` (the recovery token is a valid user JWT). Supabase also revokes every session when an admin updates a password, so this is a best-effort extra guarantee.
