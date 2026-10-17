import { useState } from 'react'
import { deleteWishlistItem } from '../api'

export default function Wishlist({ wishlist, onDelete }) {
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
            <div key={w.id} className="tracklist-item">
              <span className="track-pos">{w.year || ''}</span>
              <span className="track-title" style={{ flex: 1 }}>{w.album}</span>
              <button className="delete-btn" onClick={() => handleDelete(w.id)}
                title={confirming === w.id ? 'Tap again to confirm' : 'Remove'}
                style={confirming === w.id ? { color: 'var(--accent)' } : {}}>
                {confirming === w.id ? '✕' : '⋯'}
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
