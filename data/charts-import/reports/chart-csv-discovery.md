# CSV Chart Discovery Report

Generated: 2026-05-30T12:00:00.000Z
Scan directory: `data/supabase-imports/2026-05-30/raw`
Total CSV files: 4
Likely chart CSVs: 3

---

## wakilisha_top_40_2026-05-30.csv

- **Chart type**: top_40
- **Confidence**: high
- **Row count**: 40
- **Detected date**: 2026-05-30
- **Detected week**: 2026-W22
- **Mapping status**: mapped
- **Validation status**: valid
- **Headers**: rank, track_title, artist_name, isrc, spotify_url, youtube_url, apple_music_url, artwork_url, album, label, chart_week

### Sample rows

| rank | track_title | artist_name | isrc | spotify_url | youtube_url | apple_music_url | artwork_url | album | label | chart_week |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Love Me JeJe | Tems | NGA0H2400001 | https://open.spotify.com/track/abc123 | https://youtube.com/watch?v=xyz789 | https://music.apple.com/track/def456 | https://i.scdn.co/image/abc123 | Born in the Wild | RCA Records | 2026-W22 |
| 2 | Ojuelegba | WizKid | USUM72012345 | https://open.spotify.com/track/wiz001 | https://youtube.com/watch?v=wiz002 | https://music.apple.com/track/wiz003 | https://i.scdn.co/image/wiz001 | Ayo | Starboy Entertainment | 2026-W22 |

---

## wakilisha_top_100_2026-05-30.csv

- **Chart type**: top_100
- **Confidence**: high
- **Row count**: 100
- **Detected date**: 2026-05-30
- **Detected week**: 2026-W22
- **Mapping status**: mapped
- **Validation status**: valid
- **Headers**: position, title, artist, isrc, spotify_url, youtube_url, apple_music_url, artwork_url, album, chart_date

### Sample rows

| position | title | artist | isrc | spotify_url | youtube_url | apple_music_url | artwork_url | album | chart_date |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Love Me JeJe | Tems | NGA0H2400001 | https://open.spotify.com/track/abc123 | https://youtube.com/watch?v=xyz789 | https://music.apple.com/track/def456 | https://i.scdn.co/image/abc123 | Born in the Wild | 2026-05-30 |

---

## wakilisha_afrobeats_20_2026-05-30.csv

- **Chart type**: afrobeats
- **Confidence**: high
- **Row count**: 20
- **Detected date**: 2026-05-30
- **Detected week**: 2026-W22
- **Mapping status**: partial
- **Validation status**: warnings
- **Headers**: rank, track, artist, isrc, spotify_url, release, chart_week
- **Validation issues**: Missing YouTube URL column; Missing Apple Music URL column; Missing artwork_url column

### Sample rows

| rank | track | artist | isrc | spotify_url | release | chart_week |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Calm Down | Rema | NGA0H2300001 | https://open.spotify.com/track/rema001 | Rave & Roses | 2026-W22 |

---

## legacy_import_2026-05-30.csv

- **Chart type**: generic_ranked
- **Confidence**: medium
- **Row count**: 82
- **Detected date**: 2026-05-30
- **Detected week**: 2026-W22
- **Mapping status**: partial
- **Validation status**: warnings
- **Headers**: position, title, artist, label, notes
- **Validation issues**: Missing ISRC column; Missing Spotify URL column; Missing artwork_url column; Legacy notes column will be ignored

### Sample rows

| position | title | artist | label | notes |
| --- | --- | --- | --- | --- |
| 1 | Unknown Track | Unknown Artist | Unknown Label | Legacy data — ISRC missing |

---