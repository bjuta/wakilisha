/**
 * Normalization Module — Unit Tests
 * src/services/chartsScoring/normalize.ts
 *
 * Covers: §3.1–§3.3 normalization, lead artist extraction,
 * key building, batch normalization, deduplication.
 *
 * v1.0.2 update (2026-06-14):
 * - Added zero-width character stripping tests
 * - Added combining diacritic stripping tests (real assertions, not substring matches)
 * - Added normalize_title_no_brackets() tests
 * - Fixed false-positive diacritic test (was using toContain)
 *
 * IMPORTANT: These tests drive 100% line + branch coverage on normalize.ts.
 * All edge cases and code paths must be exercised here.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  normalize_title,
  normalize_artist,
  lead_artist_key,
  build_normalized_key,
  normalize_batch,
  deduplicate_pairs,
  normalize_title_no_brackets,
} from '@/services/chartsScoring/normalize';

describe('§3 — normalize_title()', () => {
  it('lowercases all text', () => {
    expect(normalize_title('HELLO WORLD')).toBe('hello world');
    expect(normalize_title('ON FIRE!!!')).not.toContain('ON');
  });

  it('strips trailing/leading whitespace and collapses internal spaces', () => {
    expect(normalize_title('  hello   world  ')).toBe('hello world');
  });

  it('removes parenthetical content', () => {
    expect(normalize_title('Song Title (Radio Edit)')).toBe('song title');
    expect(normalize_title('Buga [Remix]')).toBe('buga');
    expect(normalize_title('Track {version}')).toBe('track');
  });

  it('removes feat./ft./featuring credit', () => {
    expect(normalize_title('Song feat. Artist B')).not.toContain('feat');
    expect(normalize_title('Song ft. Artist B')).not.toContain('ft');
    expect(normalize_title('Song featuring Artist B')).not.toContain('featuring');
  });

  it('strips combining diacritics after NFKD — exact match not substring', () => {
    // Before hardening: "Café" → "cafe\u0301" (toContain was a false positive)
    // After hardening:  "Café" → "cafe" (combining mark stripped)
    expect(normalize_title('Café')).toBe('cafe');
    expect(normalize_title('Björk')).toBe('bjork');
    expect(normalize_title('Nīūnyonaga')).toBe('niunyonaga');
    expect(normalize_title('Crème Brûlée')).toBe('creme brulee');
  });

  it('strips zero-width and invisible formatting characters', () => {
    // U+2060 = word joiner — backfill v11 lesson
    expect(normalize_title('State\u2060Of\u2060My\u2060Heart')).toBe('stateofmyheart');
    // U+200B = zero-width space
    expect(normalize_title('I\u200BHATED\u200BYOUR\u200BRELATIONSHIP')).toBe('i hated your relationship');
    // U+FEFF = BOM / zero-width no-break space
    expect(normalize_title('\uFEFFSioni Haja')).toBe('sioni haja');
    // U+00AD = soft hyphen
    expect(normalize_title('soft\u00ADhyphen')).toBe('softhyphen');
    // Mixed invisible chars
    expect(normalize_title('\u200BHello\u2060\u200BWorld\uFEFF')).toBe('hello world');
  });

  it('handles combining diacritics + zero-width chars together', () => {
    // Real-world regression: title with both combining chars AND zero-width joiner
    expect(normalize_title('Café\u2060del\u2060Mar')).toBe('cafe del mar');
  });

  it('replaces hyphens, en-dashes, em-dashes with spaces', () => {
    expect(normalize_title('song-title')).toBe('song title');
    expect(normalize_title('song\u2013title')).toBe('song title'); // en-dash
    expect(normalize_title('song\u2014title')).toBe('song title'); // em-dash
  });

  it('returns empty string for empty/whitespace-only input', () => {
    expect(normalize_title('')).toBe('');
    expect(normalize_title('   ')).toBe('');
  });

  it('handles East African chart entries', () => {
    expect(normalize_title('7 Days (Radio Edit)')).toBe('7 days');
    expect(normalize_title('Buga (Lo Lo Lo) [Bonus Track]')).toBe('buga');
    expect(normalize_title('ON FIRE!!! (feat. Mr Eazi)')).toMatch(/on fire/);
  });

  it('preserves digits', () => {
    expect(normalize_title('Track 404')).toContain('404');
    expect(normalize_title('7 Days')).toContain('7');
  });

  it('is deterministic — same input always produces same output', () => {
    fc.assert(
      fc.property(fc.string(), (title) => {
        const r1 = normalize_title(title);
        const r2 = normalize_title(title);
        expect(r1).toBe(r2);
      }),
      { numRuns: 500 },
    );
  });

  it('never produces output with invisible characters', () => {
    fc.assert(
      fc.property(fc.string(), (title) => {
        const result = normalize_title(title);
        // Must not contain zero-width chars
        expect(result).not.toMatch(/[\u200B\u200C\u200D\u2060\uFEFF\u00AD]/);
        // Must not contain combining diacritics
        expect(result).not.toMatch(/[\u0300-\u036F]/);
      }),
      { numRuns: 500 },
    );
  });
});

describe('§3 — normalize_title_no_brackets()', () => {
  it('retains parenthetical content but strips brackets', () => {
    expect(normalize_title_no_brackets('7 Days (Radio Edit)')).toBe('7 days radio edit');
    expect(normalize_title_no_brackets('Buga (Remix)')).toBe('buga remix');
    expect(normalize_title_no_brackets('Track [Bonus]')).toBe('track bonus');
  });

  it('still strips featuring credits', () => {
    expect(normalize_title_no_brackets('Song feat. Artist B')).not.toContain('feat');
    expect(normalize_title_no_brackets('Song ft. Artist B')).not.toContain('ft');
  });

  it('strips zero-width chars and combining diacritics', () => {
    expect(normalize_title_no_brackets('Café\u2060(Remix)')).toBe('cafe remix');
    expect(normalize_title_no_brackets('Björk [Live]')).toBe('bjork live');
  });

  it('distinguishes remix from original', () => {
    // normalize_title strips parentheticals → both normalize to "buga"
    // normalize_title_no_brackets keeps them → they differ
    const original = normalize_title_no_brackets('Buga');
    const remix = normalize_title_no_brackets('Buga (Remix)');
    expect(original).toBe('buga');
    expect(remix).toBe('buga remix');
    expect(original).not.toBe(remix);
  });
});

describe('§3 — normalize_artist()', () => {
  it('lowercases all text', () => {
    expect(normalize_artist('BURNA BOY')).toBe('burna boy');
  });

  it('strips featuring credit', () => {
    const result = normalize_artist('Diamond Platnumz feat. Rayvanny');
    expect(result).toContain('diamond platnumz');
    expect(result).not.toContain('rayvanny');
  });

  it('handles ft. abbreviation', () => {
    const result = normalize_artist('Sauti Sol ft. Nyashinski');
    expect(result).toContain('sauti sol');
    expect(result).not.toContain('nyashinski');
  });

  it('handles x separator (collab)', () => {
    const result = normalize_artist('Artist A x Artist B');
    expect(result).not.toContain(' x ');
  });

  it('handles & separator', () => {
    const result = normalize_artist('Artist A & Artist B');
    expect(result).not.toContain(' & ');
  });

  it('collapses whitespace', () => {
    expect(normalize_artist('  Burna   Boy  ')).toBe('burna boy');
  });

  it('handles empty input', () => {
    expect(normalize_artist('')).toBe('');
    expect(normalize_artist('   ')).toBe('');
  });

  it('preserves multi-word artist names', () => {
    expect(normalize_artist('WizKid')).toBe('wizkid');
    expect(normalize_artist('Kizz Daniel')).toBe('kizz daniel');
  });

  it('strips combining diacritics in artist names', () => {
    expect(normalize_artist('Björk')).toBe('bjork');
    expect(normalize_artist('Nīūnyonaga')).toBe('niunyonaga');
    expect(normalize_artist('José González')).toBe('jose gonzalez');
  });

  it('strips zero-width characters in artist names', () => {
    expect(normalize_artist('Artist\u200BN\u200Bame')).toBe('artist name');
    expect(normalize_artist('\uFEFFDiamond Platnumz\u2060')).toBe('diamond platnumz');
  });
});

describe('§3 — lead_artist_key()', () => {
  it('extracts lead artist from feat. credit', () => {
    expect(lead_artist_key('Diamond Platnumz feat. Rayvanny')).toBe('diamond platnumz');
  });

  it('extracts lead artist from ft. credit', () => {
    expect(lead_artist_key('Rema ft. Selena Gomez')).toBe('rema');
  });

  it('extracts lead artist from featuring credit', () => {
    expect(lead_artist_key('Sauti Sol featuring Nyashinski')).toBe('sauti sol');
  });

  it('extracts lead artist from comma-separated list', () => {
    expect(lead_artist_key('WizKid, Tems & Justin Bieber')).toBe('wizkid');
  });

  it('extracts lead artist from & separator', () => {
    expect(lead_artist_key('Sauti Sol & Nyashinski')).toBe('sauti sol');
  });

  it('handles single artist with no credit', () => {
    expect(lead_artist_key('BURNA BOY')).toBe('burna boy');
  });

  it('handles x separator', () => {
    const result = lead_artist_key('Artist A x Artist B');
    expect(result).toBe('artist a');
  });

  it('returns empty string for empty/whitespace input', () => {
    expect(lead_artist_key('')).toBe('');
    expect(lead_artist_key('   ')).toBe('');
  });

  it('normalizes the extracted name', () => {
    expect(lead_artist_key('KIZZ DANIEL feat. Tekno')).toBe('kizz daniel');
  });

  it('strips diacritics from extracted lead artist', () => {
    expect(lead_artist_key('Björk feat. Guest')).toBe('bjork');
    expect(lead_artist_key('Nīūnyonaga ft. Someone')).toBe('niunyonaga');
  });

  it('strips zero-width chars from extracted lead artist', () => {
    expect(lead_artist_key('\u200BLead\u200BArtist\u200B feat. Guest')).toBe('lead artist');
  });
});

describe('§3 — build_normalized_key()', () => {
  it('produces the canonical {title}::{lead_artist} format', () => {
    const key = build_normalized_key('Buga (Lo Lo Lo)', 'Kizz Daniel feat. Tekno');
    expect(key).toMatch(/^buga::kizz daniel$/);
  });

  it('returns empty string when title or artist normalizes to empty', () => {
    expect(build_normalized_key('', 'Artist')).toBe('');
    expect(build_normalized_key('Title', '')).toBe('');
    expect(build_normalized_key('', '')).toBe('');
  });

  it('double-colon separator never appears in normalized title or artist', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        (title, artist) => {
          const key = build_normalized_key(title, artist);
          if (key === '') return; // acceptable for edge cases
          const parts = key.split('::');
          expect(parts.length).toBe(2);
          // Neither part should contain ::
          expect(parts[0]).not.toContain('::');
          expect(parts[1]).not.toContain('::');
        },
      ),
      { numRuns: 2000 },
    );
  });

  it('is deterministic — same inputs always produce same key', () => {
    const key1 = build_normalized_key('ON FIRE!!! (feat. Mr Eazi)', 'Burna Boy');
    const key2 = build_normalized_key('ON FIRE!!! (feat. Mr Eazi)', 'Burna Boy');
    expect(key1).toBe(key2);
  });

  it('handles East African chart entry examples', () => {
    expect(build_normalized_key('Buga (Lo Lo Lo)', 'Kizz Daniel feat. Tekno')).toBe(
      'buga::kizz daniel',
    );
  });

  it('produces diacritic-free keys', () => {
    const key = build_normalized_key('Café del Mar', 'Björk');
    expect(key).toBe('cafe del mar::bjork');
  });

  it('produces zero-width-char-free keys', () => {
    const key = build_normalized_key('\u200BMy\u200BSong\u200B', '\uFEFFArtist\u2060Name');
    expect(key).toBe('my song::artist name');
  });

  it('two inputs differing only in diacritics produce same key', () => {
    const keyWith = build_normalized_key('Café', 'Björk');
    const keyWithout = build_normalized_key('Cafe', 'Bjork');
    expect(keyWith).toBe(keyWithout);
  });
});

describe('§3 — normalize_batch()', () => {
  it('returns same number of items as input', () => {
    const pairs = [
      { title: 'Track A', artist_line: 'Artist A' },
      { title: 'Track B', artist_line: 'Artist B' },
    ];
    const result = normalize_batch(pairs);
    expect(result).toHaveLength(2);
  });

  it('each result has all 6 fields', () => {
    const result = normalize_batch([{ title: 'Buga', artist_line: 'Kizz Daniel feat. Tekno' }]);
    const [r] = result;
    expect(r).toHaveProperty('title');
    expect(r).toHaveProperty('artist_line');
    expect(r).toHaveProperty('normalized_title');
    expect(r).toHaveProperty('normalized_artist');
    expect(r).toHaveProperty('lead_artist_key');
    expect(r).toHaveProperty('normalized_key');
  });

  it('returns empty array for empty input', () => {
    expect(normalize_batch([])).toEqual([]);
  });

  it('normalized_key matches build_normalized_key independently', () => {
    const pairs = [{ title: 'Test Track', artist_line: 'Test Artist ft. Guest' }];
    const [r] = normalize_batch(pairs);
    expect(r.normalized_key).toBe(
      build_normalized_key('Test Track', 'Test Artist ft. Guest'),
    );
  });

  it('diacritic-only differences collapse to same key', () => {
    const pairs = [
      { title: 'Café', artist_line: 'Björk' },
      { title: 'Cafe', artist_line: 'Bjork' },
    ];
    const result = normalize_batch(pairs);
    expect(result[0].normalized_key).toBe(result[1].normalized_key);
  });
});

describe('§3 — deduplicate_pairs()', () => {
  it('returns unique array and removed count for duplicates', () => {
    const pairs = normalize_batch([
      { title: 'Track A', artist_line: 'Artist A' },
      { title: 'Track A', artist_line: 'Artist A' }, // same key
      { title: 'Track B', artist_line: 'Artist B' },
    ]);

    const { unique, removed_count } = deduplicate_pairs(pairs);
    expect(unique).toHaveLength(2);
    expect(removed_count).toBe(1);
  });

  it('returns all items when there are no duplicates', () => {
    const pairs = normalize_batch([
      { title: 'Track A', artist_line: 'Artist A' },
      { title: 'Track B', artist_line: 'Artist B' },
    ]);

    const { unique, removed_count } = deduplicate_pairs(pairs);
    expect(unique).toHaveLength(2);
    expect(removed_count).toBe(0);
  });

  it('keeps the first occurrence when duplicates exist', () => {
    const pairs = normalize_batch([
      { title: 'Track A', artist_line: 'Artist A' }, // first
      { title: 'Track A', artist_line: 'Artist A' }, // duplicate
    ]);

    const { unique } = deduplicate_pairs(pairs);
    expect(unique).toHaveLength(1);
    expect(unique[0].title).toBe('Track A');
  });

  it('skips pairs with empty normalized_key', () => {
    const pairs = normalize_batch([
      { title: '', artist_line: '' }, // empty key
      { title: 'Real Track', artist_line: 'Real Artist' },
    ]);

    const { unique } = deduplicate_pairs(pairs);
    expect(unique.every((p) => p.normalized_key !== '')).toBe(true);
  });

  it('returns empty results for empty input', () => {
    const { unique, removed_count } = deduplicate_pairs([]);
    expect(unique).toHaveLength(0);
    expect(removed_count).toBe(0);
  });
});