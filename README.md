# CentralBV Backend

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

The server listens on `http://localhost:3000` by default (or the port set in `PORT`).
