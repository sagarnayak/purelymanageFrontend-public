# PurelyManage Frontend

The web UI for PurelyManage, a self-hosted admin panel for PurelyMail. Built with React, TypeScript, and Vite.

The backend repo is at [purelymanageBackend-public](https://github.com/sagarnayak/purelymanageBackend-public). You need the backend running before the frontend is useful.

**Blog series:** [How PurelyManage was built](https://blog.hardcodeconsulting.tech/post/purelymanage-intro/) - 11 posts covering the architecture, security model, DNS monitoring, IMAP migrations, and deployment.

## Prerequisites

- Node.js 18 or later
- The PurelyManage backend running and accessible over HTTPS

## Setup

Clone the repo and install dependencies:

```bash
git clone https://github.com/sagarnayak/purelymanageFrontend-public.git
cd purelymanageFrontend-public
npm install
```

Create a `.env` file:

```bash
VITE_API_URL=https://api.yourdomain.com
```

Replace `https://api.yourdomain.com` with the URL where your backend is running.

## Development

```bash
npm run dev
```

Opens on `http://localhost:5173`. API requests proxy to the backend via Vite's dev proxy, so set `VITE_API_URL` to your backend URL.

## Production

Build the static files:

```bash
npm run build
```

This produces a `dist/` folder. Serve it from any static host: nginx, S3 with CloudFront, Netlify, or anything that can serve a single-page app.

If you use nginx, point 404s back to `index.html` so React Router handles client-side navigation:

```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    root /path/to/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## First Launch

Open the frontend URL in your browser. On a fresh install with no accounts, you will be redirected to `/setup` to create the first owner account. After that, login is at `/login`.
