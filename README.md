# JustSo. Studio Manager

!! NOT READY FOR PRODUCTION YET !!

Booking, services, and inventory management for a creative studio workspace.

## Stack

- React + Vite
- Express
- PostgreSQL
- Drizzle ORM
- Session auth with demo login

## Prerequisites

- Node.js 20+
- PostgreSQL

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a local env file:

```bash
cp .env.example .env
```

3. Set required values in `.env`:

- `DATABASE_URL`
- `SESSION_SECRET`

4. Push the schema to your database:

```bash
npm run db:push
```

This app stores sessions in PostgreSQL, so the schema must exist before login works.

## Development

```bash
npm run dev
```

The app serves the API and frontend from the same process. Default port is `5000`.

## Production

```bash
npm run build
npm start
```

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string. Required.
- `SESSION_SECRET` - Secret used by `express-session`. Required.
- `PORT` - Server port. Optional. Defaults to `5000`.
- `GOOGLE_MAPS_API_KEY` - Enables Places autocomplete for external service locations. Optional.

## Auth Notes

- The current app uses demo session auth via `POST /api/login-demo`.
- `POST /api/public/signup` does not create real accounts yet. It redirects users back to the home screen to use the existing sign-in flow.
