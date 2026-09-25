# NextGen Mobiles — Expo Mobile App

Native React Native / Expo conversion of the NextGen Mobiles storefront.

## Run locally

1. Install Node.js LTS.
2. Open this folder in VS Code.
3. Run `npm install`.
4. Start Expo with `npx expo start`.
5. Scan the QR code with Expo Go, or use an Android emulator.

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
- Repository catalog as the source of truth

## Data and images

The app reads the public catalog from the repository main branch and converts relative asset paths to GitHub raw URLs. This keeps the mobile project lightweight while retaining the existing website assets.

For an offline production build, copy the image assets into this Expo project and switch image sources to local assets.
