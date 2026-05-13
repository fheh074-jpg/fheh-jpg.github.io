# Kabeb Weather Radar v4

## GitHub Pages Deployment
1. Create a new GitHub repo
2. Upload all 5 files: `index.html`, `style.css`, `app.js`, `sites.js`, `README.md`
3. **Settings → Pages → Source → Deploy from branch → main → / (root) → Save**
4. Live at `https://yourusername.github.io/reponame`

## What's in v4
- Global mosaic via RainViewer (loads in ~1s, NEXRAD Level III colors, 16 frames)
- Single site REF/VEL/CC via IEM Ridge — shows estimated frames immediately while real scans load
- NWS warnings drawn on map — auto-shows panel for tornado/SVR/flood
- SPC Day 1 outlook polygons with legend
- Kabeb Watch system — admin draws polygon, fills title/details, issues watch
- Labels render above radar tiles
- No auto-play on load — press ▶ manually
- Single-site controls hidden when in Global mode

## Hard-coded admin emails (DO NOT CHANGE IN app.js)
- fheh074@gmail.com
- kalebgamer0515@gmail.com
