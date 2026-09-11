# Vivarium Gen 2 Character Encyclopedia

A working private web app: visual character browsing, search and status filters, direct character URLs, editable profiles, image uploads, render review, full-size lightbox with keyboard navigation, and protected identity references. Zara Solano is Gen 2 character 01; her Foundry status remains **Not run**.

## Run

Requires Node.js 20 or newer. No packages, API keys, compilation, or external services are required.

```sh
cd encyclopedia
npm start
# Open http://127.0.0.1:4317/characters
```

`npm test` runs the isolated persistence, upload, identity-lock, validation, and request-boundary tests. `npm run check` checks server and browser JavaScript syntax. `npm run dev` restarts the server when source changes; refresh the browser for UI edits.

## Hosted library

The production build runs on ChatGPT Sites with a durable SQL library and private image storage. Sign in with ChatGPT to browse or edit it from a phone or computer. The first owner-only visit claims the library for that ChatGPT account.

The app exposes the same safe character operations in two places:

- **ChatGPT Work / Codex:** page tools are available while the live site is open in the built-in browser.
- **Ordinary ChatGPT chats:** connect the site's `/api/mcp` URL as a custom app. OAuth grants read/write access to the owner account; every write records its source, and identity images still require explicit review in the website.

Builds are bundled with `npm run build`. Database migrations live in `drizzle/`; `.openai/hosting.json` binds the SQL database as `DB` and image storage as `BUCKET`. `SITE_ORIGIN` must equal the public site origin.

## Local development data

The first start copies `seed.json` into ignored `data/library.json`. Uploaded files live in `data/assets/`. Back up **the entire data directory together**. `VIVARIUM_DATA_DIR` can point at an absolute private storage directory; `PORT` defaults to 4317. Run one server process per data directory. Writes are serialized and the library file is atomically replaced.

The public repository intentionally contains no private character images or imported Notion dossier. A fresh clone shows Zara's starter record with an honest missing-reference state. To attach the original: open Zara → Gallery → upload the image → open it → Make an identity reference → explicitly confirm and lock. The first reference becomes the primary image. Existing primary references are never silently replaced. The delivered local library already contains the supplied original Zara image and established visual traits from Notion.

The development server binds only to loopback and validates Host and Origin. Do not expose it with a public tunnel or widen its listener; use the authenticated hosted build.

## Curation rules

- Images enter **Review**. Accepting a render does not make it an identity reference.
- Identity promotion requires an explicit confirmation. Locked assets reject subsequent gallery mutations on the server.
- Rejected renders stay in the archive as evidence. There is no destructive delete endpoint.
- Original image bytes are preserved and SHA-256 fingerprints detect duplicates for each character.
- PNG, JPEG, and WebP intake is limited to 12 MB per image. SVG/HTML uploads are not served.
- Profiles and reference roles are independent of Foundry status; editing a profile does not certify it.
- The UI distinguishes immutable identity, signature traits, and flexible scene choices.

## Project boundaries and next extensions

This additive `encyclopedia/` application does not modify the prompt pipeline, `FOUNDRY/`, `characters/`, plugins, or the existing `vivarium-lab/` control plane. There was no existing app framework or package manager to preserve. The browser client is shared between local development and the hosted Worker so the same encyclopedia is available in both environments.

`schemaVersion: 1` separates `characters`, `assets`, and timestamped `events`; records use stable IDs, asset ownership, provenance, and per-record `extensions`/`metadata`. The storage boundary is inside `createApp` in `server.mjs`. Future Foundry imports should validate an explicit versioned format and retain source provenance; future anti-clone tooling should consume the identity fields and write editorial audits separately. Neither is presented as implemented today.

Sources consulted on 2026-09-11:

- User's Greet Addy handoff: Gen 2 sequence, Zara starter, Profile / Gallery / Identity References, Building / Foundry Not Run.
- Notion Zara Solano registry: established visual traits; deeper identity, voice, occupation and history remain undeveloped.
- Notion Character Page Standard — Encyclopedia v2: immutable/signature/flexible hierarchy; review before acceptance; identity authority distinct from render status.

The existing `characters/keep-pile/zara-solano/reference.svg` is only a placeholder linking to an external workflow. It is preserved, not used as Zara's image.
