# ExpiryDesk

A private, offline-first website that tracks expiration dates for food, medicines, cosmetics, documents, and personal items.

## What it does

- Add items with a name, category, expiration date, and optional notes.
- Automatic countdowns in local calendar days: "Expires in 5 days", "Expires today", "Expired 3 days ago".
- Status badges: Safe, Expiring soon, Expired, Used, Discarded.
- A warning threshold of 3, 7, 14, or 30 days, saved in the browser.
- Search, category and status filters, and sorting by earliest, latest, or alphabetical.
- Edit, delete, mark used or discarded, and restore items.
- Everything is stored in the browser's localStorage. No account, no cloud, no external API.
- Export a JSON backup and import it back. Import validates the whole file first: if any record has a bad date, bad category, bad status, a missing field, or a duplicate ID inside the file, the entire import is rejected and nothing changes. Valid imports add new items and skip items already present.

## Run locally

Open `index.html` in a browser, or serve the folder:

```
python3 -m http.server 8000
```

Then open http://localhost:8000

## Files

- `index.html` — four views: Dashboard, All Items, Add Item, Settings.
- `style.css` — responsive layout, sidebar on desktop, bottom navigation on mobile.
- `script.js` — all logic, localStorage persistence, backup import and export.

No seeded example entries. The app starts empty.
