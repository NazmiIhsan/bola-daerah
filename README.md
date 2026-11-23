# Bola Daerah

A small football management game set in Selangor. Pick a district or mukim club, set your tactics, build your squad in the transfer market and the youth academy, watch your matches as 2D highlights, and climb from Division 2 to the top. Available in English and Bahasa Melayu.

## Play locally

```bash
npm install
npm run dev        # open the printed http://localhost:5173 link
```

## Test

```bash
npm test
```

## Build and share

```bash
npm run build      # creates dist/
npx vite preview   # check the built version locally
```

`dist/` is a static site that works from any folder, so you can upload it to any free static host (GitHub Pages, Netlify, Cloudflare Pages…) and send your friends the link. Each player's saves stay in their own browser. Use **Settings → Export save file** to back up a save or move it to another device.

## Structure

- `src/game/`: rules and simulation (pure TypeScript, seeded randomness)
- `src/i18n/`: English and Malay text and match commentary
- `src/save/`: save slots (IndexedDB), export and import
- `src/ui/`: React screens and the 2D pitch
