import {describe,it,expect} from 'vitest';
import {
  WK100_SPOTIFY_EDITORIAL_SOURCES,
  WK100_SPOTIFY_EDITORIAL_METHOD_CONTRACT,
  spotifyEditorialSourceUrl,
  validateWk100SpotifyEditorialNote,
} from '../../src/services/chartsIngestion/wk100SpotifyEditorialSources';

const observedAt='2026-11-04T10:00:00.000Z';
const input=(source:typeof WK100_SPOTIFY_EDITORIAL_SOURCES[number]=
  WK100_SPOTIFY_EDITORIAL_SOURCES[0])=>({
  sourceKey:source.sourceKey,playlistUrl:spotifyEditorialSourceUrl(source.playlistId),
  curatorBylineObserved:'Spotify' as const,
  researcherObservedAtUtc:observedAt,
  acquisitionMode:'researcher_directed_public_observation' as const,
  placements:[
    {displayedPosition:7,titleObserved:'Synthetic Title B',
      artistDisplayObserved:'Synthetic Artist B',spotifyTrackId:'B'.repeat(22)},
    {displayedPosition:2,titleObserved:'Synthetic Title A',
      artistDisplayObserved:'Synthetic Artist A',spotifyTrackId:'A'.repeat(22)},
  ],
});
const invalid=()=>/wk100_spotify_editorial_note_invalid/;

describe('WK100 four required Spotify editorial observations, not consumption data',()=>{
  it('preserves exact four named sources as ONE, lower-weight, nonpublishing family',()=>{
    expect(WK100_SPOTIFY_EDITORIAL_SOURCES.map(x=>x.sourceKey)).toEqual([
      'spotify_editorial_hot_hits_ke','spotify_editorial_nmf_ke',
      'spotify_editorial_made_in_ke','spotify_editorial_gengetone_fire',
    ]);
    expect(WK100_SPOTIFY_EDITORIAL_METHOD_CONTRACT.providerFamiliesCount).toBe(1);
    expect(WK100_SPOTIFY_EDITORIAL_METHOD_CONTRACT.lowerWeightThanQualifiedPrimarySignals).toBe(true);
    expect(WK100_SPOTIFY_EDITORIAL_METHOD_CONTRACT.numericWeightStatus)
      .toBe('requires_phase_3_methodology_approval');
    for(const source of WK100_SPOTIFY_EDITORIAL_SOURCES){
      const note=validateWk100SpotifyEditorialNote(input(source));
      expect(note.providerKey).toBe('spotify_ke');
      expect(note.providerFamily).toBe('spotify_editorial');
      expect(note.providerFamilyContributionCap).toBe(1);
      expect(note.signalClass).toBe('editorial_playlist_placement');
      expect(note.canCollect).toBe(false);
      expect(note.canScore).toBe(false);
      expect(note.canPublish).toBe(false);
      expect(note.collectorReceiptVerified).toBe(false);
      expect(note.originalProviderBytesVerified).toBe(false);
      expect(note.nativePeriodAuthority).toBe('unknown');
      expect(note.nativePeriodStartsAt).toBe(null);
      expect(note.nativePeriodEndsAt).toBe(null);
      expect(note.observedPositionsAreComplete).toBe(false);
      expect(note.curatorVerifiedIndependently).toBe(false);
      expect(note.playlistId).toBe(source.playlistId);
      expect(note.placements.map(p=>p.displayedPosition)).toEqual([2,7]);
      expect(Object.isFrozen(note)).toBe(true);
      expect(Object.isFrozen(note.placements)).toBe(true);
    }
  });
  it('rejects fabricated streams, weekly periods, source IDs and spoofed curator claims',()=>{
    const good=input();
    for(const extra of [
      {streams:12345},{nativeWeek:'2026-11-02'},{canScore:true},
      {collectorReceiptVerified:true},{sourceFetchedAtUtc:observedAt},
    ])expect(()=>validateWk100SpotifyEditorialNote({...good,...extra})).toThrow(invalid());
    for(const changed of [
      {sourceKey:'spotify_ke'},{sourceKey:'spotify_editorial_unreviewed'},
      {playlistUrl:'https://other.example/playlist/37i9dQZF1DWWWXigQZAD8B'},
      {curatorBylineObserved:'Independent Curator'},
      {acquisitionMode:'unattended_scrape'},
      {researcherObservedAtUtc:'2026-11-04'},
      {researcherObservedAtUtc:'2026-02-30T10:00:00.000Z'},
    ])expect(()=>validateWk100SpotifyEditorialNote({...good,...changed})).toThrow(invalid());
  });
  it('preserves real displayed position gaps, but rejects duplicate or invented placements',()=>{
    const good=input();
    const first=good.placements[0];
    for(const placements of [
      [],Array(201).fill(first),
      [{...first,displayedPosition:0}],
      [{...first,displayedPosition:201}],
      [first,{...first,spotifyTrackId:'C'.repeat(22)}],
      [first,{...first,displayedPosition:3}],
      [{...first,spotifyTrackId:'bad-id'}],
      [{...first,titleObserved:'<script>'}],
      [{...first,artistDisplayObserved:'  Spaced'}],
      [{...first,chartEligibleStreams:300}],
    ])expect(()=>validateWk100SpotifyEditorialNote({...good,placements}))
      .toThrow(invalid());
    const note=validateWk100SpotifyEditorialNote(good);
    expect(note.observedDepth).toBe(2);
    expect(note.placements.map(x=>x.displayedPosition)).toEqual([2,7]);
    expect(note.observationStatus).toBe('research_only');
  });
});
