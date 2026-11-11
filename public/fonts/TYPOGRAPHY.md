# White-Gloss fonts

The website uses **Syne** for headings, controls, navigation and prominent
figures; **Plus Jakarta Sans** supplies body copy, form values, tables and legal
copy. The browser fonts are local files, shared by the public website, CMS,
dialogs, contact card and installation page.

## Licensed source

Both families are distributed under the **SIL Open Font License 1.1**. Their
complete licenses are included alongside the font files.

- Syne **2.200**, variable weight **400–800**:
  <https://github.com/google/fonts/tree/c30b221beb0c1da59d563feb91ec8656a1fa972a/ofl/syne>
- Plus Jakarta Sans **2.071**, variable weight **200–800**:
  <https://github.com/google/fonts/tree/c30b221beb0c1da59d563feb91ec8656a1fa972a/ofl/plusjakartasans>

`font-source-manifest.json` records the pinned Google Fonts commit, original
TTF/OFL/metadata URLs, SHA256 hashes, static instances and browser subsets.
The original TTF entries describe the source files; their public download is
not needed at runtime. Static PDF instances are embedded in server code.

## Browser loading

`white-gloss.css` declares the two families and disjoint Latin/extended
Unicode subsets. German text, euro amounts, punctuation and common arrows
are in the Latin files. Only those two files are preloaded:

| File | Bytes |
| --- | ---: |
| `syne-latin-variable.woff2` | 39,640 |
| `plus-jakarta-sans-latin-variable.woff2` | 36,656 |
| `syne-latin-ext-variable.woff2` | 31,740 |
| `plus-jakarta-sans-latin-ext-variable.woff2` | 34,380 |

The initial two fonts total **76,296 bytes**. Extended customer names retain
the complete original Unicode coverage and load their subset only when used.
`font-display: swap` keeps text available while the local files arrive.
There are no runtime requests to Google Fonts and no CSP expansion.

## PDFs

Newly generated PDFs embed static **Jakarta 400/500** and **Syne 700/800**
instances with their correct font names. Stored PDFs and signature originals
are unchanged. The bundled bytes avoid runtime HTTP or working-directory
dependencies; `pdf-lib` embeds only the used glyphs in each new document.

**Noto Sans 2.008** is the PDF-only fallback for graphemes missing from a role
font, including Greek/Cyrillic customer names and Jakarta's missing soft
hyphen. Its unchanged licensed source is the existing White-Gloss Panel font;
the manifest pins that repository commit and SHA256, and its OFL is included.
It is not a browser font. Entire grapheme clusters stay together, and line
wrapping, right alignment and drawing use identical font runs.

Every one of the old Helvetica font's 218 supported code points is covered.
Characters that none of these fonts supports retain the website's existing
`?` replacement, including unsupported emoji and CJK characters. This change
does not transliterate customer names or introduce a new PDF error response.

Static instances were produced with FontTools `instantiateVariableFont`,
`updateFontNames=True`. Browser subsets use FontTools subset with all layout
features retained and `recalcTimestamp=False`. The manifest also records each
TTF head timestamp and the exact FontTools version for reproduction.

Given the exact local TTF instances whose hashes are in the manifest, run:

```sh
node scripts/write-document-fonts.mjs /path/to/local/font-instances
```

This regenerates the compressed server font data without accessing a network.
`scripts/typography-fonts.test.mjs` checks source integrity, German/euro glyphs,
complete and disjoint subset coverage, static PDF weights, Unicode text,
all previously supported characters, grapheme runs, document identities and
multipage PDF creation. The existing isolated CI browser suites also wait for
the real font faces and `document.fonts.ready`, then verify the computed text
roles on public pages, navigation, forms, login and Studio. Header screenshots
at 960, 1024 and 1100px cover the intermediate layout boundary.
