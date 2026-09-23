# Photographic centrepieces

`CenterpieceAssetResolver` in `js/app.js` loads transparent WebP artwork for
the registered centrepieces and corner decorations, with the original PNGs
retained as local decode fallbacks. The assets were generated specifically
for this project with no embedded text, logos or watermarks.

## What the resolver expects

For every id in the resolver's `ASSET_DIRS` registry, the resolver tries a
transparent-background WebP first and then the matching PNG:

```
assets/centerpieces/<id>.webp   (then <id>.png)
assets/decorations/<id>.webp    (then <id>.png)
```

The current registry contains 16 centrepieces and four decorations. Keep
`ASSET_DIRS` in `js/app.js` as the source of truth when adding or removing an
asset. The legacy `champagne-gala` id remains in use for Luxury Balloons so
existing saved cards and backups continue to resolve correctly.

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
- All 20 WebP paths are included in `SHELL_ASSETS` so a first successful
  installation precaches the compact primary assets for offline use. The PNG
  fallbacks remain bundled but are not part of the mandatory precache.
