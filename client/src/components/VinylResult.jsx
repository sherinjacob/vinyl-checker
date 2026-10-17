import { useState } from 'react'
import { findOnWishlist } from '../api'

function groupBySide(tracks) {
  const sides = {}
  for (const t of tracks) {
    const side = t.side || '?'
    if (!sides[side]) sides[side] = []
    sides[side].push(t)
  }
  return sides
}

function TrackList({ tracks, matchingTitles }) {
  const sides = groupBySide(tracks)
  return (
    <div className="tracklist">
      {Object.entries(sides).map(([side, sideTracks]) => (
        <div key={side}>
          <div className="tracklist-side">Side {side}</div>
          {sideTracks.map((t, i) => {
            const isMatch = matchingTitles?.has(t.title?.toLowerCase().trim())
            return (
              <div key={i} className="tracklist-item">
                <span className="track-pos">{t.position || i + 1}</span>
                <span className={`track-title ${isMatch ? 'match' : ''}`}>
                  {t.title}
                  {isMatch && ' ⚠'}
                </span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

export default function VinylResult({ result, wishlist = [], frontImage, onAdd, onScanAgain }) {
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const [showTracks, setShowTracks] = useState(true)

  if (!result) return null

  const { vinyl, duplicates } = result
  const onWishlist = result && findOnWishlist(result.vinyl, wishlist)
  const hasExactMatch = !!duplicates?.exactMatch
  const hasPartialMatches = duplicates?.partialMatches?.length > 0

  // Collect all matching track titles across partial matches
  const allMatchingTitles = new Set()
  if (hasPartialMatches) {
    for (const pm of duplicates.partialMatches) {
      for (const mt of pm.matchingTracks) {
        allMatchingTitles.add(mt.title?.toLowerCase().trim())
      }
    }
  }

  async function handleAdd() {
    setAdding(true)
    try {
      await onAdd(vinyl)
      setAdded(true)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="page">
      {/* Vinyl info */}
      <div className="card">
        <div className="result-header">
          {frontImage
            ? <img className="result-cover" src={frontImage} alt="cover" />
            : <div className="result-cover-placeholder">&#9679;</div>
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="result-artist">{vinyl.artist || 'Unknown Artist'}</div>
            <div className="result-album">{vinyl.album || 'Unknown Album'}</div>
            <div className="result-meta">
              {vinyl.year && <span>{vinyl.year}</span>}
              {vinyl.label && <span>{vinyl.label}</span>}
            </div>
            {vinyl.confidence && (
              <div style={{ marginTop: 8 }}>
                <span className={`confidence-badge ${vinyl.confidence}`}>
                  {vinyl.confidence} confidence
                </span>
              </div>
            )}
          </div>
        </div>

        {vinyl.tracks && vinyl.tracks.length > 0 && (
          <>
            <button className="expand-btn" onClick={() => setShowTracks(v => !v)}>
              {showTracks ? 'Hide' : 'Show'} {vinyl.tracks.length} tracks
            </button>
            {showTracks && (
              <TrackList tracks={vinyl.tracks} matchingTitles={hasPartialMatches ? allMatchingTitles : null} />
            )}
          </>
        )}
      </div>

      {/* Duplicate alerts */}
      {hasExactMatch && (
        <div className="alert alert-danger">
          <div className="alert-title">You already own this album</div>
          {duplicates.exactMatch.artist} — {duplicates.exactMatch.album}
          {duplicates.exactMatch.year && ` (${duplicates.exactMatch.year})`}
        </div>
      )}

      {!hasExactMatch && hasPartialMatches && (
        <div className="alert alert-warning">
          <div className="alert-title">You own {allMatchingTitles.size} of these tracks</div>
          {duplicates.partialMatches.map((pm, i) => (
            <div key={i} style={{ marginTop: 6 }}>
              <strong>{pm.artist} — {pm.album}</strong>
              <div style={{ fontSize: 12, marginTop: 2 }}>
                {pm.matchingTracks.map(t => t.title).join(' · ')}
              </div>
            </div>
          ))}
        </div>
      )}

      {!hasExactMatch && onWishlist && (
        <div className="alert alert-success">
          <div className="alert-title">On your wishlist — buy it!</div>
          {onWishlist.artist} — {onWishlist.album}
        </div>
      )}

      {!hasExactMatch && !hasPartialMatches && (
        <div className="alert alert-success">
          <div className="alert-title">Not in your collection</div>
          No matching albums or songs found. Safe to buy!
        </div>
      )}

      {/* Actions */}
      {!added ? (
        <div className="action-row">
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onScanAgain}>
            Scan Another
          </button>
          {!hasExactMatch && (
            <button
              className="btn btn-success"
              style={{ flex: 2 }}
              onClick={handleAdd}
              disabled={adding}
            >
              {adding ? 'Saving...' : 'Add to Collection'}
            </button>
          )}
        </div>
      ) : (
        <div>
          <div className="alert alert-success" style={{ marginBottom: 12 }}>
            Added to your collection!
          </div>
          <button className="btn btn-primary" onClick={onScanAgain}>
            Scan Another Vinyl
          </button>
        </div>
      )}
    </div>
  )
}
