# Bundled web fonts

The `.woff2` files in this directory are third-party open-source typefaces,
vendored so Atul Card Studio renders with correct type metrics on a first load
with no network. They are **not** application data and carry their own licences.

Every family bundled here is released under the
[SIL Open Font License 1.1](https://openfontlicense.org/), which permits
redistribution and embedding in this form.

| Family | Weights bundled | Licence | Source |
| --- | --- | --- | --- |
| Inter | 400, 500, 600 | OFL 1.1 | https://fonts.google.com/specimen/Inter |
| Cormorant Garamond | 500, 600 | OFL 1.1 | https://fonts.google.com/specimen/Cormorant+Garamond |
| Playfair Display | 500, 700 | OFL 1.1 | https://fonts.google.com/specimen/Playfair+Display |
| Montserrat | 500 | OFL 1.1 | https://fonts.google.com/specimen/Montserrat |
| Cinzel | 500, 600 | OFL 1.1 | https://fonts.google.com/specimen/Cinzel |
| Source Sans 3 | 400, 500 | OFL 1.1 | https://fonts.google.com/specimen/Source+Sans+3 |
| Libre Baskerville | 400, 700 | OFL 1.1 | https://fonts.google.com/specimen/Libre+Baskerville |
| Manrope | 400, 500 | OFL 1.1 | https://fonts.google.com/specimen/Manrope |
| DM Serif Display | 400 | OFL 1.1 | https://fonts.google.com/specimen/DM+Serif+Display |
| Work Sans | 400, 500 | OFL 1.1 | https://fonts.google.com/specimen/Work+Sans |
| Noto Sans Gujarati | 400, 600 | OFL 1.1 | https://fonts.google.com/noto/specimen/Noto+Sans+Gujarati |

Only the `latin` and `latin-ext` subsets and the normal (non-italic) styles are
included for the Latin families. Noto Sans Gujarati is bundled in full normal
400 and 600 faces so Gujarati-script festival text works identically offline,
in preview, and in exported PNGs. Several Latin families are variable fonts
whose payload is identical across the weights requested, so those files are
stored once and shared by multiple `@font-face` rules.

Regenerate with:

```
python scripts/fetch_fonts.py
```

That script rewrites `css/fonts.css`; when the file list changes, update
`SHELL_ASSETS` in `sw.js` so the new files stay part of the offline app shell.
