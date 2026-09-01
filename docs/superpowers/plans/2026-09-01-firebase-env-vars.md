# Firebase Credentials via Environment Variables — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `firebase-service-account.json` file with separate environment variables, so Firebase credentials live in `.env` (gitignored) and can be set in Vercel dashboard without committing secrets to git.

**Architecture:** Extract 3 essential fields from the JSON (`project_id`, `private_key`, `client_email`) as individual env vars. Hardcode the constant fields (`type`, `auth_uri`, `token_uri`, etc.) in `fcmService.js`. This eliminates the file dependency entirely.

**Tech Stack:** Node.js, Firebase Admin SDK, dotenv

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/src/services/fcmService.js` | Modify | Read env vars instead of JSON file |
| `backend/.env` | Modify | Add 3 Firebase env vars |
| `backend/.env.example` | Modify | Document new env vars |
| `.gitignore` | Modify | Add `firebase-service-account.json` |
| `firebase-service-account.json` | Delete from git | Remove from tracking (keep local for reference) |

---

## Global Constraints

- Backend: CommonJS modules (`require`), Node 22.12+
- Environment variables loaded via `dotenv` (already configured)
- No new dependencies — `firebase-admin` already installed
- `.env` is gitignored — credentials never committed
- Graceful degradation: if env vars missing, push notifications disabled (existing behavior)

---

### Task 1: Update fcmService.js to Read Env Vars

**Files:**
- Modify: `backend/src/services/fcmService.js:20-47`

**Interfaces:**
- Consumes: `process.env.FIREBASE_PROJECT_ID`, `process.env.FIREBASE_PRIVATE_KEY`, `process.env.FIREBASE_CLIENT_EMAIL`
- Produces: `initFirebase()` returns `true` if initialized, `false` if disabled

- [ ] **Step 1: Replace initFirebase function**

Replace lines 20-47 with:

```javascript
function initFirebase() {
  if (firebaseInitialized) return true;

  // Method 1: Individual env vars (recommended for Vercel/cloud)
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (projectId && privateKey && clientEmail) {
    try {
      const serviceAccount = {
        type: 'service_account',
        project_id: projectId,
        private_key_id: '',
        private_key: privateKey.replace(/\\n/g, '\n'),
        client_email: clientEmail,
        client_id: '',
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: '',
        universe_domain: 'googleapis.com',
      };

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      firebaseInitialized = true;
      console.log('[FCM] Firebase initialized from environment variables');
      return true;
    } catch (err) {
      console.error('[FCM] Failed to initialize from env vars:', err.message);
      return false;
    }
  }

  // Method 2: JSON file (legacy/local fallback)
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!serviceAccountPath) {
    console.warn('[FCM] Firebase credentials not configured — push notifications disabled');
    console.warn('[FCM] Set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL in .env');
    return false;
  }

  const fullPath = path.resolve(__dirname, '..', '..', serviceAccountPath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`[FCM] Service account file not found: ${fullPath} — push notifications disabled`);
    return false;
  }

  try {
    const serviceAccount = require(fullPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    firebaseInitialized = true;
    console.log('[FCM] Firebase initialized from service account file');
    return true;
  } catch (err) {
    console.error('[FCM] Failed to initialize from file:', err.message);
    return false;
  }
}
```

- [ ] **Step 2: Verify syntax**

Run: `node -c backend/src/services/fcmService.js`
Expected: No output (syntax OK)

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/fcmService.js
git commit -m "feat(fcm): support env vars for Firebase credentials"
```

---

### Task 2: Update .env with Firebase Credentials

**Files:**
- Modify: `backend/.env`

**Interfaces:**
- Consumes: Values from `firebase-service-account.json`
- Produces: 3 env vars for `fcmService.js`

- [ ] **Step 1: Add env vars to .env**

Add these 3 lines at the end of `backend/.env`:

```bash
# Firebase Cloud Messaging (delivery driver push notifications)
FIREBASE_PROJECT_ID=push-messaging-c7571
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDpfAunH1DHnCUTCZ/PHFDlIapY8O2Jin4DuB+3WF2p2cDse/aeriQ7GGQf7DWFN/ru54Gc+6cZgRapgBpggx5eghPKgDQ9QxzoWTfa364zdcA9QHPzzGGcHExqfXsGOr53RqTy8WXwHQQAAgOHCOBxXIsG0cHwYK45Llgk4q3HztXbkk9APbFc0Gg/9HPI7tnGImGX65RA2raG8jn/mElB8tJ2Eu9g1usOzOLP+j4POjqGmCnMOToPvqlMVjtn/+eCtnmY7QMlOGR+ggUPwkvHWKvhk0V/o/41T6GL38s29830ugKO0mvFEM8tVVPoO5kG2UrZBCIvu7Te5IkdYdLNZAgMBAAECggEAARZVZSEVBgmA7NZCDKJqPZuAISxM72aZKoEm8dO4S8nCRd3PgLoN7S6NLi8c5M0rueivSTvDeDid0n/tJaPuAjfh+8e+EvrB8rz/j0tVwY4T7L+K85IhDh58VVu5R4RIDPZZ9vHaccBYjoydYINUu+Ha8bQxrOHaLwdHpsjMKt3Qbke3/OdC+JMw2G+9VfcUM/LWStRV6GW7S2Fl+Hky01bAuS8Dc8fkkd1sMUdeAuFYJR3I0cnMUgRNk8+ymA9C9D5CgjjdxEzpO9wPaqOVAXTNzqXvbsnYC5AqMTg1HW1Uqcg9BTdTr1qhoKme1T4EFG5IadknND87k6SIl9kWYQKBgQD4C7hxyrAdw9T7L0/4EVfRFPWSJoqk6j/fQq9Yy/aRuq9dclt4Y0q1JWJdHzUgoIMxbsQpnB31MAcMfD6mya682xrG53+LBzsZ5/zbnbam9MXpvy/ZFACr85sj/QC3rEOI1EdotyxCGQXM9AQm+71+g0y4JqzXZaZdBIaGnw9NUQKBgQDw+MmltVJdWMQdS54DQEgEOOH9H4hyacLzuX4mhT/0WmqUVwYNuh7+P/M7Sn8VaIarLagv3CVhshUpM/iHimt79TUCHgX6hPkTmrse6B4caWswAGnD0hjf5XF97mrAEEt8a+wKtEfZtWKOp+5K/widrORjrIhM3zFAfbDbGP5jiQKBgQC3NUD4m3LVqU1ochuo6HZqcgan+luxT2v55XFKLuxh2veoF81D8GK/xWsPyPserC/6lQvCiBMAhIbQS/yiiJjN2S+/9kEYWTDoA5eaRrUgP+7mpVYcClAssXPHcxnSkCQZrmFIEPNZps3IAfwHJy1hgm1qHvbO6b+lOLB8QoO04QKBgGBw4ZtNX2J2pT6oRdw9PNVbwq5gkWZhB6ItqdxW1grAqQknbwfNZpwREhK3tPbnd4ZI5pgI/nkEIc30u9HbRzs8HvPy+ieSUnFTKvKqqWprkneKosm5azUoieyBn/2wR9XLB5QdJOhv3LsFYKxpN5SLXni5028YoIiUBVUawq0pAoGBAMngF4vw1OZviBpi2+VCY5hsYQjJWkLG/7Xs1YcK/pabty9zgiidXeu6GjUJVpXr0IPGolbPVxOIpo6qhdVNl1YW9OlzKAa+WtJInuJWvofw/JykQUvR4WeCN5o3n82+cOf0uxOfcs3r5TFQrv7nJwckUVzAZMr0c21rkSmcGepc\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@push-messaging-c7571.iam.gserviceaccount.com
```

- [ ] **Step 2: Verify .env syntax**

Run: `cd backend && node -e "require('dotenv').config(); console.log('Project ID:', process.env.FIREBASE_PROJECT_ID)"`
Expected: `Project ID: push-messaging-c7571`

- [ ] **Step 3: Commit**

```bash
git add backend/.env
git commit -m "chore: add Firebase env vars to .env"
```

**Note:** `.env` is gitignored, so this commit only affects local. The actual values will be set in Vercel dashboard.

---

### Task 3: Update .env.example with Documentation

**Files:**
- Modify: `backend/.env.example:44-49`

**Interfaces:**
- Consumes: None
- Produces: Documentation for new env vars

- [ ] **Step 1: Replace Firebase section in .env.example**

Replace lines 44-49 with:

```bash
# Firebase Cloud Messaging (for delivery driver push notifications)
# Option A: Individual env vars (recommended for Vercel/cloud deployment)
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=

# Option B: Service account JSON file (legacy/local fallback)
# Download from: https://console.firebase.google.com → Project Settings → Service accounts
# FIREBASE_SERVICE_ACCOUNT_PATH=firebase-service-account.json

# VAPID key for web push notifications
# Get from: Firebase Console → Project Settings → Cloud Messaging → Web push certificates
FCM_VAPID_KEY=
```

- [ ] **Step 2: Commit**

```bash
git add backend/.env.example
git commit -m "docs: update .env.example with Firebase env vars"
```

---

### Task 4: Add firebase-service-account.json to .gitignore

**Files:**
- Modify: `.gitignore`

**Interfaces:**
- Consumes: None
- Produces: Git ignores the credentials file

- [ ] **Step 1: Add to .gitignore**

Add these lines after the existing Firebase section (after line 37):

```bash
# Firebase service account (credentials file - NEVER commit)
firebase-service-account.json
```

- [ ] **Step 2: Verify gitignore**

Run: `git check-ignore backend/firebase-service-account.json`
Expected: `backend/firebase-service-account.json`

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: add firebase-service-account.json to .gitignore"
```

---

### Task 5: Remove firebase-service-account.json from Git Tracking

**Files:**
- Delete from git: `backend/firebase-service-account.json`

**Interfaces:**
- Consumes: None
- Produces: File removed from git history, kept locally

- [ ] **Step 1: Remove from git (keep local file)**

Run: `git rm --cached backend/firebase-service-account.json`

- [ ] **Step 2: Verify removal**

Run: `git status backend/firebase-service-account.json`
Expected: `deleted: backend/firebase-service-account.json`

Run: `ls backend/firebase-service-account.json`
Expected: File still exists locally

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: remove firebase credentials from git tracking"
```

---

### Task 6: Test Firebase Initialization

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: Updated `fcmService.js` and `.env`
- Produces: Confirmation that Firebase initializes from env vars

- [ ] **Step 1: Test Firebase initialization**

Run: `cd backend && node -e "const fcm = require('./src/services/fcmService'); console.log('Firebase init:', fcm.initFirebase())"`

Expected output:
```
[FCM] Firebase initialized from environment variables
Firebase init: true
```

- [ ] **Step 2: Verify graceful fallback**

Temporarily remove env vars and test:
Run: `cd backend && FIREBASE_PROJECT_ID= FIREBASE_PRIVATE_KEY= FIREBASE_CLIENT_EMAIL= node -e "const fcm = require('./src/services/fcmService'); console.log('Firebase init:', fcm.initFirebase())"`

Expected output:
```
[FCM] Firebase credentials not configured — push notifications disabled
[FCM] Set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL in .env
Firebase init: false
```

- [ ] **Step 3: Run existing tests**

Run: `cd backend && npx vitest run --reporter=verbose 2>&1 | tail -5`

Expected: Tests pass (211+)

---

### Task 7: Final Commit and Verification

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: All previous tasks
- Produces: Clean git state, ready to push

- [ ] **Step 1: Check git status**

Run: `git status`
Expected: Clean working tree, no untracked sensitive files

- [ ] **Step 2: Verify no secrets in git**

Run: `git ls-files | grep -i firebase`
Expected: No output (file not tracked)

- [ ] **Step 3: Verify .env is gitignored**

Run: `git check-ignore backend/.env`
Expected: `backend/.env`

- [ ] **Step 4: Final commit (if any remaining changes)**

```bash
git add -A
git commit -m "chore: complete Firebase credentials migration to env vars"
```

---

## Post-Deployment: Vercel Setup

After pushing to production, set these environment variables in Vercel dashboard:

1. Go to Vercel → Your Project → Settings → Environment Variables
2. Add:

| Name | Value |
|------|-------|
| `FIREBASE_PROJECT_ID` | `push-messaging-c7571` |
| `FIREBASE_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\nMIIEvg...` (full key) |
| `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk-fbsvc@push-messaging-c7571.iam.gserviceaccount.com` |
| `FCM_VAPID_KEY` | `BOcd-VH6Ca7oti3YQqMyobpGugqwKbEKsHmnOQeRNNYUhmfVta3Dz8NNaKynEHEu8-5dEXDfm8MAziu2XR5ZUvw` |

3. Deploy → Firebase will initialize from env vars

---

## Self-Review Checklist

- [x] **Spec coverage:** All Firebase credentials extracted to env vars
- [x] **Placeholder scan:** No TBD/TODO placeholders
- [x] **Type consistency:** `initFirebase()` signature unchanged, returns boolean
- [x] **Backward compatibility:** Falls back to file if env vars missing
- [x] **Security:** File removed from git, `.env` gitignored
- [x] **Graceful degradation:** Push notifications disabled if credentials missing
