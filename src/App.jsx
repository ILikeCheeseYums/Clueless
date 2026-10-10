import React, { useState } from 'react';
import StreetViewer from './components/StreetViewer';
import { parseItem } from './utils/graph';
import { Compass, Image as ImageIcon, Map as MapIcon, Layers, Target, UploadCloud } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'red', padding: '20px', background: 'black', height: '100vh' }}>
          <h2>Something went wrong.</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error?.toString()}</pre>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [isViewing, setIsViewing] = useState(false);
  const [images, setImages] = useState([]);

  const onDrop = (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    
    const newImages = acceptedFiles.map(file => {
      const url = URL.createObjectURL(file);
      const parsed = parseItem(file.name);
      parsed.image = url;
      return parsed;
    });
    
    setImages(newImages);
    setIsViewing(true);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] }
  });

  // Render the standalone Viewer Tool
  if (isViewing) {
    return <StreetViewer images={images} onExit={() => setIsViewing(false)} />;
  }

  // Render the Landing / Home Page
  return (
    <div {...getRootProps()} className={`min-h-screen bg-[#0b0c0e] text-white flex flex-col items-center justify-center p-8 relative overflow-hidden transition-colors ${isDragActive ? 'bg-[#1a1d24]' : ''}`}>
      <input {...getInputProps()} />
      
      {/* Decorative background grid */}
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'linear-gradient(#20232a 1px, transparent 1px), linear-gradient(90deg, #20232a 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      {isDragActive && (
        <div className="absolute inset-0 z-50 bg-[#1a73e8]/20 backdrop-blur-sm border-4 border-dashed border-[#1a73e8] flex items-center justify-center">
          <h2 className="text-4xl font-bold text-white drop-shadow-lg">Drop images here to launch!</h2>
        </div>
      )}

      <div className="max-w-4xl text-center space-y-8 z-10 pointer-events-auto">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 shadow-[0_0_30px_-5px_rgba(59,130,246,0.3)]">
            <Compass className="w-16 h-16 text-[#8ab4f8]" />
          </div>
        </div>

        <h1 className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#8ab4f8] to-[#1a73e8]">
          Clueless 3D Engine
        </h1>
        
        <p className="text-gray-400 text-xl leading-relaxed max-w-2xl mx-auto">
          Create, navigate, and embed your own 3D virtual tours. 
          Simply drop your nomenclature-formatted images anywhere on this page and instantly build a walkable spatial graph.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 pb-12 text-left">
          <div className="bg-[#1a1d24] p-6 rounded-xl border border-white/5 hover:border-blue-500/30 transition-colors">
            <ImageIcon className="w-8 h-8 text-blue-400 mb-4" />
            <h3 className="font-semibold text-lg mb-2">1. Drop Images</h3>
            <p className="text-sm text-gray-400">Drag and drop your 360° panoramas or flat images right here. Use `pano` in the name for 360 views.</p>
          </div>
          <div className="bg-[#1a1d24] p-6 rounded-xl border border-white/5 hover:border-green-500/30 transition-colors">
            <MapIcon className="w-8 h-8 text-green-400 mb-4" />
            <h3 className="font-semibold text-lg mb-2">2. Auto-Graph</h3>
            <p className="text-sm text-gray-400">The engine automatically builds a walkable spatial map using `{`Step`}{`Branch`}-{`Turn`}` nomenclature.</p>
          </div>
          <div className="bg-[#1a1d24] p-6 rounded-xl border border-white/5 hover:border-purple-500/30 transition-colors">
            <Layers className="w-8 h-8 text-purple-400 mb-4" />
            <h3 className="font-semibold text-lg mb-2">3. Immediate Play</h3>
            <p className="text-sm text-gray-400">The viewer instantly launches with your files mapped in 3D space, entirely client-side.</p>
          </div>
        </div>

        <div className="flex gap-4 justify-center pointer-events-auto">
          <button 
            type="button"
            className="group relative px-10 py-4 bg-[#1a73e8] hover:bg-[#1557b0] transition-all rounded-full font-bold text-xl shadow-[0_0_40px_-10px_#1a73e8] hover:shadow-[0_0_60px_-15px_#1a73e8]"
          >
            <span className="flex items-center gap-3">
              <UploadCloud className="w-5 h-5 group-hover:-translate-y-1 transition-transform duration-300" />
              Select Images or Drop Here
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
