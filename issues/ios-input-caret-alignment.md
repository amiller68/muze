# iOS Input Caret Alignment Bug

**Status:** Planned
**Epic:** None (standalone bug)
**Dependencies:** None

## Problem

On iOS (tested in Simulator), the text input caret (cursor) appears **below** the input field's visible boundary when typing in the "New Collection" or "New Mix" modal dialogs. The text itself renders correctly inside the input, but the blinking caret is offset downward by approximately one line height.

**Screenshot location:** The issue was observed in the create modal at `src/App.tsx` lines 1216-1254.

## Environment

- iOS Simulator
- Tauri 2.0 mobile build
- WebKit (WKWebView)

## Root Cause (Suspected)

This is a known iOS WebKit bug related to caret positioning. Potential causes include:

1. `overflow: hidden` on ancestor elements (`html`, `body`, `#root` in `global.css`)
2. Flexbox centering (`flex items-center justify-center`) on fixed-position modal containers
3. CSS transforms on parent elements affecting caret calculation
4. Border-radius without explicit border causing iOS to miscalculate input bounds

## Attempted Fixes (All Failed)

### 1. Explicit line-height and font-size
```tsx
style={{
  "-webkit-appearance": "none",
  "line-height": "1.5",
  "font-size": "16px",
}}
```

### 2. Fixed height instead of padding
```tsx
class="w-full h-12 px-4 ..."  // Instead of py-3
```

### 3. Global CSS input fixes
```css
input[type="text"],
input[type="search"],
textarea {
  font-size: 16px;
  -webkit-appearance: none;
  appearance: none;
  transform: translateZ(0);
}
```

### 4. Restructured modal centering
Changed from single flex container to nested structure:
```tsx
<div class="fixed inset-0 ... overflow-y-auto">
  <div class="min-h-full flex items-center justify-center">
    <div class="... my-auto">
```

### 5. Added explicit border
```tsx
class="... border border-neutral-700"  // Instead of no border
```

### 6. Reduced border-radius
```tsx
class="... rounded-lg"  // Instead of rounded-xl
```

### 7. Position relative with z-index
```tsx
class="relative ..."
style={{ "z-index": 1 }}
```

## Files Involved

- `src/App.tsx` - Modal component (lines ~1216-1254)
- `src/styles/global.css` - Global input styles (lines 88-96)

## Potential Solutions to Try

1. **Remove `overflow: hidden` from ancestors** when modal is open
   - The global.css sets `overflow: hidden` on `html`, `body`, `#root`
   - This is a known cause of iOS caret bugs in fixed-position contexts

2. **Use `position: absolute` modal instead of `position: fixed`**
   - Fixed positioning combined with overflow:hidden causes WebKit issues

3. **Add `will-change: transform`** to the input
   - Forces GPU compositing which can fix caret rendering

4. **Use a native input wrapper**
   - Wrap input in a div with explicit dimensions and overflow:visible

5. **Test with `contenteditable` div** instead of input
   - Different rendering path may avoid the bug

6. **File WebKit bug report**
   - This appears to be a browser-level issue

## Acceptance Criteria

- [ ] Caret appears at correct position (aligned with text) in iOS Simulator
- [ ] Works in both "New Mix" and "New Collection" modals
- [ ] No regression on desktop browsers
- [ ] `make check` passes

## Verification

1. Run iOS build: `pnpm tauri ios dev`
2. Navigate to browser view
3. Tap "+ Add" button
4. Select "Mix" or "Collection"
5. Type in the name input
6. Verify caret appears inline with text, not below the input

## References

- WebKit Bug Tracker (search for "caret position fixed")
- Stack Overflow: "iOS Safari input caret position wrong"
- Known issue with WKWebView and overflow:hidden ancestors
