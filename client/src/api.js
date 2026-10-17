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
export const setThumb = (id, thumb) => call('setThumb', { id, thumb })
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

// ~160px JPEG (a few KB) so it fits in a Sheet cell
export function makeThumb(dataUrl, size = 160) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = size / Math.max(img.width, img.height)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.6))
    }
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}
