# PWA and privacy behavior

## PWA

The app manifest and icons are public static assets. `src/components/PwaRegister.tsx` registers `public/sw.js` only in secure contexts (HTTPS or localhost). The registration scope follows the app base path, including `/taxsolutions/` for the GitHub Pages export.

The service worker uses a versioned cache and skips waiting on an update. It caches only immutable `/_next/static/` assets, the offline fallback, and successful top-level `/lv/`, `/en/`, and `/ru/` pages without query parameters. Requests to `/admin`, `/workspace`, `/api`, unknown routes, cross-origin URLs, and URLs with query parameters are not intercepted or stored. CRM/offline editing is not supported. The offline page is informational and does not contain account data.

To install, use the install prompt when the browser raises its native install event. On iPhone/iPad, open Safari's Share menu and choose **Add to Home Screen**. On desktop, use the browser's install icon/menu when offered. Availability depends on browser and OS version; no unsupported install button is shown. The local dismissal preference is non-sensitive UI state only.

## Cookies and privacy settings

Repository inspection found no analytics or marketing script. Therefore no optional analytics or marketing consent banner is shown, and no nonexistent categories are presented. The localized privacy center describes the necessary administrator session cookie and states that optional tracking is not active. Re-evaluate before adding an analytics or third-party integration; gate it on an explicit consent mechanism before loading it.

The `tax-session` cookie is `HttpOnly`, `SameSite=Strict`, lasts up to eight hours, and is marked `Secure` in production. The theme preference is a non-sensitive UI preference stored in `localStorage`, not a cookie. No private API or authenticated response is placed in the service worker cache.

## Release blockers for legal review

- Confirm the controller's legal identity and contact details.
- Confirm actual hosting/email processors, locations, and processing agreements.
- Set and implement retention periods; the public privacy text no longer asserts unverified 180/30-day periods.
- Have the lawful basis, notice, and cookie policy reviewed by the responsible privacy professional before production.
- If optional analytics or integrations are introduced, update the processor inventory and consent behavior first.
