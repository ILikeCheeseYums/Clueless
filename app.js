// =============================================================================
// Corridor Street View Engine (~100 lines)
// Clean Google Street View navigator with built-in Web Audio & minimap
// =============================================================================

const DEFAULT_GRAPH = {
  id: "corridor-route",
  name: "Academic Wing - Main Corridor",
  nodes: [
    { id: "node-1", number: 1, name: "Corridor Entrance (South)", image: "Dummy_imgs/img-2.jpeg", mapX: 50, mapY: 82 },
    { id: "node-2", number: 2, name: "Mid Corridor (South Section)", image: "Dummy_imgs/img-1.jpeg", mapX: 50, mapY: 60 },
    { id: "node-3", number: 3, name: "Mid Corridor (North Section)", image: "Dummy_imgs/img-3.jpeg", mapX: 50, mapY: 38 },
    { id: "node-4", number: 4, name: "Corridor Alcove / End Wall", image: "Dummy_imgs/img-4.jpeg", mapX: 50, mapY: 16 }
  ],
  edges: [
    { from: "node-1", to: "node-2", direction: "forward", label: "Walk Forward" },
    { from: "node-2", to: "node-3", direction: "forward", label: "Walk Forward" },
    { from: "node-3", to: "node-4", direction: "forward", label: "Walk Forward" },
    { from: "node-4", to: "node-1", direction: "forward", label: "Wrap to Entrance" },
    { from: "node-2", to: "node-1", direction: "backward", label: "Step Back" },
    { from: "node-3", to: "node-2", direction: "backward", label: "Step Back" },
    { from: "node-4", to: "node-3", direction: "backward", label: "Step Back" },
    { from: "node-1", to: "node-4", direction: "backward", label: "Wrap to Alcove" }
  ]
};

let graph = JSON.parse(localStorage.getItem("streetview_graph")) || DEFAULT_GRAPH;
let currId = graph.nodes[0]?.id || "node-1", curLayer = 0, pan = { x: 0, y: 0 }, zoom = 1, isDrag = false, start = {}, audioCtx = null;
const $ = id => document.getElementById(id);
const layerA = $("layer-a"), layerB = $("layer-b"), arrows = $("nav-arrows"), svg = $("minimap-svg");

// Default Spatial Audio Synthesizer (Active by Default)
function playAudio(dir = "forward") {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const now = audioCtx.currentTime, osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    const isFwd = dir === "forward";
    osc.type = "sine";
    osc.frequency.setValueAtTime(isFwd ? 250 : 150, now);
    osc.frequency.exponentialRampToValueAtTime(isFwd ? 130 : 260, now + 0.22);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(now); osc.stop(now + 0.25);
  } catch (_) {}
}

function goTo(id, dir = "forward") {
  const node = graph.nodes.find(n => n.id === id);
  if (!node || (id === currId && layerA.style.backgroundImage)) return;
  currId = id;
  playAudio(dir);
  const curr = curLayer === 0 ? layerA : layerB, next = curLayer === 0 ? layerB : layerA;
  next.style.backgroundImage = `url("${node.image}")`;
  curr.className = "panorama-layer layer-current " + (dir === "backward" ? "warp-backward-out" : "warp-forward-out");
  next.className = "panorama-layer layer-next " + (dir === "backward" ? "warp-backward-in" : "warp-forward-in");
  setTimeout(() => {
    curLayer = 1 - curLayer;
    curr.className = "panorama-layer layer-next"; curr.style.opacity = "0";
    next.className = "panorama-layer layer-current"; next.style.opacity = "1";
    renderChevrons();
  }, 500);
  $("loc-title").textContent = node.name;
  $("loc-step-badge").textContent = `Node ${node.number || 1} of ${graph.nodes.length}`;
  renderMinimap();
}

function renderChevrons() {
  arrows.innerHTML = "";
  const out = graph.edges.filter(e => e.from === currId);
  out.forEach(e => {
    const btn = document.createElement("div");
    btn.className = `streetview-arrow arrow-${e.direction || "forward"}`;
    const pts = e.direction === "backward" ? "6 9 12 15 18 9" : e.direction === "right" ? "9 18 15 12 9 6" : e.direction === "left" ? "15 18 9 12 15 6" : "18 15 12 9 6 15";
    btn.innerHTML = `<div class="arrow-tooltip">${e.label || "Step"}</div><div class="arrow-disc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="${pts}"></polyline></svg></div>`;
    btn.onclick = ev => { ev.stopPropagation(); goTo(e.to, e.direction); };
    arrows.appendChild(btn);
  });
  $("floor-target-ring").style.display = out.some(e => e.direction === "forward") ? "block" : "none";
}

function renderMinimap() {
  svg.innerHTML = `<g stroke="rgba(66,133,244,0.4)" stroke-width="2" stroke-dasharray="3,3">${graph.edges.map(e => {
    const a = graph.nodes.find(n => n.id === e.from), b = graph.nodes.find(n => n.id === e.to);
    return a && b ? `<line x1="${a.mapX ?? 50}" y1="${a.mapY ?? 50}" x2="${b.mapX ?? 50}" y2="${b.mapY ?? 50}"/>` : "";
  }).join("")}</g>` + graph.nodes.map(n => {
    const nx = n.mapX ?? 50, ny = n.mapY ?? 50;
    return `<circle cx="${nx}" cy="${ny}" r="${n.id === currId ? 4.5 : 3.5}" fill="${n.id === currId ? "#1a73e8" : "#2b303c"}" stroke="#fff" stroke-width="${n.id === currId ? 1.5 : 1}" style="cursor:pointer" onclick="goTo('${n.id}')"/>
    <text x="${nx}" y="${ny + 1.2}" font-size="3" fill="#fff" font-weight="bold" text-anchor="middle" pointer-events="none">${n.number || ""}</text>`;
  }).join("");
}

// Camera Pan, Tilt & Zoom
const updateCam = () => {
  document.documentElement.style.setProperty("--pan-x", `${pan.x}px`);
  document.documentElement.style.setProperty("--pan-y", `${pan.y}px`);
  document.documentElement.style.setProperty("--tilt-y", `${(pan.x / 280) * 8}deg`);
  document.documentElement.style.setProperty("--tilt-x", `${-(pan.y / 180) * 6}deg`);
  document.documentElement.style.setProperty("--zoom", zoom);
};

$("viewport").onmousedown = e => { if (!e.target.closest(".streetview-arrow")) { isDrag = true; start = { x: e.clientX - pan.x, y: e.clientY - pan.y }; } };
window.onmousemove = e => { if (isDrag) { pan.x = Math.max(-240, Math.min(240, e.clientX - start.x)); pan.y = Math.max(-120, Math.min(120, e.clientY - start.y)); updateCam(); } };
window.onmouseup = () => isDrag = false;
$("viewport").onwheel = e => { e.preventDefault(); zoom = Math.max(0.95, Math.min(2.4, zoom - e.deltaY * 0.0015)); updateCam(); };

// Keyboard Navigation
const toggleMinimap = e => {
  if (e) e.stopPropagation();
  const card = $("minimap-card");
  const isOpening = card.style.display !== "flex";
  card.style.display = isOpening ? "flex" : "none";
  card.classList.toggle("open", isOpening);
};
window.onkeydown = e => {
  const fwd = graph.edges.find(edge => edge.from === currId && edge.direction === "forward");
  const bwd = graph.edges.find(edge => edge.from === currId && edge.direction === "backward");
  if (e.key === "ArrowUp" || e.key === "w") fwd && goTo(fwd.to, "forward");
  if (e.key === "ArrowDown" || e.key === "s") bwd && goTo(bwd.to, "backward");
  if (e.key === "0" || e.key === "Escape") { pan = { x: 0, y: 0 }; zoom = 1; updateCam(); }
  if (e.key === "m" || e.key === "M") toggleMinimap();
};

// UI Controls
$("zoom-reset-btn").onclick = () => { pan = { x: 0, y: 0 }; zoom = 1; updateCam(); };
$("zoom-in-btn").onclick = () => { zoom = Math.min(2.4, zoom + 0.2); updateCam(); };
$("zoom-out-btn").onclick = () => { zoom = Math.max(0.95, zoom - 0.2); updateCam(); };
$("toggle-minimap-btn").onclick = toggleMinimap;
$("close-minimap-btn").onclick = toggleMinimap;
$("fullscreen-btn").onclick = () => { !document.fullscreenElement ? document.documentElement.requestFullscreen().catch(() => {}) : document.exitFullscreen().catch(() => {}); };

// Preload & Start
window.goTo = goTo;
graph.nodes.forEach(n => { const i = new Image(); i.src = n.image; });
goTo(currId);
