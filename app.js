// =============================================================================
// Street View Navigator — Autonomous Nomenclature & Panorama Engine
// Nomenclature: {step}{branch}-{turn} (e.g. 1A-F, 2A-F, 3A-R, 3B-L, 5A-L)
// F = Forward, R = Right, L = Left (N maps to F)
// Automatic 360° Panorama Support (aspect ratio >= 1.8)
// =============================================================================

function parseItem(item) {
  const nameStr = typeof item === "string" ? item : (item.name || item.id || "");
  const imgUrl = typeof item === "string" ? item : (item.image || item.url || item.src || "");
  const base = nameStr.split("/").pop().replace(/\.[^.]+$/, "");
  const m = base.match(/(?:^|[^0-9A-Za-z])(\d+)([A-Za-z]+)(?:[-_]([A-Za-z0-9_]+))?(?:$|[^0-9A-Za-z])/);
  if (!m) return { id: base || "node", step: 1, branch: "A", turn: "F", image: imgUrl };
  const rawTurn = (m[3] || "F").toUpperCase();
  const turn = rawTurn.includes("R") ? "R" : rawTurn.includes("L") ? "L" : "F";
  const step = parseInt(m[1], 10);
  const branch = m[2].toUpperCase();
  return { id: `${step}${branch}-${turn}`, step, branch, turn, image: imgUrl };
}

function buildGraphFromNomenclature(inputList) {
  const nodes = [], edges = [];
  const parsed = inputList.map(parseItem);

  const branchMap = {};
  parsed.forEach(n => (branchMap[n.branch] = branchMap[n.branch] || []).push(n));
  const branchKeys = Object.keys(branchMap).sort((a, b) => a === "A" ? -1 : b === "A" ? 1 : a.localeCompare(b));
  branchKeys.forEach(k => branchMap[k].sort((a, b) => a.step - b.step));

  // Compute spatial minimap layout
  const mainBranch = branchMap["A"] || [];
  const coords = {};

  mainBranch.forEach((item, idx) => {
    const y = mainBranch.length > 1 ? Math.round(82 - (idx / (mainBranch.length - 1)) * 64) : 50;
    const x = item.turn === "R" ? 68 : item.turn === "L" ? 32 : 50;
    coords[item.id] = { x, y };
  });

  branchKeys.filter(k => k !== "A").forEach(bk => {
    const list = branchMap[bk];
    const first = list[0];
    const parent = mainBranch.find(m => m.step === first.step - 1) || mainBranch[0] || { id: "root", step: 1 };
    const parentCoord = coords[parent.id] || { x: 50, y: 50 };
    const dir = first.turn === "L" ? -1 : first.turn === "R" ? 1 : first.turn === "F" ? 0 : ((bk.charCodeAt(0) - 65) % 2 === 1 ? -1 : 1);

    list.forEach((item, idx) => {
      const x = dir === 0 ? parentCoord.x : Math.max(12, Math.min(88, parentCoord.x + dir * (24 + idx * 8)));
      const y = Math.max(12, Math.min(88, parentCoord.y - (dir === 0 ? 18 : 12) - idx * 16));
      coords[item.id] = { x, y };
    });
  });

  branchKeys.forEach(bk => {
    branchMap[bk].forEach(item => {
      const { x, y } = coords[item.id] || { x: 50, y: 50 };
      nodes.push({ id: item.id, number: item.step, branch: item.branch, turn: item.turn, image: item.image, mapX: x, mapY: y });
    });
  });

  // 1. Sequential connections within each branch
  branchKeys.forEach(bk => {
    const list = branchMap[bk];
    for (let i = 0; i < list.length - 1; i++) {
      const from = list[i], to = list[i + 1];
      const dir = to.turn === "R" ? "right" : to.turn === "L" ? "left" : "forward";
      edges.push({ from: from.id, to: to.id, direction: dir });
      edges.push({ from: to.id, to: from.id, direction: "backward" });
    }
  });

  // 2. Branch split connections from parent node
  branchKeys.filter(k => k !== "A").forEach(bk => {
    const list = branchMap[bk];
    const first = list[0];
    if (!first) return;
    const parent = mainBranch.find(m => m.step === first.step - 1) || mainBranch[mainBranch.length - 1];
    if (parent) {
      const dir = first.turn === "R" ? "right" : first.turn === "L" ? "left" : "forward";
      edges.push({ from: parent.id, to: first.id, direction: dir });
      edges.push({ from: first.id, to: parent.id, direction: "backward" });
    }
  });

  return { nodes, edges };
}

// Master image store & default corridor images
const DEFAULT_IMAGES = [
  "Dummy_imgs/1A-F.jpeg",
  "Dummy_imgs/2A-F.jpeg",
  "Dummy_imgs/3A-F.jpeg",
  "Dummy_imgs/4A-F.jpeg",
  "Dummy_imgs/5A-L.jpeg"
];

const imageStore = new Map();
function initDefaultImages() {
  imageStore.clear();
  DEFAULT_IMAGES.forEach(img => {
    const parsed = parseItem(img);
    imageStore.set(parsed.id, parsed);
  });
}
initDefaultImages();

let graph = buildGraphFromNomenclature(Array.from(imageStore.values()));
let currId = graph.nodes[0]?.id || "1A-F", curLayer = 0, pan = { x: 0, y: 0 }, panoX = 0, zoom = 1, isDrag = false, start = {}, audioCtx = null;
const $ = id => document.getElementById(id);
const layerA = $("layer-a"), layerB = $("layer-b"), arrows = $("nav-arrows"), svg = $("minimap-svg");

function checkPanorama(node) {
  return new Promise(res => {
    if (node.isPanorama !== undefined) return res(node.isPanorama);
    const img = new Image();
    img.src = node.image;
    img.onload = () => {
      const ar = img.naturalWidth / (img.naturalHeight || 1);
      node.aspectRatio = ar;
      node.isPanorama = ar >= 1.8 || /pano/i.test(node.id) || /pano/i.test(node.image);
      res(node.isPanorama);
    };
    img.onerror = () => res(false);
  });
}

function playAudio(dir = "forward") {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const now = audioCtx.currentTime, osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    const isFwd = dir === "forward" || dir === "right";
    osc.type = "sine";
    osc.frequency.setValueAtTime(isFwd ? 250 : 150, now);
    osc.frequency.exponentialRampToValueAtTime(isFwd ? 130 : 260, now + 0.22);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(now); osc.stop(now + 0.25);
  } catch (_) {}
}

async function goTo(id, dir = "forward", force = false) {
  const node = graph.nodes.find(n => n.id === id);
  if (!node || (!force && id === currId && (curLayer === 0 ? layerA : layerB).style.backgroundImage)) return;
  currId = id;
  playAudio(dir);

  await checkPanorama(node);
  panoX = 0; // Reset orientation to front

  const panoBadge = $("pano-badge");
  if (panoBadge) panoBadge.classList.toggle("hidden", !node.isPanorama);

  const curr = curLayer === 0 ? layerA : layerB, next = curLayer === 0 ? layerB : layerA;
  next.style.backgroundImage = `url("${node.image}")`;
  next.className = "panorama-layer layer-next" + (node.isPanorama ? " is-panorama" : "");
  next.style.opacity = "1";
  curr.style.opacity = "0";

  setTimeout(() => {
    curLayer = 1 - curLayer;
    curr.className = "panorama-layer layer-next";
    next.className = "panorama-layer layer-current" + (node.isPanorama ? " is-panorama" : "");
    updateCam();
    renderChevrons();
  }, 200);

  renderMinimap();
}

function renderChevrons() {
  arrows.innerHTML = "";
  const currentNode = graph.nodes.find(n => n.id === currId);
  const isPano = currentNode && currentNode.isPanorama;
  const out = graph.edges.filter(e => e.from === currId);

  const H = window.innerHeight || 800;
  const AR = currentNode?.aspectRatio || 3.0;
  const W_rev = H * AR;

  out.forEach(e => {
    let screenLeftPercent = null;
    let inView = true;

    if (isPano) {
      const baseAngle = e.direction === "forward" ? 0 : e.direction === "right" ? 90 : e.direction === "left" ? -90 : 180;
      const viewAngle = (panoX / W_rev) * 360;
      let relAngle = (baseAngle + viewAngle) % 360;
      if (relAngle > 180) relAngle -= 360;
      if (relAngle < -180) relAngle += 360;

      inView = Math.abs(relAngle) <= 85;
      screenLeftPercent = 50 + (relAngle / 85) * 38;

      // Keep single exit always accessible
      if (out.length === 1 && !inView) {
        inView = true;
        screenLeftPercent = 50;
      }
    }

    if (!inView) return;

    const btn = document.createElement("div");
    btn.className = `streetview-arrow arrow-${e.direction || "forward"}`;
    if (isPano && screenLeftPercent !== null) {
      btn.style.left = `${screenLeftPercent.toFixed(1)}%`;
      btn.style.transform = `translateX(-50%) perspective(400px) rotateX(${e.direction === "backward" ? "-45deg" : "50deg"})`;
    }

    const pts = e.direction === "backward" ? "6 9 12 15 18 9" : e.direction === "right" ? "9 18 15 12 9 6" : e.direction === "left" ? "15 18 9 12 15 6" : "18 15 12 9 6 15";
    btn.innerHTML = `<div class="arrow-disc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="${pts}"></polyline></svg></div>`;
    btn.onclick = ev => { ev.stopPropagation(); goTo(e.to, e.direction); };
    arrows.appendChild(btn);
  });

  $("floor-target-ring").style.display = (!isPano && out.some(e => e.direction === "forward")) ? "block" : "none";
}

function renderMinimap() {
  svg.innerHTML = `<g stroke="rgba(66,133,244,0.4)" stroke-width="2" stroke-dasharray="3,3">${graph.edges.map(e => {
    const a = graph.nodes.find(n => n.id === e.from), b = graph.nodes.find(n => n.id === e.to);
    return a && b ? `<line x1="${a.mapX ?? 50}" y1="${a.mapY ?? 50}" x2="${b.mapX ?? 50}" y2="${b.mapY ?? 50}"/>` : "";
  }).join("")}</g>` + graph.nodes.map(n => {
    const nx = n.mapX ?? 50, ny = n.mapY ?? 50, isCur = n.id === currId;
    const stroke = isCur ? "#fff" : n.isPanorama ? "#00e5ff" : "#8ab4f8";
    return `<circle cx="${nx}" cy="${ny}" r="${isCur ? 4.5 : 3.5}" fill="${isCur ? "#1a73e8" : "#2b303c"}" stroke="${stroke}" stroke-width="${isCur ? 1.8 : 1.2}" style="cursor:pointer" onclick="goTo('${n.id}')"/>`;
  }).join("");
}

// Camera Pan, Tilt & Zoom
const updateCam = () => {
  const currentNode = graph.nodes.find(n => n.id === currId);
  const isPano = currentNode && currentNode.isPanorama;
  document.documentElement.style.setProperty("--pan-x", `${isPano ? 0 : pan.x}px`);
  document.documentElement.style.setProperty("--pan-y", `${pan.y}px`);
  document.documentElement.style.setProperty("--pano-x", `${panoX}px`);
  document.documentElement.style.setProperty("--tilt-y", `${(isPano ? 0 : pan.x / 280) * 8}deg`);
  document.documentElement.style.setProperty("--tilt-x", `${-(pan.y / 180) * 6}deg`);
  document.documentElement.style.setProperty("--zoom", zoom);
};

function handleDragStart(x, y) {
  isDrag = true;
  start = { x, y };
}

function handleDragMove(x, y) {
  if (!isDrag) return;
  const currentNode = graph.nodes.find(n => n.id === currId);
  const deltaX = x - start.x;
  const deltaY = y - start.y;
  start = { x, y };

  if (currentNode && currentNode.isPanorama) {
    panoX += deltaX * 1.3;
    pan.y = Math.max(-80, Math.min(80, pan.y + deltaY * 0.4));
    updateCam();
    renderChevrons();
  } else {
    pan.x = Math.max(-240, Math.min(240, pan.x + deltaX));
    pan.y = Math.max(-120, Math.min(120, pan.y + deltaY));
    updateCam();
  }
}

function handleDragEnd() {
  isDrag = false;
}

$("viewport").onmousedown = e => { if (!e.target.closest(".streetview-arrow")) handleDragStart(e.clientX, e.clientY); };
window.onmousemove = e => handleDragMove(e.clientX, e.clientY);
window.onmouseup = handleDragEnd;

$("viewport").ontouchstart = e => { if (e.touches.length === 1 && !e.target.closest(".streetview-arrow")) handleDragStart(e.touches[0].clientX, e.touches[0].clientY); };
window.ontouchmove = e => { if (e.touches.length === 1) handleDragMove(e.touches[0].clientX, e.touches[0].clientY); };
window.ontouchend = handleDragEnd;

$("viewport").onwheel = e => { e.preventDefault(); zoom = Math.max(0.95, Math.min(2.4, zoom - e.deltaY * 0.0015)); updateCam(); };

// Keyboard Navigation & Minimap Toggle
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
  const rgt = graph.edges.find(edge => edge.from === currId && edge.direction === "right");
  const lft = graph.edges.find(edge => edge.from === currId && edge.direction === "left");
  if ((e.key === "ArrowUp" || e.key === "w" || e.key === "W") && fwd) goTo(fwd.to, "forward");
  if ((e.key === "ArrowDown" || e.key === "s" || e.key === "S") && bwd) goTo(bwd.to, "backward");
  if ((e.key === "ArrowRight" || e.key === "d" || e.key === "D") && rgt) goTo(rgt.to, "right");
  if ((e.key === "ArrowLeft" || e.key === "a" || e.key === "A") && lft) goTo(lft.to, "left");
  if (e.key === "0" || e.key === "Escape") { pan = { x: 0, y: 0 }; panoX = 0; zoom = 1; updateCam(); renderChevrons(); }
  if (e.key === "m" || e.key === "M") toggleMinimap();
  if (e.key === "c" || e.key === "C") fitBtn && fitBtn.click();
};

// UI Controls
let isFillMode = false;
const fitBtn = $("fit-toggle-btn");
if (fitBtn) {
  fitBtn.onclick = () => {
    isFillMode = !isFillMode;
    document.body.classList.toggle("fill-mode", isFillMode);
    fitBtn.classList.toggle("text-[#8ab4f8]", isFillMode);
  };
}
$("zoom-reset-btn").onclick = () => { pan = { x: 0, y: 0 }; panoX = 0; zoom = 1; updateCam(); renderChevrons(); };
$("zoom-in-btn").onclick = () => { zoom = Math.min(2.4, zoom + 0.2); updateCam(); };
$("zoom-out-btn").onclick = () => { zoom = Math.max(0.95, zoom - 0.2); updateCam(); };
$("toggle-minimap-btn").onclick = toggleMinimap;
$("close-minimap-btn").onclick = toggleMinimap;
$("fullscreen-btn").onclick = () => { !document.fullscreenElement ? document.documentElement.requestFullscreen().catch(() => {}) : document.exitFullscreen().catch(() => {}); };

// Add & Load Images Engine
function loadImagesByNomenclature(imageList, reset = false) {
  if (reset) imageStore.clear();
  imageList.forEach(item => {
    const parsed = parseItem(item);
    imageStore.set(parsed.id, parsed);
  });
  graph = buildGraphFromNomenclature(Array.from(imageStore.values()));
  graph.nodes.forEach(n => {
    const i = new Image();
    i.src = n.image;
    checkPanorama(n);
  });
  if (!graph.nodes.some(n => n.id === currId)) {
    currId = graph.nodes[0]?.id || "1A-F";
  }
  goTo(currId, "forward", true);
}

const fileInput = $("image-file-input");
const triggerFileInput = () => fileInput && fileInput.click();
$("direct-add-btn").onclick = triggerFileInput;
$("add-images-btn").onclick = triggerFileInput;
$("reset-tour-btn").onclick = () => {
  initDefaultImages();
  graph = buildGraphFromNomenclature(Array.from(imageStore.values()));
  currId = graph.nodes[0]?.id || "1A-F";
  goTo(currId, "forward", true);
};

if (fileInput) {
  fileInput.onchange = e => {
    const files = Array.from(e.target.files).filter(f => f.type.startsWith("image/") || /\.(jpe?g|png|webp|avif|bmp|gif)$/i.test(f.name));
    if (files.length) {
      const hasRoot = files.some(f => /(?:^|[^0-9A-Za-z])1[A-Za-z]+(?:[-_][A-Za-z0-9_]+)?(?:\.[^.]+)?$/.test(f.name));
      loadImagesByNomenclature(files.map(f => ({ name: f.name, image: URL.createObjectURL(f) })), hasRoot);
    }
    fileInput.value = "";
  };
}

// Drag & Drop (Supports files & directory folders)
const dragOverlay = $("drag-overlay");
window.ondragenter = e => { e.preventDefault(); if (dragOverlay) dragOverlay.classList.remove("hidden"); };
window.ondragover = e => { e.preventDefault(); if (dragOverlay) dragOverlay.classList.remove("hidden"); };
window.ondragleave = e => { if (e.relatedTarget === null && dragOverlay) dragOverlay.classList.add("hidden"); };
window.ondrop = async e => {
  e.preventDefault();
  if (dragOverlay) dragOverlay.classList.add("hidden");
  const files = [];
  const items = e.dataTransfer.items;
  if (items && items.length) {
    async function readEntry(entry) {
      if (entry.isFile) {
        const file = await new Promise(res => entry.file(res));
        if (file && (file.type.startsWith("image/") || /\.(jpe?g|png|webp|avif|bmp|gif)$/i.test(file.name))) files.push(file);
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const entries = await new Promise(res => reader.readEntries(res));
        for (const child of entries) await readEntry(child);
      }
    }
    for (const item of Array.from(items)) {
      const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
      if (entry) await readEntry(entry);
      else if (item.kind === "file") {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
  } else if (e.dataTransfer.files) {
    files.push(...Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/") || /\.(jpe?g|png|webp|avif|bmp|gif)$/i.test(f.name)));
  }
  if (files.length) {
    const hasRoot = files.some(f => /(?:^|[^0-9A-Za-z])1[A-Za-z]+(?:[-_][A-Za-z0-9_]+)?(?:\.[^.]+)?$/.test(f.name));
    loadImagesByNomenclature(files.map(f => ({ name: f.name, image: URL.createObjectURL(f) })), hasRoot);
  }
};

// Export to window
window.goTo = goTo;
window.loadImagesByNomenclature = loadImagesByNomenclature;
window.buildGraphFromNomenclature = buildGraphFromNomenclature;
window.imageStore = imageStore;

// Preload & Start
graph.nodes.forEach(n => {
  const i = new Image();
  i.src = n.image;
  checkPanorama(n);
});
goTo(currId, "forward", true);
