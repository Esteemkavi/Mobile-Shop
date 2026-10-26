# NextGen Mobiles — Expo Mobile App

Native React Native / Expo conversion of the NextGen Mobiles storefront.

## Run locally

1. Install Node.js LTS.
2. Configure the PostgreSQL API in the sibling `backend/` folder; follow the root README and run that API first.
3. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to the Debian/API server address reachable from this device.
4. Run `npm install`.
5. Start Expo with `npx expo start`.
6. Scan the QR code with Expo Go, or use an Android emulator.

## Build an installable Android APK

Install EAS CLI and sign in:

`npm install --global eas-cli`
`eas login`

From this `mobile-app` folder, configure the project if prompted:

`eas build:configure`

Then create a directly installable Android APK:

`eas build --platform android --profile preview`

The `preview` profile is configured with `android.buildType: apk`. EAS provides a build page/artifact link when the build finishes. Open that link on your Android phone to download and install the APK.

## Google Play Store build

For Play Store distribution, use:

`eas build --platform android --profile production`

The production profile creates an Android App Bundle (AAB), which is the normal Play Store format.

## Features

- NextGen Mobiles branding
- iPhone / Samsung / OnePlus categories
- Product search
- Two-column product grid
- Pagination / load more
- Product details
- New Arrivals gallery
- WhatsApp enquiry
- Phone, WhatsApp and social actions
- PostgreSQL-backed catalog and likes via the backend API
- Guest profile creation through the backend API

## Data and images

The app loads categories, products, arrivals, guest profiles, and likes from the NextGen backend API. Product images are served from the backend's local upload directory.

The Expo API URL is compiled into app builds. Set `EXPO_PUBLIC_API_URL` before creating a native build, and use the server's HTTPS URL only after you intentionally configure TLS/public access.
