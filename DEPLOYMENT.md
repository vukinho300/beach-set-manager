# Deployment Checklist

## Before Pushing To GitHub

- Keep the app local-only. Do not add a backend, database, login, Supabase, Firebase, or shared sync.
- Confirm `node_modules/` and `dist/` are ignored by Git.
- Run a production build:

```powershell
npm.cmd run build
```

## Vercel Settings

- Framework preset: `Vite`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: none required

## Data Storage

Beach data is saved in `localStorage` on each individual phone/browser. Data is not shared between devices.

Clearing browser/site data for the deployed domain removes saved beach data on that phone/browser unless a JSON backup was exported first.

## iPhone Home Screen

Open the deployed Vercel URL in Safari, tap Share, choose Add to Home Screen, then tap Add.
