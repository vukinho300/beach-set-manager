# Beach Set Manager

A local-only React/Vite/TypeScript phone app for tracking 56 beach sunbed/parasol sets.

The app stores data in `localStorage` on the current phone/browser. Each phone or browser has its own separate saved data. It does not use a backend, login, database, Supabase, Firebase, or real-time sharing.

Important: clearing browser/site data removes the saved beach data on that phone/browser. Export a backup first if the current data needs to be kept.

## Run Locally

```powershell
npm install
npm run dev
```

If PowerShell blocks npm scripts on Windows, use:

```powershell
npm.cmd install
npm.cmd run dev
```

Open the local Vite URL shown in the terminal, usually `http://127.0.0.1:5173/`.

## Build

```powershell
npm.cmd run build
```

The production build is written to `dist`.

## Deploy To Vercel

Import this folder/repo as a Vite project and use these settings:

- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

No environment variables are required.

## iPhone Home Screen

Open the deployed URL in Safari, tap Share, choose Add to Home Screen, then tap Add. The app can then be opened from the iPhone Home Screen like a standalone app.

The Home Screen app uses the same Safari site storage. Removing website data for the deployed domain can remove saved beach data unless a backup has been exported first.
