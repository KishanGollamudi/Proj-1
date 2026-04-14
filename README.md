# SnapMatch Local Run

This repository snapshot was missing its original workspace manifests and runtime scaffolding. It has been rebuilt into a runnable demo baseline with:

- `frontend/apps/customer`: Next.js customer app
- `backend`: Express + Socket.IO mock API compatible with the customer flows
- `packages/shared`: shared UI helpers used by the app

## Install

```bash
npm install
```

## Local development

In one terminal:

```bash
npm run dev:backend
```

In another terminal:

```bash
npm run dev:customer
```

Open `http://localhost:3000`.

## Demo login

Use any non-empty email and password on `/login`.

- `customer@example.com` logs in as a customer
- `creator@example.com` logs in as a creator
- `editor@example.com` logs in as an editor
- `admin@example.com` logs in as an admin

## Build for deployment

```bash
npm run build
```

Then start production services separately:

```bash
npm run start --workspace @snapmatch/backend
npm run start --workspace @snapmatch/customer
```
