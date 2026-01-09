# iOS Deployment via AltStore

## Overview

Muse can be sideloaded to iOS devices using AltStore, which allows installing apps without the App Store.

---

## Prerequisites

1. **Mac with Xcode** installed
2. **Apple ID** (free or paid developer account)
3. **AltServer** running on Mac
4. **AltStore** installed on iOS device
5. **iOS device** connected to same WiFi as Mac

---

## Building the IPA

### 1. Configure Signing

In `src-tauri/gen/apple/`:
- Open the Xcode project
- Set your Team in Signing & Capabilities
- Use your Apple ID for free signing (or paid dev account)

### 2. Build for Release

```bash
# Build iOS release
pnpm tauri ios build --release

# Or via Makefile if available
make ios-release
```

### 3. Locate the IPA

The IPA will be in:
```
src-tauri/gen/apple/build/arm64/release/bundle/ios/Muse.ipa
```

---

## Installing via AltStore

### First-Time Setup

1. **Install AltServer** on Mac from [altstore.io](https://altstore.io)
2. **Connect iPhone** via USB
3. **Install AltStore** to iPhone via AltServer menu
4. **Trust the app** in Settings → General → Device Management

### Sideloading the App

1. Open **AltStore** on iPhone
2. Go to **My Apps** tab
3. Tap **+** and select the `.ipa` file
4. AltStore installs the app with your Apple ID signing

---

## Refresh Cycle

### Free Apple ID Limitations

- Apps expire after **7 days**
- Maximum **3 active apps** sideloaded
- Must refresh before expiration

### Refreshing Apps

AltStore auto-refreshes when:
- iPhone is on same WiFi as Mac running AltServer
- iPhone is plugged in (optional)

**Manual refresh**: Open AltStore → My Apps → Tap refresh icon

### Paid Developer Account ($99/year)

- Apps last **1 year**
- No 3-app limit
- Can distribute via TestFlight

---

## Troubleshooting

### "Unable to Install"

- Ensure AltServer is running on Mac
- Check both devices are on same WiFi
- Try USB connection instead
- Restart AltServer

### "App ID Limit Reached"

Free accounts can only create 10 App IDs per week. Wait 7 days or use a different Apple ID.

### App Crashes on Launch

- Check Xcode console for crash logs
- Ensure audio permissions are granted
- Verify iOS version compatibility (iOS 14+)

### Recording Doesn't Work

- Go to Settings → Muse → Microphone → Enable
- Check audio session configuration in `ios_audio.rs`

---

## Development Workflow

### Quick Iteration

```bash
# Build and run on connected device
pnpm tauri ios dev

# This uses debug signing and hot reload
```

### Testing Release Build

```bash
# Build release IPA
pnpm tauri ios build --release

# Install via AltStore for real-world testing
```

---

## File Locations on Device

Muse stores data in the app's Documents folder:
```
/Documents/Muze/
├── MyProject/
│   └── MyMix/
│       ├── mix.json
│       └── audio/
```

This folder is accessible via:
- Files app → On My iPhone → Muse
- iTunes file sharing (when connected)
