const URL = import.meta.env.VITE_API_URL

export const getSecret = () => { try { return localStorage.getItem('vc_secret') } catch { return null } }
export const setSecret = (v) => { try { localStorage.setItem('vc_secret', v) } catch {} }

// text/plain avoids a CORS preflight, which Apps Script web apps can't answer
async function call(action, payload = {}) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action, secret: getSecret(), ...payload })
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data
}

export const listVinyls = () => call('list').then(d => d.vinyls)
export const addVinyl = (vinyl) => call('add', { vinyl })
export const deleteVinyl = (id) => call('delete', { id })
export const analyze = (frontImage, backImage) => call('analyze', { frontImage, backImage }).then(d => d.vinyl)

const norm = (s) => (s || '').toLowerCase().trim()

// Same rules as the old server-side check: exact artist+album, else shared track titles
export function findDuplicates(vinyl, collection) {
  const exactMatch = collection.find(v => norm(v.artist) === norm(vinyl.artist) && norm(v.album) === norm(vinyl.album))
  if (exactMatch) return { exactMatch, partialMatches: [] }

  const titles = new Set((vinyl.tracks || []).map(t => norm(t.title)).filter(Boolean))
  const partialMatches = collection
    .map(v => ({ ...v, matchingTracks: (v.tracks || []).filter(t => titles.has(norm(t.title))) }))
    .filter(v => v.matchingTracks.length > 0)
  return { exactMatch: null, partialMatches }
}
