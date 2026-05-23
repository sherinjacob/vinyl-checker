import { useState, useRef } from 'react'

function resizeImage(file, maxSize = 1024) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > height && width > maxSize) {
          height = Math.round((height / width) * maxSize)
          width = maxSize
        } else if (height > maxSize) {
          width = Math.round((width / height) * maxSize)
          height = maxSize
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

function CaptureSlot({ label, image, onCapture }) {
  const inputRef = useRef(null)

  async function handleChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const resized = await resizeImage(file)
    onCapture(resized)
    e.target.value = ''
  }

  return (
    <div className="capture-slot" onClick={() => inputRef.current?.click()}>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleChange} />
      {image ? (
        <>
          <img className="slot-preview" src={image} alt={label} />
          <div className="slot-overlay">
            <span className="slot-overlay-text">Retake</span>
          </div>
        </>
      ) : (
        <>
          <span className="slot-icon">📷</span>
          <span className="slot-label">{label}</span>
        </>
      )}
    </div>
  )
}

export default function ScanVinyl({ onAnalysisComplete }) {
  const [front, setFront] = useState(null)
  const [back, setBack] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleAnalyze() {
    if (!front && !back) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frontImage: front, backImage: back })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      onAnalysisComplete(data, { front, back })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="loading-wrap">
          <div className="spinner" />
          <p className="loading-text">Identifying vinyl...<br />Checking your collection</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <p className="page-title">Scan a Vinyl</p>

      <div className="capture-grid">
        <CaptureSlot label="Front Cover" image={front} onCapture={setFront} />
        <CaptureSlot label="Back Cover" image={back} onCapture={setBack} />
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, textAlign: 'center' }}>
        Tip: the back cover tracklist helps identify songs you already own.
      </p>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 16 }}>
          <div className="alert-title">Error</div>
          {error}
        </div>
      )}

      <button
        className="btn btn-primary"
        disabled={!front && !back}
        onClick={handleAnalyze}
      >
        Analyze Vinyl
      </button>
    </div>
  )
}
