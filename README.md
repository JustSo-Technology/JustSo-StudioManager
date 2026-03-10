# JustSo. Studio Manager

Tenant workspace backend for bookings, services, spaces, inventory, calendars, branded public booking pages, OTP guest booking, admin email operations, and Authentik-backed login.

This README assumes you are deploying onto a brand new Ubuntu VM and want to get from `git clone` to a working web app with:

- Node.js 20
- Docker
- PostgreSQL in Docker
- Authentik as the identity provider
- a production build running under `systemd`
- optional Cloudflared exposure

## What This App Requires

- Ubuntu 22.04 or 24.04 VM
- a non-root deploy user
- Node.js 20+
- npm
- Docker Engine
- PostgreSQL
- Authentik OIDC application credentials
- a DNS/reverse-proxy or tunnel strategy for the app URL

The app does not manage passwords itself anymore. Human users authenticate through Authentik. The app keeps local authorization state for:

- platform admin role
- workspaces
- workspace memberships
- app-owned invites

## Quick Bootstrap

Run the included bootstrap script as your app user:

```bash
chmod +x script/bootstrap-ubuntu.sh
./script/bootstrap-ubuntu.sh
```

What it does:

- installs base packages
- installs Docker if missing
- adds the current user to the `docker` group
- installs Node.js 20 if missing

If the script adds your user to the `docker` group, log out and back in once before continuing.

## 1. Create the App User

If you do not already have a dedicated app user:

```bash
sudo adduser --disabled-password --gecos "" studiomanager
sudo usermod -aG sudo studiomanager
```

Then switch to that user:

```bash
su - studiomanager
```

If you want passwordless sudo during initial setup:

```bash
echo 'studiomanager ALL=(ALL) NOPASSWD:ALL' | sudo tee /etc/sudoers.d/studiomanager
sudo chmod 440 /etc/sudoers.d/studiomanager
```

## 2. Clone the Repo

```bash
git clone <YOUR_GIT_REMOTE> JustSo-StudioManager
cd JustSo-StudioManager
```

## 3. Install System Dependencies

```bash
./script/bootstrap-ubuntu.sh
```

Confirm:

```bash
node --version
npm --version
docker --version
```

## 4. Confirm Port 5001 Is Free

The app is commonly run on `5001`.

Check it:

```bash
ss -ltnp | grep ':5001'
```

If nothing returns, the port is free.

## 5. Start PostgreSQL in Docker

Create a durable directory:

```bash
mkdir -p ~/docker-data/studiomanager-postgres
```

Start Postgres bound to localhost only:

```bash
docker run -d \
  --name studiomanager-postgres \
  --restart unless-stopped \
  -e POSTGRES_DB=studiomanager \
  -e POSTGRES_USER=studiomanager \
  -e POSTGRES_PASSWORD='change-this-db-password' \
  -p 127.0.0.1:5432:5432 \
  -v ~/docker-data/studiomanager-postgres:/var/lib/postgresql/data \
  postgres:16
```

Check it:

```bash
docker ps
docker logs studiomanager-postgres
```

Your app `DATABASE_URL` will look like:

```bash
postgresql://studiomanager:change-this-db-password@127.0.0.1:5432/studiomanager
```

## 6. Set Up Authentik

You have two realistic options:

- use an existing Authentik instance
- run Authentik separately on this VM or another VM

This app only needs Authentik as an OIDC provider. It does not need SCIM or group sync for v1.

### Authentik objects you need

Create these in Authentik:

1. An application for Studio Manager
2. An OAuth2/OIDC provider for that application
3. Login/enrollment flows as desired
4. Redirect URIs for your final public app URL

Use these conceptual settings:

- client type: confidential
- grant type: authorization code
- scopes: `openid profile email`
- redirect URI:
  - `https://your-app-domain.example/api/auth/callback`
- post logout redirect URI:
  - `https://your-app-domain.example/`

You will need:

- issuer URL
- client ID
- client secret

Example values:

- `AUTH_ISSUER_URL=https://sm-auth.justso.cloud/application/o/studio-manager/`
- `AUTH_CLIENT_ID=<from Authentik>`
- `AUTH_CLIENT_SECRET=<from Authentik>`
- `AUTH_REDIRECT_URI=https://studiomanager.justso.cloud/api/auth/callback`
- `AUTH_LOGOUT_REDIRECT_URI=https://studiomanager.justso.cloud/`

### First admin bootstrap

The app can automatically promote the first admin by email. Set:

```bash
AUTH_BOOTSTRAP_ADMIN_EMAILS=owner@example.com
```

If unset, the first successful Authentik login becomes admin automatically.

## 7. Create the App Environment File

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL=postgresql://studiomanager:change-this-db-password@127.0.0.1:5432/studiomanager
SESSION_SECRET=replace-with-a-long-random-secret
EMAIL_SETTINGS_ENCRYPTION_KEY=replace-with-a-long-random-secret

AUTH_ISSUER_URL=https://auth.example.com/application/o/studio-manager/
AUTH_CLIENT_ID=replace-me
AUTH_CLIENT_SECRET=replace-me
AUTH_REDIRECT_URI=https://studiomanager.example.com/api/auth/callback
AUTH_LOGOUT_REDIRECT_URI=https://studiomanager.example.com/
AUTH_SCOPE=openid profile email
AUTH_BOOTSTRAP_ADMIN_EMAILS=owner@example.com

PORT=5001
GOOGLE_MAPS_API_KEY=
```

Generate strong secrets:

```bash
openssl rand -base64 48
```

Use separate values for:

- `SESSION_SECRET`
- `EMAIL_SETTINGS_ENCRYPTION_KEY`

## 8. Install App Dependencies

```bash
npm install
```

## 9. Push the Database Schema

The app and session store both rely on Postgres schema being present.

```bash
set -a
source .env
set +a

npm run db:push
```

If `DATABASE_URL` is missing or wrong, this step will fail.

## 10. Build the App

```bash
npm run check
npm run build
```

## 11. Test It Locally First

Run the production server directly:

```bash
set -a
source .env
set +a

NODE_ENV=production npm start
```

In another terminal:

```bash
curl -I http://127.0.0.1:5001/
```

You should get `HTTP/1.1 200 OK`.

Stop it once confirmed.

## 12. Run It Under systemd

Copy the example unit:

```bash
sudo cp ops/studiomanager.service.example /etc/systemd/system/studiomanager.service
```

Edit it if your path or user differs:

```bash
sudo nano /etc/systemd/system/studiomanager.service
```

Recommended final unit:

```ini
[Unit]
Description=JustSo Studio Manager
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=studiomanager
WorkingDirectory=/home/studiomanager/JustSo-StudioManager
EnvironmentFile=/home/studiomanager/JustSo-StudioManager/.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now studiomanager
```

Check it:

```bash
sudo systemctl status studiomanager
sudo journalctl -u studiomanager -f
```

## 13. Optional: Expose Through Cloudflared

If you are exposing through a Cloudflare Tunnel and pointing `studiomanager.justso.cloud` to the local app:

- local service URL: `http://localhost:5001`
- public hostname: `https://studiomanager.justso.cloud`

Important:

- your Authentik redirect/logout URLs must use the public hostname, not `localhost`
- the app itself can still listen only on the VM

## 14. First Login and First Workspace

After deployment:

1. Open the app URL
2. Click `Sign in with Authentik`
3. Sign in as the bootstrap admin
4. Create the first workspace
5. Go to `Workspace Access`
6. Create invites for tenant users
7. Tenant users sign in through Authentik and join the invited workspace

## 15. Email Delivery Setup

The app supports SMTP-backed:

- OTP booking verification emails
- booking confirmations
- booking cancellations
- reminders

After your admin account is working:

1. go to `Email Settings`
2. add SMTP credentials
3. send a test email
4. enable email sending

Without SMTP config, OTPs and booking emails will fail explicitly.

## 16. Common Admin Tasks

Restart app:

```bash
sudo systemctl restart studiomanager
```

Tail app logs:

```bash
sudo journalctl -u studiomanager -f
```

Check Postgres logs:

```bash
docker logs -f studiomanager-postgres
```

Rebuild after pulling updates:

```bash
git pull
npm install
set -a
source .env
set +a
npm run db:push
npm run build
sudo systemctl restart studiomanager
```

## Environment Variables

Required:

- `DATABASE_URL`
- `SESSION_SECRET`
- `EMAIL_SETTINGS_ENCRYPTION_KEY`
- `AUTH_ISSUER_URL`
- `AUTH_CLIENT_ID`
- `AUTH_CLIENT_SECRET`
- `AUTH_REDIRECT_URI`
- `AUTH_LOGOUT_REDIRECT_URI`

Recommended:

- `AUTH_SCOPE=openid profile email`
- `AUTH_BOOTSTRAP_ADMIN_EMAILS=owner@example.com`
- `PORT=5001`

Optional:

- `GOOGLE_MAPS_API_KEY`

## Architecture Notes

- frontend: React + Vite + TanStack Query + Tailwind + Wouter
- backend: Express
- ORM: Drizzle
- sessions: `express-session` + `connect-pg-simple`
- database: PostgreSQL
- auth: Authentik OIDC
- email: SMTP via Nodemailer
- public booking verification: email OTP

## Notes on Ownership and Identity

The current app model is:

- `User` = person identity, authenticated by Authentik
- `Workspace` = tenant business/brand
- `Admin` = platform-level app role
- `Space` = bookable room/resource inside a workspace

The app keeps local authorization state. Authentik is the identity provider, not the source of workspace permissions.

## Known Setup Pitfalls

- `npm run db:push` fails if `DATABASE_URL` is not exported into the current shell
- Authentik login fails if the public redirect URI does not exactly match the configured provider callback
- logout feels broken if `AUTH_LOGOUT_REDIRECT_URI` is wrong
- the first admin will not be predictable if you leave `AUTH_BOOTSTRAP_ADMIN_EMAILS` empty and multiple people sign in early
- if Docker was just installed, you may need to log out and back in before `docker` works without sudo
