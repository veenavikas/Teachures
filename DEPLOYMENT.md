# Teachures Deployment Guide (Hostinger / VPS)

## 1. Prerequisites
Ensure your Hostinger VPS has the following installed:
- Node.js (v18+)
- PostgreSQL (or use an external database like Supabase/Neon)
- Redis (for BullMQ queues)
- Nginx
- PM2 (`npm install -g pm2`)

## 2. Environment Variables (`.env`)
Create a `.env` file in the root of the project:

```env
PORT=3000
DATABASE_URL="postgresql://user:password@localhost:5432/teachures?schema=public"
SESSION_SECRET="your_strong_session_secret"
AWS_ACCESS_KEY_ID="your_aws_key"
AWS_SECRET_ACCESS_KEY="your_aws_secret"
AWS_REGION="us-east-1"
S3_BUCKET_NAME="teachures-videos"
SENDGRID_API_KEY="your_sendgrid_key"
SENDGRID_FROM_EMAIL="noreply@teachures.com"
REDIS_HOST="127.0.0.1"
REDIS_PORT=6379
PAYPAL_CLIENT_ID="your_paypal_client_id"
PAYPAL_CLIENT_SECRET="your_paypal_secret"
```

## 3. Build and Start
1. Install dependencies: `npm install`
2. Run Prisma migrations: `npx prisma migrate deploy`
3. Generate Prisma client: `npx prisma generate`
4. Start the application with PM2: `pm2 start ecosystem.config.js`
5. Save PM2 state to restart on server reboot: `pm2 save` && `pm2 startup`

## 4. Reverse Proxy Setup (Nginx)
Configure Nginx to proxy port 80/443 to port 3000.

```nginx
server {
    listen 80;
    server_name teachures.com www.teachures.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 5. SSL / HTTPS
Use Let's Encrypt / Certbot to secure your domain:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d teachures.com -d www.teachures.com
```

## 6. Maintenance & Updates
To deploy an update:
1. `git pull`
2. `npm install`
3. `npx prisma migrate deploy`
4. `pm2 restart teachures-web`
5. `pm2 restart teachures-worker`
