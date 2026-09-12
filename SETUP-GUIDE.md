# Honouring Him — Standalone Setup Guide

This turns Honouring Him into its own independent website: no Claude account
needed for you or your customers, works on any phone or computer just by
typing in a URL. It replaces the two things that only worked inside Claude
(the shared database, and the AI that writes each study/sermon/devotional)
with your own free Firebase project and a free Groq AI account — so the
whole thing runs at **$0/month**.

This is a real, one-time technical setup — expect 30-60 minutes the first
time, done by following the steps below in order. None of it requires
coding experience beyond copy-pasting values into two files.

**Before you start**, read the "What this costs" section at the bottom —
it's short, and it matters.

---

## What you're setting up, in one paragraph

Firebase stores everyone's profiles, groups, saved answers, and progress
(free, at this app's small scale). Cloudflare Pages hosts the actual website
and — through one small serverless function included in this folder — calls
Groq's free AI API to write each study, sermon, and devotional. Your Groq
key lives only in that one server-side setting, never in a file or in the
browser. Nothing else needs to change.

---

## Step 1 — Create your Firebase project (free)

1. Go to <https://console.firebase.google.com> and sign in with any Google
   account (this can be a personal one — it's just for managing the
   project, not tied to your customers in any way).
2. Click **Add project**, give it any name (e.g. "honouring-him"), and
   finish the wizard (you can decline Google Analytics — not needed).
3. In the left sidebar, click **Build \> Firestore Database \> Create
   database**. Choose **Start in production mode**, pick any location close
   to you, and click **Enable**.
4. In the left sidebar, click **Build \> Authentication \> Get started**.
   On the **Sign-in method** tab, enable **Anonymous** and save. (This lets
   each visitor's browser silently identify itself with no sign-up screen
   at all — nothing your customers will ever see or be asked to do.)
5. Click the gear icon next to **Project Overview \> Project settings**.
   Under **Your apps**, click the **\</\>** (web) icon to register a new web
   app. Give it any nickname and click **Register app** — you do *not* need
   Firebase Hosting here.
6. You'll be shown a `firebaseConfig` object with values like `apiKey`,
   `authDomain`, `projectId`, etc. Keep this tab open — you'll need it in
   Step 3.

## Step 2 — Set your Firestore security rules

1. Still in the Firebase console, go to **Build \> Firestore Database \>
   Rules**.
2. Open the included `firestore.rules` file in this folder, copy its
   entire contents, paste it over what's in the console's rules editor,
   and click **Publish**.

## Step 3 — Add your Firebase config to the app

1. Open `index.html` in this folder in any text editor.
2. Find this block near the top of the file (search for `HH_FIREBASE_CONFIG`):

   ```js
   window.HH_FIREBASE_CONFIG = {
     apiKey: "YOUR_FIREBASE_API_KEY",
     authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_PROJECT_ID.appspot.com",
     messagingSenderId: "YOUR_SENDER_ID",
     appId: "YOUR_APP_ID"
   };
   ```
3. Replace each placeholder with the matching value from the `firebaseConfig`
   Firebase showed you in Step 1.6, then save the file. (These values are
   not secret — Firebase's own docs confirm web config is meant to be
   public; your Firestore rules from Step 2 are what actually protect the
   data, not hiding these values.)

## Step 4 — Get a free Groq API key

Groq is a free AI API — sign-up takes under a minute, no credit card, no
sales calls or "book a demo" screens.

1. Go to <https://console.groq.com>, sign in with an email or Google
   account.
2. Find **API Keys** in the left sidebar, click **Create API Key**, name it
   anything, and copy the key it shows you (you won't be able to see it
   again, so keep this tab open for a moment).

*(Why Groq and not Cloudflare's own free AI? Both are free, but Cloudflare
sometimes asks new accounts to "book a demo" before turning on its built-in
AI, which isn't instant. If you'd still like to try that path — or later
switch to Claude for better writing quality at a small cost — both are
included as ready-to-swap files: `generate.workersai.js.example` and
`generate.anthropic.js.example` in the `functions/api` folder. Neither
needs any change to `index.html`.)*

## Step 5 — Deploy to Cloudflare Pages (free)

1. Go to <https://dash.cloudflare.com>, sign up or sign in.
2. Go to **Workers & Pages \> Create \> Pages**.
3. The simplest path: choose **Upload assets** (direct upload, no GitHub
   needed), give the project a name, and upload this entire `standalone`
   folder (it must include `index.html` *and* the `functions` folder
   alongside it, not nested inside another folder).
   - Prefer easier future updates instead? Choose **Connect to Git**, push
     this folder to a new GitHub repository first, and point Cloudflare at
     it — every future change you push redeploys automatically.
4. Once the project is created, go to its **Settings \> Environment
   variables**, add a variable named exactly `GROQ_API_KEY`, paste in the
   key from Step 4, mark it **Encrypt**, and save.
5. Trigger a deploy (or redeploy) so the environment variable takes effect.
6. Cloudflare gives you a free `your-project-name.pages.dev` URL — this is
   now a fully independent, live website. Open it on your own phone to
   confirm everything works before sharing it with anyone.

## Step 6 — (Optional) Use your own domain

In the same Pages project, go to **Custom domains \> Set up a custom
domain** and follow the prompts if you own a domain name — free to attach,
you only pay for the domain itself if you don't already have one.

---

## What this costs

- **Firebase**: free at this app's scale (the free "Spark" plan's Firestore
  and Authentication limits are generous for a small-to-medium product; you
  won't need to add a credit card unless you grow far beyond a typical
  small business's usage).
- **Cloudflare Pages**: free, no credit card required, for a site and
  serverless function at this scale.
- **Groq**: free, no credit card. Its free tier gives the 70B model (used
  for full studies/sermons) 1,000 requests and 100,000 tokens per day, and
  the small 8B model (used for quick tasks) a separate, much larger
  allowance. A full sermon runs a few thousand tokens, so that ceiling is
  roughly "dozens of full generations a day," not unlimited — worth
  watching in Groq's dashboard if the site ever gets busy (see below).
- **Total recurring cost: $0.**

### The honest trade-off of going free

This app now writes with an open-source model (Llama 3.3, via Groq) instead
of Claude. Two real differences worth knowing before you sell this:

1. **Writing quality.** Llama is a genuinely capable model, but for the
   kind of warm, nuanced, theologically-careful writing this app leans on
   (personalized stories, sermons, discussion questions), it's a step down
   from Claude — you may notice occasional repetition, blander phrasing, or
   an odd JSON hiccup here and there (the function has some built-in
   retry-safe parsing for that last one). Generate a few studies and a
   sermon yourself after setup and read them before you launch, so you know
   what your customers will see.
2. **Daily volume.** See the ceiling noted above. If you run a promotion or
   several groups generate content the same day, you could hit it — Groq's
   console shows current usage so you can keep an eye on it as you grow.

If either of those ever becomes a real problem, you don't have to rebuild
anything: swap in `functions/api/generate.anthropic.js.example` (see the
note at the end of Step 4) to switch to Claude for a small, predictable
per-generation cost, any time.

## One more honest note

Just like the version that ran inside Claude, this still isn't a real
per-customer account system — it's the same lightweight, code-based
"sign-in" model (see the app's own Help screen and Section 9 of the
customer-facing Complete Guide). The Firestore rules here add one real
layer of protection over the original version (blocking anonymous scripts
with no Firebase credentials at all), but every customer's groups, lectures,
and devotionals still live in one shared space distinguished only by their
sign-in codes. Worth knowing before you scale this up.
