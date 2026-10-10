import React, { useState, useEffect, useRef } from 'react';
import { useFullscreen, useToggle } from 'react-use';
import { Maximize, Minimize, Expand, Shrink, ZoomIn, ZoomOut, Target } from 'lucide-react';

import { buildGraphFromNomenclature, parseItem } from './utils/graph';
import { playAudio } from './utils/audio';

/**
 * Initializes the default image store by dynamically scanning the public directory.
 * @returns {Map} A map linking node IDs to their parsed data.
 */
function initDefaultImages() {
  const map = new Map();
  // Dynamically discover all images in the public/Dummy_imgs folder at build/dev time
  const files = import.meta.glob('/public/Dummy_imgs/*.{jpeg,jpg,png,webp}', { eager: true });
  
  Object.keys(files).forEach(key => {
    // Vite serves the /public folder at the root level, so we strip '/public' for the actual URL
    const publicUrl = key.replace(/^\/public/, '');
    const parsed = parseItem(publicUrl);
    map.set(parsed.id, parsed);
  });
  
  return map;
}

export default function App() {
  // Global Image Data & Graph States
  const [imageStore, setImageStore] = useState(initDefaultImages());
  const [graph, setGraph] = useState(() => buildGraphFromNomenclature(Array.from(initDefaultImages().values())));
  
  // Current active viewport node identifier
  const [currId, setCurrId] = useState(graph.nodes[0]?.id || "1A-F");
  
  // Camera Transform States (X/Y Panning and Zoom)
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panoX, setPanoX] = useState(0); // Specialized X offset for 360 panoramas
  const [zoom, setZoom] = useState(1);
  
  // Mouse/Touch Dragging References (stored in refs to avoid constant React re-renders)
  const isDragRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });
  
  // UI Display Toggles
  const [isFillMode, toggleFillMode] = useToggle(false); // Fits image vs Fills screen entirely
  
  // Fullscreen Management via react-use hook
  const appRef = useRef(null);
  const isFullscreen = useFullscreen(appRef, false, { video: false });
  
  // DOM References for the two panorama layers used to execute smooth opacity crossfades
  const layerARef = useRef(null);
  const layerBRef = useRef(null);
  const curLayerRef = useRef(0); // 0 corresponds to layerA, 1 corresponds to layerB
  
  // Computed values derived from current state
  const currentNode = graph.nodes.find(n => n.id === currId);
  const isPano = currentNode && currentNode.isPanorama;

  /**
   * Mount Effect:
   * Safely mounts the initial background image onto the primary DOM layer.
   * This bridges React with the manual DOM node manipulation used for crossfades.
   */
  useEffect(() => {
    if (layerARef.current && !layerARef.current.style.backgroundImage && currentNode) {
      layerARef.current.style.backgroundImage = `url("${currentNode.image}")`;
      if (currentNode.isPanorama) layerARef.current.classList.add("is-panorama");
    }
  }, []);

  /**
   * Core Navigation Engine:
   * Transitions the viewport from the current node to a target node.
   * Leverages manual DOM manipulation (opacity and classes) to achieve a
   * perfectly smooth crossfade that skips React's render cycle limitations.
   * 
   * @param {string} id - Target node ID (e.g. "2A-R")
   * @param {string} dir - The direction traveled to hit this node (for audio panning)
   * @param {boolean} force - Bypasses safety checks to force a reload
   */
  const goTo = (id, dir = "forward", force = false) => {
    const node = graph.nodes.find(n => n.id === id);
    if (!node) return;
    
    // Prevent double-clicking the current active node
    const currentLayerEl = curLayerRef.current === 0 ? layerARef.current : layerBRef.current;
    if (!force && id === currId && currentLayerEl?.style.backgroundImage) return;

    // Trigger directional audio footstep
    playAudio(dir);
    
    // Reset view orientation & update React active state
    setPanoX(0);
    setCurrId(id);

    // Identify which DOM layer is currently visible, and which is hidden (the staging layer)
    const curr = curLayerRef.current === 0 ? layerARef.current : layerBRef.current;
    const next = curLayerRef.current === 0 ? layerBRef.current : layerARef.current;

    // Load the next image into the staging layer and attach panorama tiling classes if necessary
    next.style.backgroundImage = `url("${node.image}")`;
    next.className = "panorama-layer layer-next" + (node.isPanorama ? " is-panorama" : "");
    
    // Execute CSS crossfade
    next.style.opacity = "1";
    curr.style.opacity = "0";

    // Wait for the 200ms CSS transition to complete before swapping logical roles
    setTimeout(() => {
      curLayerRef.current = 1 - curLayerRef.current; // Swap 0 and 1
      curr.className = "panorama-layer layer-next";
      next.className = "panorama-layer layer-current" + (node.isPanorama ? " is-panorama" : "");
    }, 200);
  };

  /**
   * Camera Update Function:
   * Commits the React pan/zoom state to native CSS variables on the document root.
   * This uses the GPU for buttery-smooth 3D transforms.
   */
  const updateCam = () => {
    const isP = isPano;
    document.documentElement.style.setProperty("--pan-x", `${isP ? 0 : pan.x}px`);
    document.documentElement.style.setProperty("--pan-y", `${pan.y}px`);
    document.documentElement.style.setProperty("--pano-x", `${panoX}px`); // Panorama tiling offset
    
    // Apply slight 3D perspective tilts based on mouse position
    document.documentElement.style.setProperty("--tilt-y", `${(isP ? 0 : pan.x / 280) * 8}deg`);
    document.documentElement.style.setProperty("--tilt-x", `${-(pan.y / 180) * 6}deg`);
    document.documentElement.style.setProperty("--zoom", zoom);
  };

  // Sync camera transform CSS variables whenever pan, zoom, or pano state changes
  useEffect(() => updateCam(), [pan, panoX, zoom, isPano]);
  
  // Sync the CSS fill-mode class onto the body
  useEffect(() => { document.body.classList.toggle("fill-mode", isFillMode); }, [isFillMode]);

  /* =========================================================================
     Mouse & Touch Drag Interaction Logic
     ========================================================================= */
  const handleDragStart = (x, y) => { isDragRef.current = true; startRef.current = { x, y }; };
  
  const handleDragMove = (x, y) => {
    if (!isDragRef.current) return;
    const deltaX = x - startRef.current.x, deltaY = y - startRef.current.y;
    startRef.current = { x, y };

    // Panoramas scroll horizontally via background-position (panoX), but tilt vertically.
    // Flat images pan linearly in X and Y bounds.
    if (isPano) {
      setPanoX(p => p + deltaX * 1.3);
      setPan(p => ({ ...p, y: Math.max(-80, Math.min(80, p.y + deltaY * 0.4)) }));
    } else {
      setPan(p => ({ x: Math.max(-240, Math.min(240, p.x + deltaX)), y: Math.max(-120, Math.min(120, p.y + deltaY)) }));
    }
  };
  
  const handleDragEnd = () => isDragRef.current = false;

  // Bind global window drag listeners
  useEffect(() => {
    const onMouseMove = e => handleDragMove(e.clientX, e.clientY);
    const onTouchMove = e => { if (e.touches.length === 1) handleDragMove(e.touches[0].clientX, e.touches[0].clientY); };
    
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchend', handleDragEnd);
    
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isPano]);

  // Compute available edges leading out of the active node for Chevron rendering
  const out = graph.edges.filter(e => e.from === currId);
  const H = window.innerHeight || 800;
  const AR = 2.0; // Assume standard equirectangular aspect ratio for 360 since we don't asynchronously load to check anymore
  const W_rev = H * AR; // Reversible panorama width baseline

  return (
    <div ref={appRef} id="app-container" className="relative w-screen h-screen overflow-hidden flex flex-col">
      {/* 
        Main Viewport 
        Catches drag interactions and mouse wheel scrolling for zoom
      */}
      <main 
        className="viewport absolute inset-0 overflow-hidden cursor-grab active:cursor-grabbing bg-[#0b0c0e] [perspective:1000px]" 
        id="viewport"
        onMouseDown={e => { if (!e.target.closest(".streetview-arrow")) handleDragStart(e.clientX, e.clientY); }}
        onTouchStart={e => { if (e.touches.length === 1 && !e.target.closest(".streetview-arrow")) handleDragStart(e.touches[0].clientX, e.touches[0].clientY); }}
        onWheel={e => { e.preventDefault(); setZoom(z => Math.max(0.95, Math.min(2.4, z - e.deltaY * 0.0015))); }}
      >
        {/* Dual CSS Layers used for rapid transition opacity crossfades */}
        <div className="scene-wrapper absolute inset-0 w-full h-full [transform-style:preserve-3d] will-change-transform">
          <div ref={layerARef} className="panorama-layer layer-current absolute inset-0 w-full h-full bg-center bg-no-repeat z-[1] will-change-transform"></div>
          <div ref={layerBRef} className="panorama-layer layer-next absolute inset-0 w-full h-full bg-center bg-no-repeat z-[2] opacity-0 pointer-events-none will-change-transform"></div>
        </div>
        
        {/* Soft edge-darkening overlay to improve 3D depth perception */}
        <div className="vignette-overlay absolute inset-0 pointer-events-none z-[3]"></div>

        {/* 3D Navigation Chevrons Layer */}
        <div className="nav-arrows-container absolute inset-0 pointer-events-none z-10 [perspective:600px]">
          {/* Target Ring (Only visible on flat images moving forward) */}
          {(!isPano && out.some(e => e.direction === "forward")) && <div className="floor-target-ring" style={{ display: 'block' }}></div>}
          
          <div id="nav-arrows">
            {out.map(e => {
              let screenLeftPercent = null, inView = true;
              
              /* Panorama math computes the exact pixel offset of an arrow mapped to 360 degrees 
                 to ensure it properly stays fixed relative to the panning view */
              if (isPano) {
                const baseAngle = e.direction === "forward" ? 0 : e.direction === "right" ? 90 : e.direction === "left" ? -90 : 180;
                const viewAngle = (panoX / W_rev) * 360;
                let relAngle = (baseAngle + viewAngle) % 360;
                
                // Normalize angle
                if (relAngle > 180) relAngle -= 360;
                if (relAngle < -180) relAngle += 360;
                
                inView = Math.abs(relAngle) <= 85;
                screenLeftPercent = 50 + (relAngle / 85) * 38;
                
                // Override fallback: always show the exit if it's the only one available
                if (out.length === 1 && !inView) { inView = true; screenLeftPercent = 50; }
              }
              if (!inView) return null;

              // Apply calculated position
              const style = isPano && screenLeftPercent !== null ? {
                left: `${screenLeftPercent.toFixed(1)}%`,
                transform: `translateX(-50%) perspective(400px) rotateX(${e.direction === "backward" ? "-45deg" : "50deg"})`
              } : {};
              
              // SVG coordinate paths for arrow heads
              const pts = e.direction === "backward" ? "6 9 12 15 18 9" : e.direction === "right" ? "9 18 15 12 9 6" : e.direction === "left" ? "15 18 9 12 15 6" : "18 15 12 9 6 15";

              return (
                <div key={e.to} className={`streetview-arrow arrow-${e.direction || "forward"}`} style={style} onClick={ev => { ev.stopPropagation(); goTo(e.to, e.direction); }}>
                  <div className="arrow-disc">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points={pts}></polyline></svg>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Floating Indicator identifying the current node as a 360 panorama */}
        {isPano && (
          <div id="pano-badge" className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-[#20232a]/90 backdrop-blur-md text-[11px] text-[#8ab4f8] font-medium pointer-events-none flex items-center gap-1.5 transition-opacity">
            <Target className="w-3.5 h-3.5" />
            <span>360° Panorama</span>
          </div>
        )}
      </main>

       {/* Top-Right: Fullscreen toggler */}
      <div className="absolute top-4 right-4 z-20 pointer-events-auto">
        <button onClick={() => !document.fullscreenElement ? document.documentElement.requestFullscreen().catch(()=>{}) : document.exitFullscreen().catch(()=>{})} className="p-2.5 rounded-full bg-[#20232a]/90 backdrop-blur-md text-[#f1f3f4] cursor-pointer transition-colors hover:bg-[#2d323c] " title="Toggle Fullscreen">
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>
      </div>

      {/* Bottom-Right: Floating Zoom & View Controls Toolbar */}
      <div className="view-controls absolute bottom-6 right-4 flex flex-col gap-2 z-20 pointer-events-auto">
        <div className="view-btn-group bg-[#20232a]/90 backdrop-blur-md rounded-lg flex flex-col overflow-hidden divide-y divide-white/10">
          <button onClick={toggleFillMode} className={`w-10 h-10 flex items-center justify-center transition-colors hover:bg-white/15 hover:text-white active:bg-[#1a73e8] ${isFillMode ? 'text-[#8ab4f8]' : 'text-[#f1f3f4]'}`} title="Toggle Fit (No Crop) / Fill Screen">
            {isFillMode ? <Shrink className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
          </button>
          <button onClick={() => setZoom(z => Math.min(2.4, z + 0.2))} className="w-10 h-10 flex items-center justify-center text-[#f1f3f4] transition-colors hover:bg-white/15 hover:text-white active:bg-[#1a73e8]" title="Zoom In (+)">
            <ZoomIn className="w-5 h-5" />
          </button>
          <button onClick={() => setZoom(z => Math.max(0.95, z - 0.2))} className="w-10 h-10 flex items-center justify-center text-[#f1f3f4] transition-colors hover:bg-white/15 hover:text-white active:bg-[#1a73e8]" title="Zoom Out (-)">
            <ZoomOut className="w-5 h-5" />
          </button>
          <button onClick={() => { setPan({x:0, y:0}); setPanoX(0); setZoom(1); }} className="w-10 h-10 flex items-center justify-center text-[#f1f3f4] transition-colors hover:bg-white/15 hover:text-white active:bg-[#1a73e8]" title="Reset View (0 or Esc)">
            <Target className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
