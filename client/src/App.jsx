import { useState, useEffect } from 'react'
import { listAll, addVinyl, norm, makeThumb, getSecret, setSecret } from './api'
import ScanVinyl from './components/ScanVinyl'
import VinylResult from './components/VinylResult'
import Collection from './components/Collection'
import Wishlist from './components/Wishlist'

export default function App() {
  const [view, setView] = useState('scan')
  const [analysisResult, setAnalysisResult] = useState(null)
  const [capturedImages, setCapturedImages] = useState({ front: null, back: null })
  const [vinyls, setVinyls] = useState(null)
  const [wishlist, setWishlist] = useState([])
  const [loadError, setLoadError] = useState(null)

  const [passphrase, setPassphrase] = useState('')
  const [needLogin, setNeedLogin] = useState(!getSecret())

  function load() {
    setLoadError(null)
    listAll().then(d => { setVinyls(d.vinyls); setWishlist(d.wishlist || []); setNeedLogin(false) }).catch(e => {
      if (e.message === 'Unauthorized') setNeedLogin(true)
      else setLoadError(e.message)
    })
  }

  useEffect(() => { if (!needLogin) load() }, [])

  function handleLogin(e) {
    e.preventDefault()
    setSecret(passphrase.trim())
    load()
  }

  if (needLogin) {
    return (
      <div className="page">
        <p className="page-title">Enter passphrase</p>
        <form onSubmit={handleLogin}>
          <input className="search-input" type="password" autoFocus value={passphrase}
            onChange={e => setPassphrase(e.target.value)} placeholder="Passphrase" />
          <button className="btn btn-primary" type="submit" disabled={!passphrase.trim()}>Unlock</button>
        </form>
      </div>
    )
  }

  function handleAnalysisComplete(result, images) {
    setAnalysisResult(result)
    setCapturedImages(images)
    setView('result')
  }

  async function handleAddToCollection(vinyl) {
    const thumb = capturedImages.front ? await makeThumb(capturedImages.front) : null
    const { id } = await addVinyl({ ...vinyl, thumb })
    setVinyls(vs => [...vs, { ...vinyl, id, thumb }])
    setWishlist(ws => ws.filter(w => norm(w.artist) !== norm(vinyl.artist) || norm(w.album) !== norm(vinyl.album)))
    setView('collection')
  }

  function goToScan() {
    setView('scan')
    setAnalysisResult(null)
    setCapturedImages({ front: null, back: null })
  }

  return (
    <>
      <nav className="nav">
        <div className="nav-logo">&#9679; <span>Vinyl</span>Check</div>
        <div className="nav-tabs">
          <button
            className={`nav-tab ${view === 'scan' || view === 'result' ? 'active' : ''}`}
            onClick={goToScan}
          >
            Scan
          </button>
          <button
            className={`nav-tab ${view === 'collection' ? 'active' : ''}`}
            onClick={() => setView('collection')}
          >
            Collection
          </button>
          <button
            className={`nav-tab ${view === 'wishlist' ? 'active' : ''}`}
            onClick={() => setView('wishlist')}
          >
            Wishlist
          </button>
        </div>
      </nav>

      {loadError && <div className="page"><div className="alert alert-danger"><div className="alert-title">Could not load collection</div>{loadError}</div></div>}
      {!vinyls && !loadError && <div className="page"><div className="loading-wrap"><div className="spinner" /></div></div>}
      {vinyls && view === 'scan' && <ScanVinyl vinyls={vinyls} onAnalysisComplete={handleAnalysisComplete} />}
      {vinyls && view === 'result' && (
        <VinylResult
          result={analysisResult}
          wishlist={wishlist}
          frontImage={capturedImages.front}
          onAdd={handleAddToCollection}
          onScanAgain={goToScan}
        />
      )}
      {vinyls && view === 'collection' && (
        <Collection vinyls={vinyls} onScan={goToScan} onDelete={id => setVinyls(vs => vs.filter(v => v.id !== id))} />
      )}
      {vinyls && view === 'wishlist' && (
        <Wishlist wishlist={wishlist} onDelete={id => setWishlist(ws => ws.filter(w => w.id !== id))} />
      )}
    </>
  )
}
