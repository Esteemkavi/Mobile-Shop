# NextGen Mobiles — Expo Mobile App

Native React Native / Expo conversion of the NextGen Mobiles storefront.

## Run locally

1. Install Node.js LTS.
2. Open this folder in VS Code.
3. Run npm install.
4. Start Expo with npx expo start.
5. Scan the QR code with Expo Go, or press a for an Android emulator.

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
