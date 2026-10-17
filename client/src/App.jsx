import { useState, useEffect } from 'react'
import { listVinyls, addVinyl } from './api'
import ScanVinyl from './components/ScanVinyl'
import VinylResult from './components/VinylResult'
import Collection from './components/Collection'

export default function App() {
  const [view, setView] = useState('scan')
  const [analysisResult, setAnalysisResult] = useState(null)
  const [capturedImages, setCapturedImages] = useState({ front: null, back: null })
  const [vinyls, setVinyls] = useState(null)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    listVinyls().then(setVinyls).catch(e => setLoadError(e.message))
  }, [])

  function handleAnalysisComplete(result, images) {
    setAnalysisResult(result)
    setCapturedImages(images)
    setView('result')
  }

  async function handleAddToCollection(vinyl) {
    const { id } = await addVinyl(vinyl)
    setVinyls(vs => [...vs, { ...vinyl, id }])
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
        </div>
      </nav>

      {loadError && <div className="page"><div className="alert alert-danger"><div className="alert-title">Could not load collection</div>{loadError}</div></div>}
      {!vinyls && !loadError && <div className="page"><div className="loading-wrap"><div className="spinner" /></div></div>}
      {vinyls && view === 'scan' && <ScanVinyl vinyls={vinyls} onAnalysisComplete={handleAnalysisComplete} />}
      {vinyls && view === 'result' && (
        <VinylResult
          result={analysisResult}
          frontImage={capturedImages.front}
          onAdd={handleAddToCollection}
          onScanAgain={goToScan}
        />
      )}
      {vinyls && view === 'collection' && (
        <Collection vinyls={vinyls} onScan={goToScan} onDelete={id => setVinyls(vs => vs.filter(v => v.id !== id))} />
      )}
    </>
  )
}
