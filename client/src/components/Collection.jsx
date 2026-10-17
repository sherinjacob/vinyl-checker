import { useState } from 'react'
import { deleteVinyl } from '../api'

function groupBySide(tracks) {
  const sides = {}
  for (const t of tracks) {
    const side = t.side || '?'
    if (!sides[side]) sides[side] = []
    sides[side].push(t)
  }
  return sides
}

function VinylCard({ vinyl, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const [confirming, setConfirming] = useState(false)

  async function handleDelete() {
    if (!confirming) { setConfirming(true); return }
    await deleteVinyl(vinyl.id)
    onDelete(vinyl.id)
  }

  const sides = groupBySide(vinyl.tracks || [])

  return (
    <div className="card">
      <div className="card-header">
        {vinyl.front_image
          ? <img className="card-thumb" src={vinyl.front_image} alt="cover" />
          : <div className="card-thumb-placeholder">&#9679;</div>
        }
        <div className="card-info">
          <div className="card-artist">{vinyl.artist}</div>
          <div className="card-album">{vinyl.album}</div>
          <div className="card-meta">
            {[vinyl.year, vinyl.label].filter(Boolean).join(' · ')}
            {vinyl.tracks?.length > 0 && ` · ${vinyl.tracks.length} tracks`}
          </div>
        </div>
        <button
          className="delete-btn"
          onClick={handleDelete}
          title={confirming ? 'Tap again to confirm' : 'Remove'}
          style={confirming ? { color: 'var(--accent)' } : {}}
        >
          {confirming ? '✕' : '⋯'}
        </button>
      </div>

      {vinyl.tracks?.length > 0 && (
        <>
          <button className="expand-btn" onClick={() => setExpanded(v => !v)}>
            {expanded ? 'Hide' : 'Show'} tracklist
          </button>
          {expanded && (
            <div className="tracklist">
              {Object.entries(sides).map(([side, tracks]) => (
                <div key={side}>
                  <div className="tracklist-side">Side {side}</div>
                  {tracks.map((t, i) => (
                    <div key={i} className="tracklist-item">
                      <span className="track-pos">{t.position || i + 1}</span>
                      <span className="track-title">{t.title}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function Collection({ vinyls, onScan, onDelete }) {
  const [search, setSearch] = useState('')

  const filtered = search
    ? vinyls.filter(v =>
        v.artist.toLowerCase().includes(search.toLowerCase()) ||
        v.album.toLowerCase().includes(search.toLowerCase()) ||
        v.tracks?.some(t => t.title.toLowerCase().includes(search.toLowerCase()))
      )
    : vinyls

  if (vinyls.length === 0) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-icon">&#9679;</div>
          <div className="empty-title">No vinyls yet</div>
          <div className="empty-subtitle">Scan a record to add it to your collection</div>
          <button className="btn btn-primary" style={{ marginTop: 8, width: 'auto', padding: '12px 28px' }} onClick={onScan}>
            Scan a Vinyl
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="collection-count">
        {vinyls.length} {vinyls.length === 1 ? 'record' : 'records'} in your collection
      </div>

      <input
        className="search-input"
        type="search"
        placeholder="Search artist, album or track..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {filtered.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>
          No results for "{search}"
        </p>
      )}

      {filtered.map(vinyl => (
        <VinylCard key={vinyl.id} vinyl={vinyl} onDelete={onDelete} />
      ))}
    </div>
  )
}
