// Container-bound Apps Script: open your Google Sheet -> Extensions -> Apps Script, paste this file.
// Script Properties required: SECRET (shared token), ANTHROPIC_API_KEY.
// Deploy -> Web app -> Execute as: Me, Who has access: Anyone.

const MODEL = 'claude-sonnet-4-6';
const VINYL_COLS = ['id', 'artist', 'album', 'year', 'label', 'created_at', 'thumb'];
const WISH_COLS = ['id', 'artist', 'album', 'year', 'added_at', 'tracks'];
const TRACK_COLS = ['vinyl_id', 'side', 'position', 'title'];

const ANALYZE_PROMPT = `Analyze these vinyl record photos and extract information. Return ONLY a valid JSON object with no markdown, no explanation, no code blocks — just raw JSON:

{
  "artist": "Artist or Band Name",
  "album": "Album Title",
  "year": "Release Year or null if not visible",
  "label": "Record Label or null if not visible",
  "tracks": [
    {"side": "A", "position": "1", "title": "Track Title"},
    {"side": "B", "position": "1", "title": "Track Title"}
  ],
  "confidence": "high or medium or low"
}

Rules:
- Extract ALL visible tracks from the tracklist
- Side is typically "A" or "B"; position is the track number on that side
- If a photo is not a vinyl record, still try your best
- Return ONLY the JSON object`;

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    const props = PropertiesService.getScriptProperties();
    if (!req.secret || req.secret !== props.getProperty('SECRET')) throw new Error('Unauthorized');

    let out;
    if (req.action === 'list') out = { vinyls: listVinyls(), wishlist: listWishlist() };
    else if (req.action === 'wishlistAdd') out = withLock(() => wishlistAdd(req.items));
    else if (req.action === 'wishlistSetTracks') out = withLock(() => wishlistSetTracks(req.items));
    else if (req.action === 'wishlistDelete') out = withLock(() => deleteRow('wishlist', WISH_COLS, req.id));
    else if (req.action === 'add') out = withLock(() => addVinyl(req.vinyl));
    else if (req.action === 'setThumb') out = withLock(() => setThumb(req.id, req.thumb));
    else if (req.action === 'delete') out = withLock(() => deleteVinyl(req.id));
    else if (req.action === 'analyze') out = { vinyl: analyze(req.frontImage, req.backImage) };
    else throw new Error('Unknown action');
    return json(out);
  } catch (err) {
    return json({ error: err.message });
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function withLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function sheet(name, cols) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    s.appendRow(cols);
    s.setFrozenRows(1);
  } else if (s.getLastColumn() < cols.length) {
    s.getRange(1, 1, 1, cols.length).setValues([cols]);
  }
  return s;
}

function rows(s) {
  const [head, ...data] = s.getDataRange().getValues();
  return data.map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

function listVinyls() {
  const tracks = rows(sheet('tracks', TRACK_COLS));
  return rows(sheet('vinyls', VINYL_COLS)).map(v => ({
    ...v,
    year: v.year === '' ? null : String(v.year),
    thumb: v.thumb || null,
    tracks: tracks.filter(t => t.vinyl_id === v.id).map(t => ({ side: t.side, position: String(t.position), title: t.title })),
  }));
}

// Loose key so reissues/punctuation don't create duplicates: "The Beatles"/"Beatles", "Abbey Road (Remastered)"/"Abbey Road"
function norm(s) {
  return String(s || '').toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/\b(remaster(ed)?|deluxe|edition|expanded|anniversary|the)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}
const key = (artist, album) => norm(artist) + '|' + norm(album);

function listWishlist() {
  return rows(sheet('wishlist', WISH_COLS)).map(w => ({
    ...w,
    year: w.year === '' ? null : String(w.year),
    tracks: w.tracks ? JSON.parse(w.tracks) : [],
  }));
}

function wishlistAdd(items) {
  const seen = new Set(rows(sheet('vinyls', VINYL_COLS)).map(v => key(v.artist, v.album)));
  const wl = rows(sheet('wishlist', WISH_COLS));
  const inWish = new Set(wl.map(w => key(w.artist, w.album)));
  const added = [], skipped = [], out = [];
  for (const it of items || []) {
    if (!it.artist || !it.album) { skipped.push({ ...it, reason: 'missing fields' }); continue; }
    const k = key(it.artist, it.album);
    if (seen.has(k)) { skipped.push({ ...it, reason: 'already own' }); continue; }
    if (inWish.has(k)) { skipped.push({ ...it, reason: 'already on wishlist' }); continue; }
    inWish.add(k);
    added.push(it);
    out.push([Utilities.getUuid(), it.artist, it.album, it.year || '', new Date().toISOString(), it.tracks ? JSON.stringify(it.tracks) : '']);
  }
  if (out.length) {
    const s = sheet('wishlist', WISH_COLS);
    s.getRange(s.getLastRow() + 1, 1, out.length, WISH_COLS.length).setNumberFormat('@').setValues(out);
  }
  return { added, skipped };
}

// items: [{id, tracks: [{side, position, title}]}]; one cell per album holds the tracks as JSON
function wishlistSetTracks(items) {
  const s = sheet('wishlist', WISH_COLS);
  const col = WISH_COLS.indexOf('tracks') + 1;
  const n = s.getLastRow() - 1;
  if (n < 1) return { updated: 0 };
  const ids = s.getRange(2, 1, n, 1).getValues().flat();
  const vals = s.getRange(2, col, n, 1).getValues();
  let updated = 0;
  for (const it of items || []) {
    const i = ids.indexOf(it.id);
    if (i >= 0) { vals[i][0] = JSON.stringify(it.tracks || []); updated++; }
  }
  s.getRange(2, col, n, 1).setNumberFormat('@').setValues(vals);
  return { updated };
}

function deleteRow(name, cols, id) {
  const s = sheet(name, cols);
  const i = s.getRange(1, 1, s.getLastRow(), 1).getValues().flat().indexOf(id);
  if (i > 0) s.deleteRow(i + 1);
  return { success: true };
}

function addVinyl(v) {
  if (!v || !v.artist || !v.album) throw new Error('Artist and album are required');
  const id = Utilities.getUuid();
  sheet('vinyls', VINYL_COLS).appendRow([id, v.artist, v.album, v.year || '', v.label || '', new Date().toISOString(), v.thumb || '']);
  const ts = (v.tracks || []).filter(t => t.title).map(t => [id, t.side || '', t.position || '', t.title]);
  if (ts.length) {
    const s = sheet('tracks', TRACK_COLS);
    s.getRange(s.getLastRow() + 1, 1, ts.length, TRACK_COLS.length).setNumberFormat('@').setValues(ts);
  }
  const ws = sheet('wishlist', WISH_COLS), k = key(v.artist, v.album);
  rows(ws).map((w, i) => ({ w, row: i + 2 })).reverse().forEach(({ w, row }) => { if (key(w.artist, w.album) === k) ws.deleteRow(row); });
  return { id };
}

function setThumb(id, thumb) {
  const s = sheet('vinyls', VINYL_COLS);
  const ids = s.getRange(1, 1, s.getLastRow(), 1).getValues().flat();
  const i = ids.indexOf(id);
  if (i < 1) throw new Error('Not found');
  s.getRange(i + 1, VINYL_COLS.indexOf('thumb') + 1).setValue(thumb);
  return { success: true };
}

function deleteVinyl(id) {
  const vs = sheet('vinyls', VINYL_COLS);
  const vIds = vs.getRange(1, 1, vs.getLastRow(), 1).getValues().flat();
  const vi = vIds.indexOf(id);
  if (vi > 0) vs.deleteRow(vi + 1);
  const ts = sheet('tracks', TRACK_COLS);
  const tIds = ts.getRange(1, 1, ts.getLastRow(), 1).getValues().flat();
  for (let i = tIds.length - 1; i > 0; i--) if (tIds[i] === id) ts.deleteRow(i + 1);
  return { success: true };
}

function imageBlock(dataUrl) {
  const m = dataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
  if (!m) throw new Error('Bad image');
  return { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } };
}

function analyze(front, back) {
  if (!front && !back) throw new Error('At least one image is required');
  const content = [];
  if (front) content.push(imageBlock(front), { type: 'text', text: 'Front cover of the vinyl record.' });
  if (back) content.push(imageBlock(back), { type: 'text', text: 'Back cover of the vinyl record (usually has the tracklist).' });
  content.push({ type: 'text', text: ANALYZE_PROMPT });

  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY'),
      'anthropic-version': '2023-06-01',
    },
    payload: JSON.stringify({ model: MODEL, max_tokens: 1024, messages: [{ role: 'user', content }] }),
    muteHttpExceptions: true,
  });
  const body = JSON.parse(res.getContentText());
  if (res.getResponseCode() !== 200) throw new Error((body.error && body.error.message) || 'Analysis failed');
  const raw = body.content[0].text.trim().replace(/^```json\s*|\s*```$/g, '').trim();
  try { return JSON.parse(raw); } catch (e) { throw new Error('Could not parse vinyl info from image. Try a clearer photo.'); }
}
