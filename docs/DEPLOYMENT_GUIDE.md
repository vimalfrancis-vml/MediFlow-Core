# MediFlow Production Deployment & Operations Guide

This guide provides a comprehensive roadmap for deploying MediFlow to production cloud infrastructure or on-premise hospital data centers.

---

## 1. Production Architecture Overview

MediFlow is built using a modern decoupled client-server architecture:

```
+-------------------------------------------------------------------------------+
|                             CLIENT TIER (HTTPS)                               |
|   Hosted on Vercel / Cloudflare Pages / AWS S3 + CloudFront / Nginx           |
|   - Static SPA Bundle (React 18 + Vite + Tailwind CSS)                        |
|   - Global CDN Distribution with SSL Termination                              |
+-------------------------------------------------------------------------------+
                                      │  REST API (JSON / Multipart HTTPS)
                                      ▼
+-------------------------------------------------------------------------------+
|                             SERVER TIER (Node.js)                             |
|   Hosted on Railway / Render / AWS ECS / DigitalOcean App Platform / VPS      |
|   - Express.js 5 Application Server with Winston Logger                       |
|   - JWT Token Authentication & RBAC Policy Enforcement                        |
|   - Magic-Byte File Validation & Local / S3 Upload Directory                  |
+-------------------------------------------------------------------------------+
                                      │  Prisma / TLS Connection Pooling
                                      ▼
+-------------------------------------------------------------------------------+
|                            DATABASE TIER (PostgreSQL)                         |
|   Hosted on Neon Serverless Postgres / AWS RDS / Managed PostgreSQL           |
|   - PostgreSQL 15+ with Automated Backups                                     |
|   - Prisma Migration Engine with Schema Versioning                            |
+-------------------------------------------------------------------------------+
```

---

## 2. Environment Variables Specification

### 2.1 Backend Server (`server/.env`)

```ini
# ==============================================================================
# DATABASE CONFIGURATION
# ==============================================================================
# Connection string to PostgreSQL instance (Neon, Supabase, AWS RDS, or local)
DATABASE_URL="postgresql://user:password@ep-sample-pooler.neon.tech/mediflow_db?sslmode=require"

# ==============================================================================
# APPLICATION RUNTIME
# ==============================================================================
# Port for the Express server to listen on
PORT=5000

# Environment mode: 'development' | 'production' | 'test'
NODE_ENV=production

# ==============================================================================
# SECURITY & AUTHENTICATION
# ==============================================================================
# High-entropy secret key for HMAC-SHA256 JWT token generation (min 32 chars)
JWT_SECRET=b49c7f3e82d1a09562ef087a1d3c9b84e720fa392185c67e91402ba847df61e0
JWT_EXPIRES_IN=1d

# ==============================================================================
# CORS CONFIGURATION (Optional in development, mandatory in production)
# ==============================================================================
# Comma-separated list of allowed origin domains
ALLOWED_ORIGINS="https://mediflow.hospital.org,https://mediflow-portal.vercel.app"

# ==============================================================================
# UPLOADS CONFIGURATION (Optional)
# ==============================================================================
# Custom upload directory path (defaults to ./uploads)
UPLOAD_DIR="./uploads"
```

### 2.2 Frontend Client (`client/.env.production`)

```ini
# Base URL pointing to the deployed backend Express API
VITE_API_BASE_URL="https://api-mediflow.hospital.org"
```

---

## 3. Step-by-Step Deployment Procedures

### Option A: Cloud PaaS (Recommended: Vercel + Railway / Render + Neon)

#### 1. Database Provisioning (Neon PostgreSQL)
1. Create a serverless PostgreSQL database on [Neon.tech](https://neon.tech) or AWS RDS.
2. Copy the pooled connection string with `?sslmode=require`.

#### 2. Backend Deployment (Railway or Render)
1. Link your GitHub repository.
2. Set Root Directory to `/server` or `mediflow-core/server`.
3. Configure Environment Variables (`DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`, `PORT=5000`, `ALLOWED_ORIGINS`).
4. Set Build Command:
   ```bash
   npm install && npx prisma generate && npm run build
   ```
5. Set Start Command:
   ```bash
   npm run start
   ```
6. Run database migrations and seed:
   ```bash
   npx prisma migrate deploy && npx prisma db seed
   ```

#### 3. Frontend Deployment (Vercel)
1. Import GitHub repository into [Vercel](https://vercel.com).
2. Set Framework Preset to **Vite**.
3. Set Root Directory to `/client` or `mediflow-core/client`.
4. Add Environment Variable:
   - `VITE_API_BASE_URL`: `https://your-backend-railway-app.up.railway.app`
5. Deploy. Vercel automatically runs `tsc -b && vite build` and serves the optimized SPA bundle with edge SSL.

---

### Option B: On-Premise / VPS (Ubuntu / Linux Server + Nginx + PM2)

#### 1. Prerequisites on Server
```bash
sudo apt update && sudo apt install -y nodejs npm postgresql nginx git
sudo npm install -g pm2
```

#### 2. Clone and Setup Backend
```bash
git clone https://github.com/hospital/mediflow.git
cd mediflow/mediflow-core/server

# Configure environment
cp .env.example .env
nano .env

# Install dependencies and build
npm install
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
npm run build

# Start with PM2 process manager
pm2 start dist/index.js --name "mediflow-api"
pm2 save
pm2 startup
```

#### 3. Build and Serve Frontend via Nginx
```bash
cd ../client
npm install
npm run build

# Copy build to Nginx web root
sudo cp -r dist/* /var/www/mediflow/
```

#### 4. Nginx Configuration (`/etc/nginx/sites-available/mediflow`)
```nginx
server {
    listen 80;
    server_name mediflow.hospital.org;

    root /var/www/mediflow;
    index index.html;

    # SPA routing fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Proxy to backend Express server
    location /api/ {
        proxy_pass http://localhost:5000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Uploads directory
    client_max_body_size 15M;
}
```

---

## 4. Database Maintenance, Migrations & Backups

### Running Migrations in Production
```bash
# Apply migrations safely without data loss
npx prisma migrate deploy
```

### Automated PostgreSQL Backup Script (Cron)
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/mediflow"
DATE=$(date +\%Y\%m\%d_\%H\%M\%S)
mkdir -p $BACKUP_DIR
pg_dump -U postgres -d mediflow_db -F c -f "$BACKUP_DIR/mediflow_$DATE.dump"
# Retain backups for 30 days
find $BACKUP_DIR -type f -mtime +30 -name "*.dump" -delete
```

---

## 5. Security Checklist Before Going Live

- [x] Change all default demo user passwords to strong unique passwords.
- [x] Set a cryptographically secure `JWT_SECRET` (minimum 32 random characters).
- [x] Ensure `NODE_ENV` is set to `production`.
- [x] Configure SSL/TLS certificates (Let's Encrypt / Cloudflare SSL).
- [x] Set explicit `ALLOWED_ORIGINS` in CORS config.
- [x] Enable rate limiting and upload directory quota monitoring.
- [x] Schedule automated nightly database backups.
