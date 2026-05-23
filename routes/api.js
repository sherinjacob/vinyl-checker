const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const db = require('../db/database');

const router = express.Router();

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const ANALYZE_PROMPT = `Analyze these vinyl record photos and extract information. Return ONLY a valid JSON object with no markdown, no explanation, no code blocks — just raw JSON:

{
  "artist": "Artist or Band Name",
  "album": "Album Title",
  "year": "Release Year or null if not visible",
  "label": "Record Label or null if not visible",
  "tracks": [
    {"side": "A", "position": "1", "title": "Track Title"},
    {"side": "A", "position": "2", "title": "Track Title"},
    {"side": "B", "position": "1", "title": "Track Title"}
  ],
  "confidence": "high or medium or low"
}

Rules:
- Extract ALL visible tracks from the tracklist
- Side is typically "A" or "B"; position is the track number on that side
- If a photo is not a vinyl record, still try your best
- Return ONLY the JSON object`;

router.post('/analyze', async (req, res) => {
  try {
    const { frontImage, backImage } = req.body;
    if (!frontImage && !backImage) {
      return res.status(400).json({ error: 'At least one image is required' });
    }

    const content = [];

    if (frontImage) {
      const base64 = frontImage.replace(/^data:image\/\w+;base64,/, '');
      const mediaType = (frontImage.match(/^data:(image\/\w+);base64,/) || [])[1] || 'image/jpeg';
      content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } });
      content.push({ type: 'text', text: 'Front cover of the vinyl record.' });
    }

    if (backImage) {
      const base64 = backImage.replace(/^data:image\/\w+;base64,/, '');
      const mediaType = (backImage.match(/^data:(image\/\w+);base64,/) || [])[1] || 'image/jpeg';
      content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } });
      content.push({ type: 'text', text: 'Back cover of the vinyl record (usually has the tracklist).' });
    }

    content.push({ type: 'text', text: ANALYZE_PROMPT });

    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content }]
    });

    const raw = response.content[0].text.trim();
    let vinylData;
    try {
      const jsonStr = raw.replace(/^```json\s*|\s*```$/g, '').trim();
      vinylData = JSON.parse(jsonStr);
    } catch {
      console.error('Parse error, raw response:', raw);
      return res.status(500).json({ error: 'Could not parse vinyl info from image. Try a clearer photo.' });
    }

    const duplicates = findDuplicates(vinylData);
    res.json({ vinyl: vinylData, duplicates });
  } catch (err) {
    console.error('Analyze error:', err);
    res.status(500).json({ error: err.message || 'Analysis failed' });
  }
});

function findDuplicates(vinylData) {
  const result = { exactMatch: null, partialMatches: [] };
  if (!vinylData.artist) return result;

  const exactMatch = db.prepare(`
    SELECT id, artist, album, year, label
    FROM vinyls
    WHERE LOWER(TRIM(artist)) = LOWER(TRIM(?))
      AND LOWER(TRIM(album)) = LOWER(TRIM(?))
  `).get(vinylData.artist || '', vinylData.album || '');

  if (exactMatch) {
    result.exactMatch = exactMatch;
    return result;
  }

  if (vinylData.tracks && vinylData.tracks.length > 0) {
    const titles = vinylData.tracks.map(t => t.title.toLowerCase().trim()).filter(Boolean);
    if (titles.length > 0) {
      const placeholders = titles.map(() => '?').join(',');
      const rows = db.prepare(`
        SELECT v.id, v.artist, v.album, v.year, t.title AS matching_track, t.side, t.position
        FROM tracks t
        JOIN vinyls v ON t.vinyl_id = v.id
        WHERE LOWER(TRIM(t.title)) IN (${placeholders})
        ORDER BY v.id
      `).all(...titles);

      const byVinyl = {};
      for (const row of rows) {
        if (!byVinyl[row.id]) {
          byVinyl[row.id] = { id: row.id, artist: row.artist, album: row.album, year: row.year, matchingTracks: [] };
        }
        byVinyl[row.id].matchingTracks.push({ title: row.matching_track, side: row.side, position: row.position });
      }
      result.partialMatches = Object.values(byVinyl);
    }
  }

  return result;
}

router.get('/vinyls', (req, res) => {
  try {
    const vinyls = db.prepare('SELECT * FROM vinyls ORDER BY LOWER(artist), LOWER(album)').all();
    const result = vinyls.map(v => ({
      ...v,
      tracks: db.prepare('SELECT * FROM tracks WHERE vinyl_id = ? ORDER BY side, CAST(position AS INTEGER)').all(v.id)
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/vinyls', (req, res) => {
  try {
    const { artist, album, year, label, tracks, frontImage } = req.body;
    if (!artist || !album) return res.status(400).json({ error: 'Artist and album are required' });

    const { lastInsertRowid: vinylId } = db.prepare(`
      INSERT INTO vinyls (artist, album, year, label, front_image)
      VALUES (?, ?, ?, ?, ?)
    `).run(artist, album, year || null, label || null, frontImage || null);

    if (tracks && tracks.length > 0) {
      const insertTrack = db.prepare('INSERT INTO tracks (vinyl_id, side, position, title) VALUES (?, ?, ?, ?)');
      for (const t of tracks) {
        if (t.title) insertTrack.run(vinylId, t.side || null, t.position || null, t.title);
      }
    }

    const vinyl = db.prepare('SELECT * FROM vinyls WHERE id = ?').get(vinylId);
    const vinylTracks = db.prepare('SELECT * FROM tracks WHERE vinyl_id = ?').all(vinylId);
    res.status(201).json({ ...vinyl, tracks: vinylTracks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/vinyls/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM vinyls WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
