import { useState } from 'react'
import ScanVinyl from './components/ScanVinyl'
import VinylResult from './components/VinylResult'
import Collection from './components/Collection'

export default function App() {
  const [view, setView] = useState('scan')
  const [analysisResult, setAnalysisResult] = useState(null)
  const [capturedImages, setCapturedImages] = useState({ front: null, back: null })

  function handleAnalysisComplete(result, images) {
    setAnalysisResult(result)
    setCapturedImages(images)
    setView('result')
  }

  async function handleAddToCollection(vinyl) {
    await fetch('/api/vinyls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...vinyl, frontImage: capturedImages.front })
    })
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

      {view === 'scan' && <ScanVinyl onAnalysisComplete={handleAnalysisComplete} />}
      {view === 'result' && (
        <VinylResult
          result={analysisResult}
          frontImage={capturedImages.front}
          onAdd={handleAddToCollection}
          onScanAgain={goToScan}
        />
      )}
      {view === 'collection' && <Collection onScan={goToScan} />}
    </>
  )
}
