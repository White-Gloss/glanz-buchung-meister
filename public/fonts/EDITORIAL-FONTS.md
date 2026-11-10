# Editorial fonts

Downloaded on 2026-11-10 from Fontsource npm packages, version **5.3.0**.
The WOFF2 files are unchanged upstream Latin subsets; only filenames differ.
Both fonts are distributed under SIL Open Font License 1.1. Their complete
upstream licenses are included beside the font files.

| Local file | Upstream package / file | Style and weight axis | Bytes |
| --- | --- | --- | --- |
| `cormorant-garamond-latin-400.woff2` | `@fontsource/cormorant-garamond` / `files/cormorant-garamond-latin-400-normal.woff2` | normal, 400 | 22,876 |
| `cormorant-garamond-latin-variable.woff2` | `@fontsource-variable/cormorant-garamond` / `files/cormorant-garamond-latin-wght-normal.woff2` | normal, 300–700 | 37,640 |
| `geist-latin-variable.woff2` | `@fontsource-variable/geist` / `files/geist-latin-wght-normal.woff2` | normal, 100–900 | 29,400 |

Sources:

- [Cormorant Garamond archive](https://registry.npmjs.org/@fontsource-variable/cormorant-garamond/-/cormorant-garamond-5.3.0.tgz), [upstream project](https://github.com/CatharsisFonts/Cormorant), license: `cormorant-garamond-OFL.txt`.
- [Cormorant Garamond regular archive](https://registry.npmjs.org/@fontsource/cormorant-garamond/-/cormorant-garamond-5.3.0.tgz), same upstream project and license.
- [Geist archive](https://registry.npmjs.org/@fontsource-variable/geist/-/geist-5.3.0.tgz), [upstream project](https://github.com/vercel/geist-font), license: `geist-OFL.txt`.

The Latin subsets include `ÄÖÜäöüß`, the euro sign and German typographic
quotation marks. Fontconfig successfully decoded both WOFF2 files and verified
their character maps, including U+00C4/U+00D6/U+00DC/U+00DF/U+00E4/U+00F6/U+00FC,
U+20AC and U+201E/U+201C. No external font request is needed at runtime.

SHA-256:

```text
d80df8ff5aecd299a61549f9e29ab1ed0b9b05f4ea71d50fe978e07d5240b235  cormorant-garamond-latin-variable.woff2
8048ac209bec741e1c29cd0cfac5aac1c0c2ba8c3ddbd4a58fa9bd92ef5c63c2  cormorant-garamond-latin-400.woff2
19f9c92546aa300c312235e3125af1b81394d8db9a4bc4a425cd5b641d2d54e1  geist-latin-variable.woff2
```

The exact Cormorant 400 face follows the variable face in CSS and is the only
Cormorant preload. Public headings and `.font-display` labels use 400; other
weights can request the variable face on demand. Fontconfig confirmed that the
regular face has the same character coverage as the variable Latin face.
The two public preloads total **52,276 bytes**, saving **14,764 bytes (22%)**
against preloading both variable fonts. CI network diagnostics must confirm
that the variable Cormorant file is not also requested in the first viewport.
Barlow files remain available for the existing application/admin design.
