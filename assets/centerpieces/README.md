# Photographic centrepieces

`CenterpieceAssetResolver` in `js/app.js` loads the four transparent PNG
cutouts in this folder before falling back to deterministic canvas painters.
The assets were generated specifically for this project with no embedded
text, logos or watermarks.

## What the resolver expects

For each id below, the resolver accepts a transparent-background PNG or WebP
(the shipped PNG is tried first):

```
assets/centerpieces/belgian-gold-cake.webp   (or .png)
assets/centerpieces/velvet-roses.webp        (or .png)
assets/centerpieces/silk-gift-box.webp       (or .png)
assets/centerpieces/champagne-gala.webp      (or .png; legacy id now displays Luxury Balloons)
```

Requirements for each file:

- Transparent background (alpha channel), no baked-in text/watermark/logo.
- Portrait-card composition — the resolver cover-fits it into a square
  region sized to the current centrepiece-size slider (320-760px at
  preview, same value scaled to the 1200x1760 export), so a roughly
  square-to-portrait crop with the subject centred works best for both the
  circular and framed masks.
- High enough resolution to stay sharp after cover-fit at the 1200x1760
  export (at least ~1200px on the shorter side is a safe minimum).
- Realistic lighting/shadow/texture and clean edges — this is the whole
  point of adding real assets instead of the procedural painters.

## What happens automatically once a file is added

- `CenterpieceAssetResolver.resolve(id)` probes `.webp` then `.png`; the
  first one that loads is cached and used from then on.
- `Centerpieces.paint()` draws it with a soft theme-colour wash inside the
  same halo/ring/sparkle presentation every centrepiece gets in
  `Renderer.renderPhoto`.
- If the file is missing, corrupt, or fails to decode, the existing
  procedural painter for that id renders instead — nothing else changes,
  and no error reaches the user.
- All four PNG paths are included in `SHELL_ASSETS` so a first successful
  installation precaches them for offline use.
