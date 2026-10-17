import { useState } from 'react'
import { deleteWishlistItem, norm } from '../api'

function TrackList({ tracks, owned }) {
  const sides = {}
  for (const t of tracks) (sides[t.side || ''] ||= []).push(t)
  return (
    <div className="tracklist">
      {Object.entries(sides).map(([side, ts]) => (
        <div key={side}>
          {side && <div className="tracklist-side">Side {side}</div>}
          {ts.map((t, i) => {
            const dup = owned.get(norm(t.title))
            return (
              <div key={i} className="tracklist-item">
                <span className="track-pos">{t.position || i + 1}</span>
                <span className={`track-title ${dup ? 'match' : ''}`}>
                  {t.title}{dup && ` ⚠ you own this on ${dup}`}
                </span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

export default function Wishlist({ wishlist, vinyls, onDelete }) {
  const [open, setOpen] = useState(null)
  // song title -> an album you already own it on
  const owned = new Map()
  for (const v of vinyls) for (const t of v.tracks || []) owned.set(norm(t.title), v.album)

  const [search, setSearch] = useState('')
  const [confirming, setConfirming] = useState(null)

  async function handleDelete(id) {
    if (confirming !== id) { setConfirming(id); return }
    await deleteWishlistItem(id)
    onDelete(id)
  }

  const q = search.toLowerCase()
  const byArtist = {}
  for (const w of wishlist) {
    if (q && !w.artist.toLowerCase().includes(q) && !w.album.toLowerCase().includes(q)) continue
    ;(byArtist[w.artist] ||= []).push(w)
  }
  const artists = Object.keys(byArtist).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))

  if (wishlist.length === 0) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-icon">&#9679;</div>
          <div className="empty-title">Wishlist is empty</div>
          <div className="empty-subtitle">Records you want to buy will show up here</div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="collection-count">{wishlist.length} on your wishlist</div>
      <input className="search-input" type="search" placeholder="Search artist or album..."
        value={search} onChange={e => setSearch(e.target.value)} />
      {artists.map(artist => (
        <div className="card" key={artist}>
          <div className="card-artist" style={{ marginBottom: 8 }}>{artist}</div>
          {byArtist[artist].sort((a, b) => (a.year || '9999').localeCompare(b.year || '9999')).map(w => (
            <div key={w.id}>
            <div className="tracklist-item">
              <span className="track-pos">{w.year || ''}</span>
              <span className="track-title" style={{ flex: 1, cursor: w.tracks?.length ? 'pointer' : 'default' }}
                onClick={() => w.tracks?.length && setOpen(open === w.id ? null : w.id)}>
                {w.album}{w.tracks?.length ? ` · ${w.tracks.length} tracks ${open === w.id ? '▾' : '▸'}` : ''}
              </span>
              <button className="delete-btn" onClick={() => handleDelete(w.id)}
                title={confirming === w.id ? 'Tap again to confirm' : 'Remove'}
                style={confirming === w.id ? { color: 'var(--accent)' } : {}}>
                {confirming === w.id ? '✕' : '⋯'}
              </button>
            </div>
            {open === w.id && <TrackList tracks={w.tracks} owned={owned} />}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
