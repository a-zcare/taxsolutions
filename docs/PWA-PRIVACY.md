# PWA and privacy behavior

## PWA

The app manifest and icons are public static assets. `src/components/PwaRegister.tsx` registers `public/sw.js` only in secure contexts (HTTPS or localhost). The registration scope follows the app base path, including `/taxsolutions/` for the GitHub Pages export.

The service worker uses a versioned cache and skips waiting on an update. It caches only immutable `/_next/static/` assets, the offline fallback, and successful top-level `/lv/`, `/en/`, and `/ru/` pages without query parameters. Requests to `/admin`, `/workspace`, `/api`, unknown routes, cross-origin URLs, and URLs with query parameters are not intercepted or stored. CRM/offline editing is not supported. The offline page is informational and does not contain account data.

### Install instructions

- **Android:** open TaxSolutions in Chrome, tap **More → Install and create shortcut → Install**. The menu wording can vary by browser/version; if the item is absent, that browser/device does not currently offer installation. [Chrome Android instructions](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en).
- **iPhone / iPad:** open the site in Safari, tap **Share → Add to Home Screen**, enable **Open as Web App** when offered, and tap **Add**. Apple notes the icon is added only on that device. [iPhone](https://support.apple.com/en-ie/guide/iphone/iphea86e5236/27/ios/27) · [iPad](https://support.apple.com/en-mide/guide/ipad/ipad8f1f7a29/ipados).
- **Windows:** in Chrome use **More → Cast, save, and share → Install page as app** (or the address-bar install icon). In Edge use its address-bar install action or **Settings and more → More tools → Apps → Install this site as an app**. The installed app opens in a separate window. [Chrome](https://support.google.com/chrome/answer/9658361?hl=en-GB8) · [Edge](https://support.microsoft.com/en-us/edge/install-manage-or-uninstall-apps-in-microsoft-edge).
- **macOS:** Chrome offers its app-install action; Safari on macOS Sonoma 14 or later offers **Share → Add to Dock** to create a separate web app. [Chrome](https://support.google.com/chrome/answer/9658361?hl=en-GB8) · [Safari](https://support.apple.com/en-ie/104996).
- **Linux:** Chrome provides the same **Install page as app** action as on other desktop systems. Browser support and the exact menu label vary; if no install action is available, use a bookmark. [Chrome instructions](https://support.google.com/chrome/answer/9658361?hl=en-GB8).

The site shows its own install button only when the browser raises the native install event; iPhone/iPad receive instructions because Safari does not expose that prompt event. Availability and standalone behavior depend on browser and OS version. The local dismissal preference is non-sensitive UI state only. PWA installation has not been physically verified on each listed OS/device.

## Cookies and privacy settings

Repository inspection found no analytics or marketing script. Therefore no optional analytics or marketing consent banner is shown, and no nonexistent categories are presented. The localized privacy center describes the necessary administrator session cookie and states that optional tracking is not active. Re-evaluate before adding an analytics or third-party integration; gate it on an explicit consent mechanism before loading it.

The `tax-session` cookie is `HttpOnly`, `SameSite=Strict`, lasts up to eight hours, and is marked `Secure` in production. The theme preference is a non-sensitive UI preference stored in `localStorage`, not a cookie. No private API or authenticated response is placed in the service worker cache.

## Release blockers for legal review

- Confirm the controller's legal identity and contact details.
- Confirm actual hosting/email processors, locations, and processing agreements.
- Set and implement retention periods; the public privacy text no longer asserts unverified 180/30-day periods.
- Have the lawful basis, notice, and cookie policy reviewed by the responsible privacy professional before production.
- If optional analytics or integrations are introduced, update the processor inventory and consent behavior first.
