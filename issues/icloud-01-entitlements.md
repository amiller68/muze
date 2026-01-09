# iCloud Entitlements Setup

**Status:** Planned
**Epic:** [cloud-sync-integration.md](./cloud-sync-integration.md)
**Dependencies:** None

## Objective

Configure iOS entitlements and Info.plist to enable iCloud Drive document storage.

## Implementation Steps

1. Update `src-tauri/gen/apple/muze_iOS/muze_iOS.entitlements`:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
       <!-- Existing entitlements... -->

       <!-- iCloud Document Storage -->
       <key>com.apple.developer.icloud-services</key>
       <array>
           <string>CloudDocuments</string>
       </array>

       <key>com.apple.developer.icloud-container-identifiers</key>
       <array>
           <string>iCloud.com.krondor.muze</string>
       </array>

       <key>com.apple.developer.ubiquity-container-identifiers</key>
       <array>
           <string>iCloud.com.krondor.muze</string>
       </array>
   </dict>
   </plist>
   ```

2. Update `src-tauri/gen/apple/muze_iOS/Info.plist` for Files app visibility:
   ```xml
   <!-- Add inside the main <dict> -->
   <key>NSUbiquitousContainers</key>
   <dict>
       <key>iCloud.com.krondor.muze</key>
       <dict>
           <key>NSUbiquitousContainerIsDocumentScopePublic</key>
           <true/>
           <key>NSUbiquitousContainerSupportedFolderLevels</key>
           <string>Any</string>
           <key>NSUbiquitousContainerName</key>
           <string>Muze</string>
       </dict>
   </dict>

   <key>UIFileSharingEnabled</key>
   <true/>

   <key>LSSupportsOpeningDocumentsInPlace</key>
   <true/>
   ```

3. Configure iCloud container in Apple Developer Portal:
   - Log into https://developer.apple.com
   - Go to Certificates, Identifiers & Profiles
   - Select your App ID (com.krondor.muze)
   - Enable iCloud capability
   - Create iCloud Container: `iCloud.com.krondor.muze`
   - Assign container to App ID

4. Update provisioning profile to include iCloud capability

## Files to Modify/Create

- `src-tauri/gen/apple/muze_iOS/muze_iOS.entitlements` - Add iCloud entitlements
- `src-tauri/gen/apple/muze_iOS/Info.plist` - Add ubiquitous container config

## Acceptance Criteria

- [ ] Entitlements file includes iCloud document storage keys
- [ ] Info.plist configures ubiquitous container for Files app
- [ ] iCloud container created in Apple Developer Portal
- [ ] Provisioning profile updated with iCloud capability
- [ ] App builds successfully with new entitlements

## Verification

1. Build the iOS app: `pnpm tauri ios build`
2. Install on test device with valid Apple ID
3. Open Files app on device
4. Verify "Muze" folder appears under iCloud Drive
5. Check Settings > [Your Name] > iCloud > Manage Storage shows Muze
