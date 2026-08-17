# SafeAlert — Documentation

**Location-aware emergency alerts for Ghana.** One app for staying informed
(disasters, AMBER alerts, weather), calling for help (SOS with real SMS +
in-app alarms), and reporting danger to the community.

- **Live app (PWA):** https://kuwguap.github.io/safealert/
- **Admin portal:** https://kuwguap.github.io/safealert/admin
- **Repository:** https://github.com/Kuwguap/safealert (private)
- **Default area:** KNUST, Kumasi (used until GPS resolves or is denied)

> Admin credentials are intentionally not written in this file. Use the admin
> account created at setup, or sign up with the "Admin account" toggle.

---

## 1. What the app does

| Pillar | In practice |
|---|---|
| **Stay informed** | A single feed merging global disaster alerts (GDACS), US weather service alerts (NWS), official admin bulletins, community reports, and broadcasts — plus live weather, all centered on where you are. |
| **Call for help** | Hold-to-send SOS: your emergency contacts get a full-screen siren alarm in the app, an automatic SMS with your live location, and a phone call — in seconds. |
| **Report danger** | Anyone can post a missing-person / flood / fire / accident report (with photo) that reaches every user's feed and map. Admins publish official bulletins and broadcasts. |

---

## 2. User guide

### 2.1 Getting started
1. Open **https://kuwguap.github.io/safealert/** on your phone.
2. *(Recommended)* Add it to your Home Screen — Safari/Chrome → Share → **Add to Home Screen**. It installs like a native app (full-screen, own icon).
3. **Sign up** with your name, email, and password. Also provide:
   - **Your phone number** *(optional)* — receives SMS blasts for Extreme AMBER alerts.
   - **Emergency contacts** *(at least one)* — name + phone, and their SafeAlert email if they use the app (that's what triggers their in-app siren alarm when you SOS).
4. Allow **location access** when asked. Until granted, the app uses the KNUST default area (an amber banner lets you retry).

Accounts work on any device (Supabase Auth). *Forgot password?* on the login screen emails a reset link; passwords can also be changed in Settings.

### 2.2 Home (Alerts tab)
- **Location pill** (top right) — your position, labeled by the closest landmark (e.g. "Near KNUST Students' Clinic"). Tap to switch to a saved place.
- **Weather card** — current conditions + next-hours forecast for the active location.
- **Alert feed** — color-coded cards: AMBER (amber), flood (blue), other (white), each with distance from you. Tap for the full detail page (description, photo if attached, map of the affected area, actions).
- **Map panel** — see §2.4.
- **"+" button** — post a community alert: pick a type (missing person, flooding, fire, accident, other), headline, description, optional **photo**. It appears in everyone's feed within ~20 s.
- **Pull down to refresh.**

### 2.3 Emergency tools (SOS tab)
- **SOS** — *hold* the red button ~1.5 s (progress ring fills; prevents accidental triggers). On completion:
  1. Contacts on SafeAlert get a **full-screen red alarm with a looping siren + vibration** that continues until they press *Stop alarm* (with a one-tap "Open live location in Maps").
  2. An **SMS with your live-location link** is sent automatically to every contact via the Arkesel gateway; if the gateway is unavailable, your SMS app opens prefilled instead.
  3. Buttons appear to **call your first contact** and **resend the SMS**.
- **"I'm Safe" check-in** — one tap tells your contacts (and the admin activity log) you're okay.
- **Quick dial** — Ghana numbers: Police/DOVSU **191**, Missing Children Ghana **059 459 4662**, NADMO **122**, Poison Control (GPCC) **020 222 2174**.
- **Incoming SOS preview** — see exactly what the alarm looks/sounds like, without alerting anyone.

### 2.4 Maps (Home + Map tab)
Three layers, toggle top-right:
- **Map** — street map (CARTO Voyager), the default; crisp roads and names with excellent Ghana coverage.
- **Satellite** — Esri imagery with a place/road label overlay.
- **3D** — a real WebGL scene (MapLibre GL): extruded 3D buildings on a dark basemap, cinematic fly-in, slow orbit until you touch it; drag / pinch / two-finger rotate + tilt.

All layers show **landmark markers** — 🎓 schools (purple), 🏥 hospitals (coral), 🛡 police (blue), 🔥 fire (amber) — with a color legend, neighborhood name labels, your pulsing position beacon, and **+ / − / ◎** (recenter) controls. Data is live from OpenStreetMap and refreshes as you pan.

### 2.5 Places & Settings
- **Places** — search any Ghanaian town/suburb/junction (worldwide fallback), save it, and set it *active*: the whole app (weather, alerts, maps) re-centers on it. Ideal for watching over family elsewhere.
- **Settings** — account info + contacts, change password, sign out; alert-type filters (they filter the live feed); °C/°F; default map layer; data-source status with last-refresh + manual refresh; admins get the dashboard button.

### 2.6 Notifications & updates
- New alerts, broadcasts, and SOS trigger a system notification (on device) and an in-app slide-down toast everywhere. Delivery runs on a ~20-second backend poll.
- The app self-updates: new deployments are picked up automatically at launch, or via the amber "update ready" banner.

---

## 3. Admin guide

Open **Settings → Open admin dashboard**, or go directly to `/admin` on web.
Admin role is checked server-side; non-admins see "Admins only."

| Card | What it does |
|---|---|
| **Publish alert** | Official bulletins: type (AMBER / Flood / Severe Weather / Earthquake / Wildfire), headline, details, optional **photo**, severity (Minor→Extreme). Lands in every feed/map within ~20 s with a notification. **AMBER + Extreme additionally SMS-blasts every registered user phone.** |
| **Broadcast notification** | Title + message pushed to all devices as toast + notification and a feed card. |
| **Published bulletins** | Live list with per-item **Remove** (removes for everyone). |
| **Incoming activity** | Real-time log of SOS, "I'm Safe" check-ins, and sighting tips, with user, location, and time. |
| **DB status pill** | Supabase reachability + latency, in the header. |
| **Smoke tests** | One-tap checks with ✓/✗ results inline: Notification, SOS alert (fires the real alarm at your own account), Broadcast, Backend ping, Refresh feed, Clear bulletins, Clear activity. |

---

## 4. Architecture

```
┌─────────────────────────────── client (Expo / React Native) ──────────────────────────────┐
│  screens/   Home · Map · Places · Settings · Emergency · Admin · Post · Details · Auth    │
│  state/     AuthContext (Supabase Auth)   AppContext (location, feed, alarms, settings)   │
│  api/       supabase · backend (PostgREST) · community · sms · storage ·                  │
│             nws · gdacs · openMeteo · overpass                                            │
│  components/ MapPanel (tiles+gestures) · Map3D (MapLibre iframe/WebView) · PoiLayer ·     │
│             SosAlarm (siren) · ImagePick · TabBar · toasts                                │
└──────────────┬────────────────────────────────────────────────────────────────────────────┘
               │ HTTPS
   ┌───────────┴───────────────┐          ┌──────────────────────────────┐
   │ Supabase                  │          │ Public data (keyless)        │
   │  Auth (accounts, JWT)     │          │  GDACS · NWS · Open-Meteo    │
   │  Postgres + RLS           │          │  OSM Overpass · Nominatim    │
   │   profiles                │          │  CARTO / Esri map tiles      │
   │   safealert_bulletins     │          └──────────────────────────────┘
   │   safealert_events        │
   │  Storage: safealert-media │          ┌──────────────────────────────┐
   │  Edge Fn: send-sms ───────┼─────────▶│ Arkesel SMS gateway (Ghana)  │
   └───────────────────────────┘          └──────────────────────────────┘
```

**Cross-device flow:** every write (bulletin, post, SOS event) goes to Supabase;
every client polls the tables each ~20 s (plus pull-to-refresh), diffs against
what it has seen, and raises toasts / notifications / the SOS alarm. The last
snapshot is cached locally, so the feed still renders offline and writes fall
back to local-only.

### 4.1 Database (Postgres)

| Table | Purpose | Key columns |
|---|---|---|
| `profiles` | One row per account (created by trigger on signup) | `id → auth.users`, `name`, `role` (user/admin), `contacts` jsonb, `phone` |
| `safealert_bulletins` | Bulletins, community posts, broadcasts | `source` (admin/community/broadcast), `type`, `event`, `headline`, `description`, `severity`, `area_desc`, `lat/lon`, `image_url`, `author` |
| `safealert_events` | SOS / check-ins / tips | `kind`, `user_name`, `user_email`, `detail`, `location_label`, `lat/lon`, `target_emails[]` |

**Row-level security:** community posts — any signed-in user; admin bulletins,
broadcasts, and deletions — admins only (checked via a `is_admin()` security-definer
function); events — visible to their author, their targets, and admins.
Signups are auto-confirmed and profiles auto-created by database triggers.

### 4.2 SMS (Edge Function `send-sms`)
The Arkesel API key lives **only** inside the Supabase Edge Function — never in
the client bundle or repo. The function:
1. Authenticates the caller's JWT.
2. `kind: "sos"` — any user; recipients capped at 5 (their own contacts).
3. `kind: "amber"` — verifies the caller is an admin server-side, then gathers
   every non-empty `profiles.phone` (capped at 50).
4. Normalizes Ghanaian numbers (`024… → 23324…`) and relays through Arkesel.

Client fallback: if the gateway fails (offline / out of credits), the device's
own SMS composer opens prefilled — carrier SMS, works on any Ghana number.

### 4.3 The 3D map
`web/map3d.html` is a standalone MapLibre GL page (dark CARTO basemap +
extruded OSM buildings + beacon + POI layers) deployed to
`/safealert/map3d.html` and embedded via iframe (web) / WebView (native).
It must be a real HTTP document: MapLibre's tile worker silently fails inside
inline `srcdoc` pages. POIs and zoom commands stream in via `postMessage`.

### 4.4 Hosting & updates
- **GitHub Pages** serves the production PWA from the `gh-pages` branch.
- `npm run deploy` = `expo export` → `scripts/prepare-web.js` (PWA manifest,
  icons, SPA 404 fallback, `map3d.html`, `version.json`) → publish.
- Clients compare `version.json` at launch/interval and self-update.

---

## 5. Tech stack & data sources

| Layer | Choice |
|---|---|
| Framework | Expo SDK 54 · React Native 0.81 · TypeScript |
| Auth/DB/Storage/Functions | Supabase (project `organizer-rocket`) |
| 3D map engine | MapLibre GL JS 4.7 |
| Map tiles | CARTO Voyager & Dark Matter · Esri World Imagery (all keyless) |
| SMS | Arkesel (Ghana) via Supabase Edge Function |
| Device APIs | expo-location · expo-notifications · expo-image-picker · expo-sms · expo-audio |
| Graphics/UI | react-native-svg · Ionicons · Sora + Instrument Sans |

| Data | Source | Coverage |
|---|---|---|
| Disaster alerts | GDACS (UN) | Worldwide incl. West Africa |
| Weather/flood/AMBER alerts | US National Weather Service | US only |
| Weather + forecast | Open-Meteo | Worldwide |
| Landmarks/POIs, place search | OpenStreetMap (Overpass, Nominatim) | Ghana-first |
| Hyper-local Ghana alerts | SafeAlert admins & community | Ghana |

---

## 6. Running & deploying

```sh
# local development
npm install
npm start            # Expo dev server → scan QR with Expo Go
npm run web          # browser preview

# checks
npx tsc --noEmit     # type-check

# production
npm run build:web    # build dist/ only
npm run deploy       # build + publish to GitHub Pages
```

Native notes: runs in **Expo Go** (scan the QR). Remote push notifications and
app-store builds require an EAS development build (`npx eas build`) — the
poll + local-notification pattern covers the same UX meanwhile.

---

## 7. Testing / smoke checklist

1. **Feed & sync** — admin publishes a bulletin → appears on a second device within ~20 s with toast + notification.
2. **SOS loop** — device A signs up with device B's email as emergency contact → hold SOS on A → B gets the siren alarm; A shows "SMS delivered automatically… (Arkesel)" and the call button.
3. **Extreme AMBER SMS** — publish AMBER + Extreme → "SMS blast sent to N registered phones."
4. **Images** — attach a photo to a post → visible in the detail page on another account.
5. **Maps** — all three layers render; POI markers + legend show; pan/zoom/recenter work; 3D shows buildings.
6. **Admin smoke tests** — every button reports ✓.

## 8. Known limitations & the fix for each

| Limitation | Why | Fix when needed |
|---|---|---|
| Alert delivery latency ≈ 20 s; no background push | Expo Go can't do FCM/APNs | EAS dev build + Expo Push / FCM |
| NWS weather alerts are US-only | No public Ghana Met Agency API | GDACS covers disasters; admin bulletins cover local; add GMet feed if one appears |
| SMS needs Arkesel credit (balance currently exhausted by testing) | Trial credits | Top up at sms.arkesel.com; register the "SafeAlert" sender ID for reliable delivery on all carriers |
| Supabase free tier pauses after ~1 week of inactivity | Free-plan policy | Open the Supabase dashboard → Restore (takes ~2 min), or upgrade |
| Web siren may stay silent until first tap | Browser autoplay policy | Native/Expo Go unaffected |
| One shared Supabase project ("organizer-rocket") | Free plan caps 2 projects | Pause/delete an old project and migrate (2 tables + 1 function) |

## 9. Support quick-reference

- **App not updating on iPhone:** fully close the PWA (swipe away) and reopen, or open `…/safealert/?v=2` in Safari once.
- **"Couldn't get your location":** tap the banner to retry; check browser/OS location permission.
- **Admin can't publish:** check the DB status pill (Supabase paused? → restore in dashboard), then the Backend-ping smoke test.
- **SMS not arriving:** check Arkesel balance; unregistered sender IDs can be filtered by some carriers.
