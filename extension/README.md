# AdLibrarySpy Chrome extension

Click the icon on any Shopify store to see its traffic (with the source and month), live Meta ads, top
products, apps and pixels.

- **Permissions:** only `activeTab` + `scripting`, and only once you click. Nothing runs in the background,
  and no browsing history leaves your machine.
- **What it sends:** the hostname of the tab you clicked, to `adlibraryspy.com/api/public/store`. That's all.
  Privacy policy: https://adlibraryspy.com/privacy/extension

## Install from source

1. `chrome://extensions` → turn on **Developer mode**
2. **Load unpacked** → pick this `extension/` folder

`lib.js` holds the logic and is tested under plain Node (`node --test extension/test.mjs`).
