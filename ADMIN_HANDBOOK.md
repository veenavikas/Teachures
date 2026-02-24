# Teachures — Admin Handbook & Platform Guide

Welcome to the Teachures Platform Admin Guide. This document provides an overview of the platform's core systems, compliance features, and administrative workflows.

## 1. Authentication & Session Management
Teachures utilizes a dual-token (Access + Refresh) JWT architecture designed for both web browsers and mobile application clients.
- **Access Tokens**: Short-lived (15 minutes). For browsers, these are stored in `HttpOnly` and `SameSite=Lax` cookies to prevent XSS and CSRF attacks.
- **Refresh Tokens**: Long-lived (7 days). Stored similarly in secure cookies. The `auth.middleware.js` automatically detects expired access tokens and silently refreshes them if a valid refresh token exists, providing a seamless user experience.
- **Role-Based Access Control (RBAC)**: Users are assigned `ADMIN`, `TRAINER`, or `LEARNER` roles. Middleware (`requireRole`) automatically guards specific route branches (`/admin/*`, `/trainer/*`).

## 2. Compliance & Data Privacy (GDPR/CCPA)
The platform is fully compliant with modern data protection regulations:
- **Cookie Consent**: A global moving banner intercepts all new visitors. Users must explicitly opt-in to `analytics` and `marketing` cookies. These preferences are logged immutably in the PostgreSQL `ConsentLog` table and mirrored to a local browser cookie.
- **Data Export (`/api/v1/compliance/export`)**: Any user can request a JSON bundle of their entire profile, enrollments, quiz scores, and certificate history from the "Privacy & Data" dashboard.
- **Soft Deletion (`/api/v1/compliance/account`)**: To maintain historical financial metrics (e.g., total course revenue) and course ratings, user accounts are *anonymized* (Personal Identifiable Information like Name, Email, and Passwords are wiped and replaced with generic placeholders) rather than hard-deleted.

## 3. Anti-Piracy Measures
Protecting trainer intellectual property is a priority:
- **Dynamic Watermarking**: The video player (`course-player.ejs`) injects a dynamic, moving DOM-element watermark containing the viewer's email address and a timestamp. 
- **Tamper Protection**: A `MutationObserver` actively watches the DOM. If a malicious user attempts to hide or delete the watermark via Browser Developer Tools, the watermark instantly respawns.

## 4. Performance & Scalability
- **Database Indexes**: The Prisma schema utilizes B-Tree indexes (`@@index`) on high-traffic lookup columns (e.g., `trainerId` on Courses, `userId` on Enrollments) to ensure rapid query execution as the database scales.
- **Edge Caching**: Static assets (CSS, JS, Fonts, Images) are served with `Cache-Control: max-age=86400` headers (1 day), allowing CDNs to effectively edge-cache resources and reduce origin server load.
- **Payload Compression**: The Express server utilizes gzip `compression()` middleware to drastically shrink the size of HTML/CSS/JSON payloads sent over the wire.

## 5. Admin Dashboard (Feature Overview)
As an Admin, your dashboard (`/admin/dashboard`) provides access to:
1. **Platform Metrics**: View aggregated total users, active trainers, and platform-wide revenue.
2. **User Management**: Promote learners to trainers, or suspend toxic accounts.
3. **Course Moderation**: Review pending courses crafted by trainers before they are published to the public catalog.
4. **Support Center**: Address and resolve user support tickets across the platform.

## 6. Server Operations
### Starting the Server
```bash
# Production Start
npm start

# Development Start (with auto-reload)
npm run dev
```

### Database Management (Prisma)
```bash
# Push schema changes to the database
npx prisma db push

# Open Prisma Studio UI to manually edit records
npx prisma studio
```

*For further technical details, please refer to the inline comments within the `/src` directory.*
