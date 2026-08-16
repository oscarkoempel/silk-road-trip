# Rian's Silk Road Adventures — PWA Setup Guide

## What changed

Your dashboard is still a single-file app (`index.html`) with all its original design and features untouched — map, explore list, trip builder, budget planner, packing checklist, phrasebook, Save/Load, calendar export. On top of that:

- **Installable** — add-to-home-screen on iPhone (Safari), Android (Chrome), and desktop.
- **Offline-capable** — the app shell, map style, fonts, and every map tile you've panned over are cached, so it opens and works with no signal.
- **Mobile-optimized** — tap targets, spacing, and form fields are enlarged on screens ≤900px wide (unchanged on desktop); safe-area padding for the iPhone notch/home-indicator; the desktop-only resize-drag handles are hidden on mobile; page pinch-zoom is disabled (the map keeps its own zoom gestures) and all inputs are 16px+ so iOS never auto-zooms on you.

### Files
```
index.html            ← the app itself (was your uploaded file, edited in place)
manifest.json          ← PWA metadata (name, icons, colors, display mode)
service-worker.js      ← offline caching logic
icons/
  icon-192.png          }
  icon-512.png           } standard app icons
  icon-180.png          ← Apple touch icon
  icon-maskable-192.png  }
  icon-maskable-512.png  } Android "maskable" icons (safe-zone padded)
  favicon-32.png        ← browser tab icon
```

All three top-level files must stay **in the same folder**, with `icons/` as a subfolder beside them — the paths inside `index.html` and `manifest.json` are relative.

## How the offline caching works

- **App shell** (the HTML, fonts, Leaflet, Tailwind, icons): cached on first visit, served instantly from cache after that, and silently re-checked against the network in the background so a future update reaches you without a slow reload.
- **Map tiles**: cached as you view them, capped at ~400 tiles so storage doesn't grow forever — areas you've already looked at stay viewable offline; areas you never opened won't magically appear without a connection.
- **Your trip data**: this was already handled — it's written straight to this browser's `localStorage` the moment you edit it, online or offline, with no server round-trip. There's nothing to "sync" later; it's simply always saved locally. The **Save** button remains the reliable long-term backup, since it downloads an actual file you can keep or move to a newer copy of the app.
- **Live exchange rates**: this one feature needs the network (it calls a currency-rate API). It already had a static fallback table built in, so the budget converter keeps working offline — it just won't be live.

## One thing I changed on purpose: pinch-zoom

Per your request to prevent unwanted zoom, the page itself no longer pinch-zooms (`user-scalable=no`). The **map still zooms normally** — Leaflet handles that with its own touch gestures, independent of page zoom. If you'd rather keep page pinch-zoom available for accessibility, tell me and I'll flip it back — it's one line in the `<meta name="viewport">` tag.

## What I deliberately left out

Per-device iOS splash screens need a distinct, exact-pixel image for every iPhone/iPad screen size — dozens of files that are easy to get subtly wrong. Instead: your existing in-app intro screen (the "qani ketdik" splash) already covers that first second, and Android/desktop get a proper generated splash automatically from `manifest.json`'s icon + background color. If you'd like, I can generate the iOS-specific set next.

---

## Hosting it

The service worker requires **HTTPS** (or `localhost`) — it will not run over plain `http://` on a real domain, so pick one of:

- **GitHub Pages** (free): push this folder to a repo, enable Pages in Settings → Pages, done — you get a `https://<you>.github.io/<repo>/` URL.
- **Netlify / Vercel** (free): drag-and-drop the whole folder onto their web dashboard (Netlify Drop is literally drag-and-drop, no account needed for a quick test).
- **Cloudflare Pages**: same idea, connect a repo or drag-and-drop.

Wherever you host it, upload the **whole folder** (`index.html`, `manifest.json`, `service-worker.js`, `icons/`) preserving that structure.

## Testing locally before you deploy

Service workers need a real server (not a double-clicked `file://` page). From a terminal, inside this folder:

```bash
python3 -m http.server 8080
```
then open `http://localhost:8080` in your browser. (Any local server works — `npx serve`, VS Code's Live Server, etc.)

To test offline mode: open the page once (so it caches), then in Chrome DevTools → Network tab, switch "No throttling" to **Offline** and reload. You should see the orange "You're offline" badge and the app should still work.

## Installing on iPhone

1. Open the hosted HTTPS link in **Safari** (must be Safari, not Chrome/Firefox on iOS).
2. Tap the **Share** icon (square with an arrow) in the toolbar.
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add**. The app icon appears on your home screen; opening it launches full-screen with no browser bar.

The app also shows its own banner with these instructions automatically the first time you visit on an iPhone (dismissible).

## Installing on Android

1. Open the link in **Chrome**.
2. You'll see an **Install** banner appear in the app itself (bottom of screen), or use Chrome's menu (⋮) → **Install app** / **Add to Home Screen**.
3. Confirm — the icon appears on your home screen and app drawer.

## Updating it later

Bump `CACHE_VERSION` at the top of `service-worker.js` (e.g. `'v1'` → `'v2'`) whenever you redeploy changes to `index.html`. That forces every visitor's cache to refresh instead of silently keeping an old copy. Without that bump, updates still arrive — just one visit later than the change (the background revalidation described above), since the very first load after a deploy will still be served from the old cache.
