import express from 'express';
import * as repo from '../../repository/wakilishaRepaired';

const router = express.Router();

// Artist endpoints
router.get('/artists/:id', async (req, res) => {
  const artistId = req.params.id;
  const artistData = await repo.getArtistById(artistId);
  const tracks = await repo.getTracksByArtist(artistId);
  res.json({ artist: artistData, tracks });
});

// Track endpoints
router.get('/tracks/:id', async (req, res) => {
  const trackId = req.params.id;
  const chartEntries = await repo.getChartEntries(trackId);
  const playback = await repo.getPlaybackSources(trackId);
  res.json({ chartEntries, playback });
});

// Release endpoints
router.get('/releases/:id', async (req, res) => {
  const releaseId = req.params.id;
  const releaseTracks = await repo.getReleaseTracks(releaseId);
  res.json({ releaseTracks });
});

// Chart endpoints
router.get('/charts/:id', async (req, res) => {
  const trackId = req.params.id;
  const chartEntries = await repo.getChartEntries(trackId);
  const artistData = await Promise.all(chartEntries.map(async entry => {
    return repo.getTracksByArtist(entry.track_id);
  }));
  res.json({ chartEntries, artistData });
});

// Content route endpoint
router.get('/content/:slug', async (req, res) => {
  const slug = req.params.slug;
  const content = await repo.getContentRoute(slug);
  res.json(content);
});

export default router;