# HospoSearch

The premier hospitality jobs platform for Australia & New Zealand.

## Project Structure

```
hosposearch/
├── index.html          ← Vite entry point
├── vite.config.js      ← Vite config
├── vercel.json         ← Vercel deployment config
├── package.json        ← Dependencies
├── public/
│   └── favicon.svg     ← Site icon
└── src/
    ├── main.jsx        ← React entry + BrowserRouter
    ├── Root.jsx        ← Route definitions
    ├── Landing.jsx     ← Marketing landing page (/)
    └── App.jsx         ← The full app (/app)
```

## Routes

| URL       | Component  | Description               |
|-----------|------------|---------------------------|
| `/`       | Landing    | Marketing page            |
| `/app`    | App        | Full HospoSearch platform |
| `/jobs`   | → `/app`   | Redirect                  |
| `/login`  | → `/app`   | Redirect                  |

## Local Development

```bash
# Install dependencies (first time only)
npm install

# Start dev server
npm run dev
# Opens at http://localhost:5173
```

## Deploy to Vercel

### Step 1 — Push to GitHub
```bash
git init
git add .
git commit -m "HospoSearch launch"
```
Go to github.com → New repository → name it `hosposearch`
Copy the two commands GitHub shows and run them.

### Step 2 — Deploy
Go to vercel.com → Add New Project → Import from GitHub
Select `hosposearch` → click Deploy

Your site will be live at `https://hosposearch.vercel.app` in ~60 seconds.

### Step 3 — Add your domains
In Vercel dashboard → Settings → Domains → Add:
- hosposearch.com.au  (set as primary)
- hosposearch.com     (redirect → hosposearch.com.au)
- hosposearch.co.nz   (redirect → hosposearch.com.au)
- hosposearch.co.uk   (redirect → hosposearch.com.au)

Log into your domain registrar and add the DNS records Vercel shows you.
Usually live within 1 hour.

## Demo Accounts

| Type      | Email                          | Password       |
|-----------|--------------------------------|----------------|
| Job Seeker| chef@gmail.com                 | pass123        |
| Job Seeker| front@gmail.com                | pass123        |
| Employer  | hire@attica.com.au             | pass123        |
| Employer  | hire@tetsuyas.com              | pass123        |
| Admin     | admin@hosposearch.com.au       | hospo2024!     |
| Trial     | trial@hosposearch.com.au       | hospo_trial!   |

## Discount Codes (for testing Stripe flow)

| Code        | Discount |
|-------------|----------|
| HOSPO25     | 25% off  |
| LAUNCH50    | 50% off  |
| FEATURED20  | 20% off  |
| FRIEND10    | 10% off  |
