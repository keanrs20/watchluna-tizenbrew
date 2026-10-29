# WatchLuna module for TizenBrew

Turns [watchluna.com](https://watchluna.com/) into a TV app inside
[TizenBrew](https://github.com/reisxd/TizenBrew) on Samsung Tizen TVs.

What the module does (`userscript.js`, injected into the site):

- **D-pad spatial navigation** fallback — if the site doesn't move focus itself, arrows jump to the nearest visible control. If the site handles its own focus, the mod stays out of the way.
- **Media keys** — the remote's Play/Pause (key 413) toggles the `<video>`, Stop (415) stops and goes back.
- **Conservative ad blocker** — blocks popunders/`window.open` popups, ad iframes, known ad-network CDNs (Google ads, Taboola, ExoClick, PopAds, …) and common banner/overlay elements. Ads that live *inside* the cross-origin player iframe (pre-rolls) can't be touched from the parent page — only their wrappers.
- Focus outlines so the current selection is visible from the couch.

## Prerequisites (once)

1. On the TV: Apps → press `12345` → enable **Developer Mode**, set **Host PC IP** to your PC → reboot TV.
2. On the PC: install [Apps2Samsung](https://github.com/Apps2Samsung/Apps2Samsung) → scan for the TV → install **TizenBrew** from its community catalog.
3. Launch TizenBrew on the TV once. In its **Settings**, set a desktop Chrome **User-Agent** — WatchLuna sits behind Cloudflare and a plain TV UA can get challenged.

## Install this module (from GitHub)

1. Create a **public** GitHub repo (name it `watchluna-tizenbrew` or whatever you like) and upload `package.json` + `userscript.js` (keep the filenames; `package.json` `main` points at `userscript.js`).
2. In TizenBrew on the TV: **Manage modules → Add module from GitHub** and type:
   ```
   YOUR_GITHUB_USERNAME/watchluna-tizenbrew
   ```
3. Launch WatchLuna from the TizenBrew home screen.

> TizenBrew resolves GitHub modules through jsDelivr (`cdn.jsdelivr.net/gh/<user>/<repo>/…`), so the repo must be public. Private npm packages won't work; a public npm package (`npm` add option) works too if you prefer publishing.

## Tuning the ad blocker

Open `userscript.js` and edit the config block at the top:

- `BLOCK_HOSTS` — add any domain substring you see ads from (check the ad's iframe/script URL: right… there is no right-click on a TV — use a PC browser's DevTools on watchluna.com once and note the URLs).
- `HIDE_SELECTORS` — add CSS selectors for stubborn banners/overlays.

Push the change to GitHub afterwards; TizenBrew re-fetches the module files on each launch (jsDelivr may cache for a few minutes — bump `version` in `package.json` to force a refresh).

## Notes

- The player embeds used by WatchLuna rotate; if a provider's player breaks on the TV (or shows unskippable pre-rolls), that's provider-side — try another provider/server button inside the watch page.
- `packageType: "mods"` modules need no Tizen Studio, no signing, no rebuild — the site is loaded by TizenBrew's own WebView and this JS is injected at document start.
