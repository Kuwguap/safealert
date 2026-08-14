# SafeAlert — React Native (Expo) app

Location-aware emergency alerts app for Ghana, running on live data — no mock
content. Real **Supabase Auth** (login / signup / password reset), an admin
dashboard for publishing alerts and broadcasts, cross-device sync, and
notifications. Default area: KNUST, Kumasi.

## Hosted web app (PWA)

A production web build is deployed to **GitHub Pages** — open it in any browser,
no Expo needed, and "Add to Home Screen" installs it like a native app:

> **https://kuwguap.github.io/safealert/**  (admin dashboard at `/safealert/admin`)

Admin login credentials are provided separately (not committed to this repo).

## Run locally

```sh
npm install
npm start          # Expo dev server — scan the QR with Expo Go
npm run web        # or preview in a browser
npm run deploy     # rebuild + publish the web app to GitHub Pages
```

## Live data sources (no API keys required)

- **Alerts** — GDACS (UN global disaster feed: floods, earthquakes, cyclones,
  droughts, wildfires — covers Ghana/West Africa) merged with the US National
  Weather Service feed (weather/flood/AMBER events, US only). Admin bulletins
  cover hyper-local Ghana alerts.
- **Weather** — Open-Meteo current conditions + hourly forecast, °F/°C per settings.
- **Location** — device GPS via `expo-location`; labels use the **closest
  landmark** (OpenStreetMap Overpass) instead of coordinates, e.g. "Near KNUST
  Students' Clinic". Falls back to KNUST, Kumasi when permission is denied.
- **Map POIs** — schools, hospitals, police and fire stations plus suburb/place
  names from Overpass, rendered as animated markers with a color-key legend.
- **Place search** — OpenStreetMap Nominatim, Ghana-first (suburbs, junctions,
  campuses resolve), with a worldwide fallback.
- **Map layers** — three-way toggle: 3D wireframe · **street map** (CARTO
  Voyager @2x, the default) · satellite (Esri imagery + place/road label
  overlay). Tiles positioned with real Web-Mercator math (`src/util/geo.ts`);
  swap for Mapbox/Google in production.

Saved places, settings, accounts, bulletins and activity persist via AsyncStorage.

## Backend (Supabase)

Bulletins, community posts, broadcasts and SOS/check-in/tip events live in
Supabase (`safealert_bulletins`, `safealert_events` — see `src/api/backend.ts`),
so they reach **every device**, not just the sender's. The app polls every 20s
(the demo's push channel) and caches the last snapshot for offline use.
Note: the tables currently live in the "organizer-rocket" project because the
Supabase free plan caps active projects at two — pause/delete one in the
dashboard and the tables can move to a dedicated project.

## Auth, SOS contacts & admin

- **Login / signup** gates the app; signup collects **emergency contacts**
  (name + phone + optional SafeAlert email). Accounts are device-local for the
  demo; toggle "Admin account" at signup to unlock the dashboard.
- **SOS** — hold to send: logs the event with your live coordinates, opens the
  dialer to your first contact, and any contact whose SafeAlert email you
  listed gets a red in-app SOS toast + notification on their device (10-minute
  catch-up window if their app was closed).
- **Community posts** — the "+" button on Home publishes missing-person /
  flood / fire / accident reports into everyone's feed and map.
- **Admin dashboard** — Settings → "Open admin dashboard", or **`/admin`** on
  web. Publish bulletins, send **broadcast notifications** (toast +
  notification on all devices), watch live SOS/check-in/tip activity, DB
  status pill, and one-tap smoke tests for every feature (notification, SOS
  loop, broadcast, backend ping, feed refresh, cleanup).
- **Notifications** — local notification (`expo-notifications`) + in-app toast
  for new alerts, broadcasts and targeted SOS. True FCM/APNs push needs a dev
  build (Expo Go doesn't support remote push) — the poll+local pattern gives
  the same UX for the demo.
- **Pull-to-refresh** on Home and the admin dashboard.

## Screens

| Screen | File |
|---|---|
| Home — weather, live alert feed, 3D/satellite map | `src/screens/HomeScreen.tsx` |
| Advisory detail (flood/weather) — bulletin, severity/urgency/expiry, alert-area map | `src/screens/FloodDetailScreen.tsx` |
| AMBER alert detail — bulletin + instruction, alert-area map, report CTA | `src/screens/AmberDetailScreen.tsx` |
| Report a sighting — tip form (radio, details, consent) | `src/screens/ReportSightingScreen.tsx` |
| Emergency — hold-to-SOS, "I'm Safe", national quick-dial directory | `src/screens/EmergencyScreen.tsx` |
| Map tab — full-height hazard map + tappable hazard list | `src/screens/MapScreen.tsx` |
| Places tab — search/save places; active place drives the whole app | `src/screens/PlacesScreen.tsx` |
| Settings tab — alert-type filters, °F/°C, default map view, data status | `src/screens/SettingsScreen.tsx` |

Navigation is a lightweight in-app stack in `App.tsx` (tab bar + pushed detail
screens). App-wide state (location, places, settings, weather, alerts) lives in
`src/state/AppContext.tsx`.

## Maps

- `src/components/MapPanel.tsx` — interactive dark map panel: drag to pan,
  pinch to zoom (native), +/− and recenter (◎) buttons, 3D/Map/Satellite
  toggle, accurate tile layer (works worldwide), vignette/flood tint, chips.
- `src/components/Map3D/` + `web/map3d.html` — the 3D view: real MapLibre GL
  (WebGL) with the CARTO Dark Matter vector basemap, extruded 3D buildings,
  cinematic fly-in + idle orbit, inertial pan/pinch/rotate, amber beacon and
  the live POI layer in scene. Served as a static hosted page (inline srcdoc
  breaks MapLibre's tile worker) loaded via iframe (web) / WebView (native).
- `src/components/PulseRings.tsx` — pulsing radius rings + glowing pin (2D)

## Notes

- Tab bar uses Ionicons (`@expo/vector-icons`).
- Alert coverage is US-only for now (NWS feed) — weather, maps, and place
  search work worldwide. A Ghana/global alert source (e.g. MeteoAlarm-style
  feeds or GMet bulletins) would slot into `src/api/` beside `nws.ts`.
- SOS / "I'm Safe" confirmations are local UI states; wiring them to real
  contacts/SMS is the proposal's next phase (FCM push likewise).
