# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Running on a phone with Expo Go

This project is **Expo SDK 57** (`expo` in package.json). Expo Go embeds **exactly one**
SDK version and it must match — there is no "SDK 54 and upwards" range. A mismatch shows
up on iOS as *the app opening and closing instantly with nothing in the Metro logs*.

**The App Store / Play Store build of Expo Go is capped at SDK 54** — Apple never approved
SDK 55+. So the store app will not run this project. Get a matching SDK 57 client instead:

| Device | How to get Expo Go SDK 57 |
| --- | --- |
| Android phone | [expo.dev/go](https://expo.dev/go?sdkVersion=57&platform=android&device=true) — pick SDK 57, download the APK, install it. Uninstall the Play Store Expo Go first. |
| iPhone (free) | [sign.expo.dev](https://sign.expo.dev/) — signs an SDK 57 build with your free Apple ID. The certificate expires after ~7 days, then reinstall. |
| iPhone (paid) | `eas go` — installs via TestFlight, no weekly expiry. Requires Apple Developer Program membership. |
| Simulator | `npx expo start` then press `i` / `a`; the correct Expo Go is downloaded automatically. |

Then `npx expo start` and scan the QR code.

### What does not work in Expo Go

Every dependency here is Expo Go compatible except **passkey sign-in**. `react-native-passkeys`
is a third-party native module that Expo Go cannot load, but it is reached only through the
`optional()` try/catch wrapper in `decane-connect-kit-expo`, so it fails soft — the app runs
and sign-in falls back to the non-passkey tiers. See `src/lib/auth/decane.ts`.

For passkeys, Face ID approval and anything else needing real native code, use a development
build (`npx expo run:ios` / `npx expo run:android`). A development build never has SDK-match
problems and supports every package in this project.

### Keeping dependencies aligned

```bash
npx expo install --check   # report drift from the SDK 57 pinned versions
npx expo install --fix     # correct it
npx expo-doctor            # full 21-check diagnostic
```

`expo-constants` is pinned via `overrides` in package.json — `expo-auth-session` and
`expo-linking` otherwise pull nested duplicate copies, which expo-doctor flags.

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
