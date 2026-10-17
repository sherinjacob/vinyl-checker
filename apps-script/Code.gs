// Container-bound Apps Script: open your Google Sheet -> Extensions -> Apps Script, paste this file.
// Script Properties required: SECRET (shared token), ANTHROPIC_API_KEY.
// Deploy -> Web app -> Execute as: Me, Who has access: Anyone.

const MODEL = 'claude-sonnet-4-6';
const VINYL_COLS = ['id', 'artist', 'album', 'year', 'label', 'created_at'];
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
    if (req.action === 'list') out = { vinyls: listVinyls() };
    else if (req.action === 'add') out = withLock(() => addVinyl(req.vinyl));
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
    tracks: tracks.filter(t => t.vinyl_id === v.id).map(t => ({ side: t.side, position: String(t.position), title: t.title })),
  }));
}

function addVinyl(v) {
  if (!v || !v.artist || !v.album) throw new Error('Artist and album are required');
  const id = Utilities.getUuid();
  sheet('vinyls', VINYL_COLS).appendRow([id, v.artist, v.album, v.year || '', v.label || '', new Date().toISOString()]);
  const ts = (v.tracks || []).filter(t => t.title).map(t => [id, t.side || '', t.position || '', t.title]);
  if (ts.length) {
    const s = sheet('tracks', TRACK_COLS);
    s.getRange(s.getLastRow() + 1, 1, ts.length, TRACK_COLS.length).setNumberFormat('@').setValues(ts);
  }
  return { id };
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
