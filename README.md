# Household Ledger — Family Expense Tracker

A small expense tracker for your family. Anyone can log an expense; the app
remembers how each vendor is usually categorized so you rarely have to pick
a category twice for the same place.

## What's inside

- **Sign in** — each family member logs in with an account you create in Supabase
- **Dashboard** — this month's spending by category, plus a list of recent expenses (everyone's, shared)
- **Add expense** — vendor, amount, date, notes; category auto-suggests once a vendor has been used before
- Each person can override a category for themselves without changing it for everyone else

CSV/PDF statement import isn't built yet — that's the next phase. For now, expenses are added one at a time.

## Before you start

You'll need:
1. Your Supabase project already created (done) with the database tables already set up (done)
2. Node.js installed on your computer (the LTS version from nodejs.org — just download and run the installer, accepting the defaults)
3. A free GitHub account (for deploying later)

## Step 1 — Get your Supabase keys

1. Open your Supabase project
2. Go to **Settings** (gear icon, bottom left) -> **API**
3. Copy two values:
   - **Project URL**
   - **anon public** key (NOT the `service_role` key — that one must stay secret)

## Step 2 — Configure the app

1. In this project folder, find the file named `.env.local.example`
2. Make a copy of it and rename the copy to `.env.local`
3. Open `.env.local` in any text editor and paste in your two values:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-actual-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-actual-anon-key
```

4. Save the file. (`.env.local` is already set up to be ignored by Git, so this never gets accidentally uploaded anywhere public.)

## Step 3 — Run it on your computer

Open a terminal in this folder and run:

```bash
npm install
npm run dev
```

Then open **http://localhost:3000** in your browser. You should land on a sign-in page.

## Step 4 — Create your family's logins

You (the admin) create accounts for each family member — there's no public sign-up page, since this is a private household app.

1. In Supabase, go to **Authentication** -> **Users**
2. Click **Add user** -> **Create new user**
3. Enter an email and password for each family member
4. Tick **Auto Confirm User** so they don't need to verify their email
5. Share the email/password with that person so they can sign in

Repeat for everyone who should have access.

## Step 5 — Try it out

- Sign in with one of the accounts you just created
- Add an expense (e.g. vendor "BigBasket", category "Groceries")
- Add another expense from BigBasket later — notice the category now auto-suggests
- Sign in as a different family member and try overriding that category — confirm it only changes for that person

## Step 6 — Put it on the internet (so everyone can use it from their phones)

This part we'll do together in the next conversation — pushing this code to GitHub and connecting it to Vercel (also free). For now, this works perfectly on your own computer for testing.

## If something goes wrong

- **Blank page or error about Supabase URL** -> double check `.env.local` has both values pasted in correctly, then stop (Ctrl+C) and run `npm run dev` again
- **"Invalid login credentials"** -> check the email/password you created in Supabase Authentication
- **Stuck on anything** -> copy the exact error message and bring it back to this chat
