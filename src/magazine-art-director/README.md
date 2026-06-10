# WAKILISHA Magazine Art Director

A living art direction system built into the codebase. Each issue of the magazine gets a unique visual identity driven by one of 10 design school references.

## The 10 Design Schools

| Issue # | School | Mode | Hybrid | Character |
|---------|--------|------|--------|-----------|
| 001 | Editorial Magazine | Dark | × Swiss | Warm, photographic, paced |
| 002 | Swiss | Light | — | Grid-disciplined, restrained |
| 003 | Luxury Fashion Editorial | Light | × Editorial Magazine | Image sovereign, whitespace expensive |
| 004 | Bauhaus | Dark | × Swiss | Geometric primitives, primary colours |
| 005 | Memphis Postmodern | Light | × Editorial Magazine | Colour clashes, stage sets |
| 006 | Japanese Minimal | Light | × Luxury Fashion | Emptiness is content |
| 007 | Modernist Poster | Dark | × Bauhaus | Theatrical scale, single arguments |
| 008 | Information Design | Light | × Swiss | Numbers as typography |
| 009 | Folk Vernacular | Light | × Editorial Magazine | Situated, handmade, warm |
| 010 | Brutalist Web | Dark | × Memphis | Structure visible, friction expressive |

The cycle repeats from Issue 011: same schools, but the reader and the content have evolved.

## Architecture

```
src/magazine-art-director/
├── README.md              — This file
├── index.ts               — Public API
├── types.ts               — Type definitions for the system
├── schools.ts             — All 10 design school definitions with atom priorities
├── engine.ts              — Token generation: school → CSS vars, fonts, spreads
├── briefs.ts              — Issue brief rotation (which school per issue number)
├── schools.css            — CSS identity for each school (light + dark mode)
├── useArtDirector.ts      — React hook: issueNumber → complete tokens
└── issue-briefs/
    ├── issue-001.md       — Editorial Magazine × Swiss brief
    ├── issue-002.md       — Swiss brief
    ├── issue-003.md       — Luxury Fashion Editorial brief
    ├── issue-004.md       — Bauhaus brief
    ├── issue-005.md       — Memphis Postmodern brief
    ├── issue-006.md       — Japanese Minimal brief
    ├── issue-007.md       — Modernist Poster brief
    ├── issue-008.md       — Information Design brief
    ├── issue-009.md       — Folk Vernacular brief
    └── issue-010.md       — Brutalist Web brief
```

## How It Works

1. The magazine issue page calls `useArtDirector(issueNumber)`
2. The hook resolves the design school via `getIssueBrief(issueNumber)`
3. `generateIssueTokens(brief)` produces:
   - CSS custom properties (colours, fonts, rules, surfaces)
   - Active device atoms (which typographic devices to use)
   - Spread type list (which spread types this school prefers)
   - Typography scale (which font family + weights)
   - Mode (light or dark)
4. The tokens are applied as inline CSS vars on the `<main>` element
5. The school class (e.g. `.mag-school-swiss.mag-mode-light`) activates the CSS from `schools.css`
6. The school spread injector adds school-specific spread types to the issue

## School Spread Injectors

Each school gets its signature spread injected into the issue:

- **Swiss + Brutalist** → Grid Manifesto spread
- **Modernist Poster** → Typographic Poster spread  
- **Bauhaus + Information Design** → Number Monument spread
- **Brutalist Web** → Type Specimen spread
- **Information Design** → Data Visualization spread
- **Memphis + Folk** → Pattern Field spread
- **Folk Vernacular** → Archive Wall spread
- **Luxury + Japanese + Editorial** → Photo Essay spread

## Light/Dark Mode

Each school has a mode preference: `light`, `dark`, or `either`.

- Schools that are historically print-medium (Luxury, Japanese, Folk, Memphis) default to light
- Schools with darker energy (Brutalist Web) default to dark
- Schools that work both ways (Swiss, Bauhaus, Editorial) alternate by issue number

Every school has both light and dark colour tokens defined, so a brief can override the default mode.

## Adding a New Issue Direction

To give a specific future issue a bespoke direction:

1. Edit `briefs.ts` and add the `issueNumber` to a specific rotation override
2. Create a new `.md` file in `issue-briefs/` documenting the brief
3. The system handles the rest automatically

## Design School Reference Documents

The 10 schools are derived from the Easel Design School Reference documents:
- `swiss.pdf` — Swiss / International Typographic Style
- `modernist_poster.pdf` — Modernist Poster
- `memphis_postmodern.pdf` — Memphis Postmodern
- `luxury_fashion_editorial.pdf` — Luxury Fashion Editorial
- `japanese_minimal.pdf` — Japanese Minimal
- `information_design.pdf` — Information Design
- `folk_vernacular.pdf` — Folk Vernacular
- `editorial_magazine.pdf` — Editorial Magazine
- `brutalist_web.pdf` — Brutalist Web
- `bauhaus.pdf` — Bauhaus

Each PDF defines: first principles, anti-rules, atom priorities across 7 dimensions (composition, density, typography, colour, imagery, devices, motion), and hybrid compatibility.

The `schools.ts` file is a complete TypeScript implementation of these documents.