# WAKILISHA Chart Ingestion Studio

## 1. Project Description
The Chart Ingestion Studio is the admin backend for WAKILISHA's flagship chart product. It provides a serious, audit-focused workflow for ingesting, normalizing, matching, reviewing, ranking, and publishing chart editions. The React frontend serves as the reference implementation for how the ingestion system should feel, behave, and expose state.

## 2. Page Structure

### Admin Routes
- `/admin/charts/dashboard` — Active jobs, failed jobs, latest published editions, blocking issues
- `/admin/charts/families` — Chart family management
- `/admin/charts/ingest` — Ingest jobs list
- `/admin/charts/ingest/:jobId` — Job detail with stepper
- `/admin/charts/ingest/:jobId/sources` — Source manager
- `/admin/charts/ingest/:jobId/candidates` — Normalized candidates
- `/admin/charts/ingest/:jobId/matching` — Canonical matching review
- `/admin/charts/ingest/:jobId/ranking` — Ranking preview
- `/admin/charts/ingest/:jobId/issues` — Review issues
- `/admin/charts/ingest/:jobId/draft` — Draft edition
- `/admin/charts/editions` — Published editions
- `/admin/charts/snapshots` — Immutable snapshots

### Public Routes (separate, not part of this task)
- `/charts` — Chart directory
- `/charts/:series/:edition` — Chart edition

## 3. Core Features
- [ ] Ingest job dashboard with KPIs and status overview
- [ ] Chart family management
- [ ] Multi-source ingestion (Spotify, Apple, YouTube, CSV, manual, airplay, legacy, previous edition)
- [ ] Source fetch status tracking with background processing simulation
- [ ] Normalized candidate table with deduplication
- [ ] Canonical matching review with confidence scores
- [ ] Eligibility rule evaluation
- [ ] Review issues queue (high/medium/low severity)
- [ ] Ranking preview with score breakdown
- [ ] Draft edition creation
- [ ] Publish readiness with blocking checks
- [ ] Immutable snapshot viewing

## 4. Data Model Design

The frontend uses mocked data structured exactly like the backend expects:

### IngestJob
- id, chartFamilyId, editionId, status, editionDate, periodStart/End
- chartSize, rulesetKey, scoringModelKey, createdBy, createdAt
- sourceSummary, jobSummary, errorMessage

### IngestSource
- id, jobId, sourceType, provider, sourceUrl, weight, priority
- status, rawCount, normalizedCount, errorCount, fetchedAt

### RawSourceItem
- id, jobId, sourceId, title, artistLine, isrc, rawPayload

### IngestCandidate
- id, jobId, normalizedTitle, normalizedArtistLine, isrc, artworkUrl
- sourcePositions, sourceMetrics, eligibilityStatus, score, calculatedRank
- finalRank, status

### IngestMatch
- id, jobId, candidateId, canonicalTrackId, matchConfidence, matchMethod

### ReviewIssue
- id, jobId, candidateId, severity, issueType, message, status, blocking

## 5. Backend / Third-party Integration Plan
- WordPress Plugin: Backend source of truth (chart families, ingest jobs, publish pipeline)
- Supabase: Not connected yet — mock data layer for now
- React frontend consumes mock API that mirrors expected WordPress REST endpoints

## 6. Development Phase Plan

### Phase 1: Foundation & Dashboard
- Goal: Build the route structure, service layer, shared layout, and dashboard
- Deliverable: /admin/charts/dashboard, /admin/charts/ingest list, /admin/charts/ingest/:jobId shell

### Phase 2: Job Detail Stepper Screens
- Goal: Build each stepper screen for the ingestion wizard
- Deliverable: Sources, candidates, matching, ranking, issues, draft screens

### Phase 3: Families, Editions, Snapshots
- Goal: Build supporting admin screens
- Deliverable: Families list, editions list, snapshot viewer

### Phase 4: Polish & Integration
- Goal: Connect to real backend API when ready
- Deliverable: Replace mock API with real WordPress REST endpoints