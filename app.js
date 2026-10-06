/**
 * Street View Corridor Navigator
 * Interactive graph-based Street View experience with floor chevrons,
 * dynamic minimap radar, pan/tilt controls, and extensible graph data.
 */

// =============================================================================
// Graph Definition
// =============================================================================

const CORRIDOR_GRAPH = {
  id: "corridor-route-alpha",
  name: "Academic Wing - Main Corridor",
  nodes: [
    {
      id: "node-1",
      number: 1,
      name: "Corridor Entrance (South)",
      subtitle: "Near open doorway & office access",
      image: "Dummy_imgs/img-2.jpeg",
      mapX: 50,
      mapY: 82, // percentage coordinates for minimap
      heading: 0, // degrees North
      description: "South entry point of the corridor looking north down the tiled walkway."
    },
    {
      id: "node-2",
      number: 2,
      name: "Mid Corridor (South Section)",
      subtitle: "Passing first window bay & partitions",
      image: "Dummy_imgs/img-1.jpeg",
      mapX: 50,
      mapY: 60,
      heading: 0,
      description: "Midway down the corridor. Side windows visible on the right wall."
    },
    {
      id: "node-3",
      number: 3,
      name: "Mid Corridor (North Section)",
      subtitle: "Approaching the end junction",
      image: "Dummy_imgs/img-3.jpeg",
      mapX: 50,
      mapY: 38,
      heading: 0,
      description: "Closer to the hallway terminus. Ceiling fixtures and alcove ahead."
    },
    {
      id: "node-4",
      number: 4,
      name: "Corridor Alcove / End Wall",
      subtitle: "North terminus facing terminal archway",
      image: "Dummy_imgs/img-4.jpeg",
      mapX: 50,
      mapY: 16,
      heading: 0,
      description: "Final terminus facing the white wall opening and utility alcove."
    }
  ],
  edges: [
    { from: "node-1", to: "node-2", direction: "forward", label: "Walk Forward" },
    { from: "node-2", to: "node-3", direction: "forward", label: "Walk Forward" },
    { from: "node-3", to: "node-4", direction: "forward", label: "Walk Forward" },
    { from: "node-2", to: "node-1", direction: "backward", label: "Step Back" },
    { from: "node-3", to: "node-2", direction: "backward", label: "Step Back" },
    { from: "node-4", to: "node-3", direction: "backward", label: "Step Back" }
  ]
};

// =============================================================================
// State Management
// =============================================================================

class StreetViewer {
  constructor(graph) {
    this.graph = graph;
    this.currentNodeId = graph.nodes[0].id;
    this.previousNodeId = null;
    this.isTransitioning = false;
    this.soundEnabled = false;
    this.isTourRunning = false;
    this.tourTimer = null;
    this.tourIntervalMs = 3200;

    // Camera transform state
    this.zoom = 1.0;
    this.minZoom = 0.95;
    this.maxZoom = 2.4;
    this.panX = 0;
    this.panY = 0;
    this.tiltX = 0;
    this.tiltY = 0;
    this.targetPanX = 0;
    this.targetPanY = 0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.currentLayerIndex = 0; // 0 for layer A, 1 for layer B

    // Audio Context
    this.audioCtx = null;

    // DOM references
    this.cacheDOMElements();

    // Initialize
    this.init();
  }

  cacheDOMElements() {
    this.dom = {
      viewport: document.getElementById("viewport"),
      sceneWrapper: document.getElementById("scene-wrapper"),
      layerA: document.getElementById("layer-a"),
      layerB: document.getElementById("layer-b"),
      navArrows: document.getElementById("nav-arrows"),
      floorTargetRing: document.getElementById("floor-target-ring"),
      // Top info card
      locTitle: document.getElementById("loc-title"),
      locSubtitle: document.getElementById("loc-subtitle"),
      locStepBadge: document.getElementById("loc-step-badge"),
      // Compass
      compassWidget: document.getElementById("compass-widget"),
      // Minimap
      minimapWrapper: document.getElementById("minimap-wrapper"),
      minimapSvg: document.getElementById("minimap-svg"),
      minimapThumbPreview: document.getElementById("minimap-thumb-preview"),
      toggleMinimapBtn: document.getElementById("toggle-minimap-btn"),
      // Bottom timeline
      timelineSteps: document.getElementById("timeline-steps"),
      prevStepBtn: document.getElementById("prev-step-btn"),
      nextStepBtn: document.getElementById("next-step-btn"),
      // Top HUD actions
      autoTourBtn: document.getElementById("auto-tour-btn"),
      soundToggleBtn: document.getElementById("sound-toggle-btn"),
      graphViewBtn: document.getElementById("graph-view-btn"),
      shortcutsBtn: document.getElementById("shortcuts-btn"),
      fullscreenBtn: document.getElementById("fullscreen-btn"),
      // Zoom controls
      zoomInBtn: document.getElementById("zoom-in-btn"),
      zoomOutBtn: document.getElementById("zoom-out-btn"),
      zoomResetBtn: document.getElementById("zoom-reset-btn"),
      // Modals
      graphModal: document.getElementById("graph-modal"),
      shortcutsModal: document.getElementById("shortcuts-modal"),
      graphJsonViewer: document.getElementById("graph-json-viewer"),
      graphModalCanvas: document.getElementById("graph-modal-canvas")
    };
  }

  init() {
    this.preloadImages();
    this.setupMinimap();
    this.setupTimeline();
    this.renderCurrentNode(false);
    this.attachEventListeners();
    this.startRenderLoop();
  }

  // Preload all node images for seamless transitions
  preloadImages() {
    this.graph.nodes.forEach(node => {
      const img = new Image();
      img.src = node.image;
    });
  }

  // =============================================================================
  // Graph Traversal Helpers
  // =============================================================================

  getNode(id) {
    return this.graph.nodes.find(n => n.id === id);
  }

  getCurrentNode() {
    return this.getNode(this.currentNodeId);
  }

  getOutEdges(fromId) {
    return this.graph.edges.filter(edge => edge.from === fromId);
  }

  getForwardEdge(fromId) {
    return this.getOutEdges(fromId).find(e => e.direction === "forward");
  }

  getBackwardEdge(fromId) {
    return this.getOutEdges(fromId).find(e => e.direction === "backward");
  }

  // =============================================================================
  // Navigation & Street View Transition Engine
  // =============================================================================

  navigateTo(targetNodeId, direction = "forward") {
    if (this.isTransitioning || targetNodeId === this.currentNodeId) return;

    const targetNode = this.getNode(targetNodeId);
    if (!targetNode) return;

    this.isTransitioning = true;
    this.previousNodeId = this.currentNodeId;
    this.currentNodeId = targetNodeId;

    // Clear active floor arrows immediately to avoid double-clicks
    this.dom.navArrows.innerHTML = "";
    if (this.dom.floorTargetRing) {
      this.dom.floorTargetRing.style.display = "none";
    }

    // Play footstep / camera swoop sound
    this.playSound(direction);

    // Identify active and incoming layers
    const currentLayer = this.currentLayerIndex === 0 ? this.dom.layerA : this.dom.layerB;
    const nextLayer = this.currentLayerIndex === 0 ? this.dom.layerB : this.dom.layerA;

    // Set target image on next layer
    nextLayer.style.backgroundImage = `url("${targetNode.image}")`;

    // Reset animation classes
    currentLayer.className = "panorama-layer layer-current";
    nextLayer.className = "panorama-layer layer-next";

    // Trigger reflow to restart CSS animation
    void nextLayer.offsetWidth;

    // Apply authentic Street View zoom/warp effect
    if (direction === "forward") {
      currentLayer.classList.add("warp-forward-out");
      nextLayer.classList.add("warp-forward-in");
    } else {
      currentLayer.classList.add("warp-backward-out");
      nextLayer.classList.add("warp-backward-in");
    }

    // Reset pan & tilt gently towards center
    this.targetPanX = this.targetPanX * 0.25;
    this.targetPanY = this.targetPanY * 0.25;

    // Update HUD and Minimap immediately
    this.updateHUD();
    this.updateMinimapPegman();
    this.updateTimelineUI();

    // Complete transition after animation ends (550ms)
    setTimeout(() => {
      // Swap layer index
      this.currentLayerIndex = this.currentLayerIndex === 0 ? 1 : 0;
      currentLayer.className = "panorama-layer layer-next";
      currentLayer.style.opacity = "0";
      nextLayer.className = "panorama-layer layer-current";
      nextLayer.style.opacity = "1";

      this.isTransitioning = false;
      this.renderFloorChevrons();
    }, 550);
  }

  renderCurrentNode(postTransition = false) {
    const node = this.getCurrentNode();
    const activeLayer = this.currentLayerIndex === 0 ? this.dom.layerA : this.dom.layerB;

    if (!postTransition) {
      activeLayer.style.backgroundImage = `url("${node.image}")`;
      activeLayer.style.opacity = "1";
    }

    this.updateHUD();
    this.updateMinimapPegman();
    this.updateTimelineUI();
    this.renderFloorChevrons();
  }

  // =============================================================================
  // Floor Navigation Chevrons
  // =============================================================================

  renderFloorChevrons() {
    this.dom.navArrows.innerHTML = "";
    if (this.isTransitioning) return;

    const outEdges = this.getOutEdges(this.currentNodeId);
    const forwardEdge = outEdges.find(e => e.direction === "forward");
    const backwardEdge = outEdges.find(e => e.direction === "backward");

    // Forward Chevron (Walking deeper into the corridor)
    if (forwardEdge) {
      const targetNode = this.getNode(forwardEdge.to);
      const arrowFwd = document.createElement("div");
      arrowFwd.className = "streetview-arrow arrow-forward";
      arrowFwd.setAttribute("role", "button");
      arrowFwd.setAttribute("tabindex", "0");
      arrowFwd.setAttribute("aria-label", `Step forward to ${targetNode.name}`);
      arrowFwd.innerHTML = `
        <div class="arrow-tooltip">Advance: ${targetNode.name}</div>
        <div class="arrow-disc">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
        </div>
      `;
      arrowFwd.addEventListener("click", (e) => {
        e.stopPropagation();
        this.navigateTo(forwardEdge.to, "forward");
      });
      arrowFwd.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.navigateTo(forwardEdge.to, "forward");
        }
      });
      this.dom.navArrows.appendChild(arrowFwd);
      if (this.dom.floorTargetRing) {
        this.dom.floorTargetRing.style.display = "block";
      }
    } else {
      if (this.dom.floorTargetRing) {
        this.dom.floorTargetRing.style.display = "none";
      }
    }

    // Backward Chevron (Step back to previous corridor position)
    if (backwardEdge) {
      const targetNode = this.getNode(backwardEdge.to);
      const arrowBwd = document.createElement("div");
      arrowBwd.className = "streetview-arrow arrow-backward";
      arrowBwd.setAttribute("role", "button");
      arrowBwd.setAttribute("tabindex", "0");
      arrowBwd.setAttribute("aria-label", `Step back to ${targetNode.name}`);
      arrowBwd.innerHTML = `
        <div class="arrow-disc" style="width: 52px; height: 52px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
        <div class="arrow-tooltip">Step Back: ${targetNode.name}</div>
      `;
      arrowBwd.addEventListener("click", (e) => {
        e.stopPropagation();
        this.navigateTo(backwardEdge.to, "backward");
      });
      arrowBwd.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.navigateTo(backwardEdge.to, "backward");
        }
      });
      this.dom.navArrows.appendChild(arrowBwd);
    }
  }

  // =============================================================================
  // UI & HUD Overlays
  // =============================================================================

  updateHUD() {
    const node = this.getCurrentNode();
    const total = this.graph.nodes.length;
    this.dom.locTitle.textContent = node.name;
    this.dom.locSubtitle.textContent = node.subtitle;
    this.dom.locStepBadge.textContent = `Node ${node.number} of ${total}`;

    // Update prev/next button states
    const forwardEdge = this.getForwardEdge(this.currentNodeId);
    const backwardEdge = this.getBackwardEdge(this.currentNodeId);
    this.dom.prevStepBtn.disabled = !backwardEdge;
    this.dom.nextStepBtn.disabled = !forwardEdge;
  }

  // =============================================================================
  // Interactive Minimap (Floor Plan & Graph)
  // =============================================================================

  setupMinimap() {
    const svg = this.dom.minimapSvg;
    svg.innerHTML = "";

    // Draw hallway architectural floor plan
    const floorPlan = document.createElementNS("http://www.w3.org/2000/svg", "g");
    floorPlan.innerHTML = `
      <!-- Corridor Boundary Walls -->
      <rect x="25" y="10" width="50" height="80" rx="4" fill="#181b22" stroke="rgba(255,255,255,0.22)" stroke-width="1.5" />
      <!-- Corridor Floor Grid Pattern -->
      <line x1="25" y1="30" x2="75" y2="30" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
      <line x1="25" y1="50" x2="75" y2="50" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
      <line x1="25" y1="70" x2="75" y2="70" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
      <!-- Room 101 Entrance Door Notch on Right -->
      <rect x="75" y="76" width="14" height="12" fill="#14171d" stroke="rgba(255,255,255,0.22)" stroke-width="1" stroke-dasharray="2,2" />
      <text x="82" y="84" font-size="3" fill="#8ab4f8" text-anchor="middle" font-weight="600">R101</text>
      <!-- Hallway Path Centerline Graph -->
      <line x1="50" y1="82" x2="50" y2="16" stroke="rgba(66, 133, 244, 0.45)" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="3,3" />
    `;
    svg.appendChild(floorPlan);

    // Draw Graph Nodes
    const nodesGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    nodesGroup.setAttribute("class", "minimap-nodes");

    this.graph.nodes.forEach(node => {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "minimap-node-group");
      g.style.cursor = "pointer";

      // Outer clickable hit target
      const hitCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      hitCircle.setAttribute("cx", node.mapX);
      hitCircle.setAttribute("cy", node.mapY);
      hitCircle.setAttribute("r", "8");
      hitCircle.setAttribute("fill", "transparent");

      // Visual Node circle
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", node.mapX);
      circle.setAttribute("cy", node.mapY);
      circle.setAttribute("r", "3.5");
      circle.setAttribute("fill", "#2b303c");
      circle.setAttribute("stroke", "#ffffff");
      circle.setAttribute("stroke-width", "1");
      circle.setAttribute("id", `map-node-${node.id}`);

      // Node number label
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", node.mapX);
      text.setAttribute("y", node.mapY + 1.2);
      text.setAttribute("font-size", "3");
      text.setAttribute("fill", "#ffffff");
      text.setAttribute("font-weight", "bold");
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("pointer-events", "none");
      text.textContent = node.number;

      g.appendChild(hitCircle);
      g.appendChild(circle);
      g.appendChild(text);

      // Hover thumbnail preview
      g.addEventListener("mouseenter", () => {
        this.dom.minimapThumbPreview.style.backgroundImage = `url("${node.image}")`;
        this.dom.minimapThumbPreview.classList.add("visible");
        circle.setAttribute("fill", "#1a73e8");
        circle.setAttribute("r", "4.5");
      });

      g.addEventListener("mouseleave", () => {
        this.dom.minimapThumbPreview.classList.remove("visible");
        if (node.id !== this.currentNodeId) {
          circle.setAttribute("fill", "#2b303c");
          circle.setAttribute("r", "3.5");
        }
      });

      // Click to navigate
      g.addEventListener("click", () => {
        const direction = node.number > this.getCurrentNode().number ? "forward" : "backward";
        this.navigateTo(node.id, direction);
      });

      nodesGroup.appendChild(g);
    });

    svg.appendChild(nodesGroup);

    // Pegman & Radar Group directly inside SVG for locked coordinate precision
    const pegmanGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    pegmanGroup.setAttribute("id", "pegman-svg-group");
    pegmanGroup.style.pointerEvents = "none";
    pegmanGroup.style.transition = "transform var(--transition-travel)";

    const initialNode = this.getCurrentNode();
    pegmanGroup.setAttribute("transform", `translate(${initialNode.mapX}, ${initialNode.mapY})`);

    pegmanGroup.innerHTML = `
      <defs>
        <radialGradient id="radarGrad" cx="50%" cy="100%" r="100%">
          <stop offset="0%" stop-color="#1a73e8" stop-opacity="0.8" />
          <stop offset="50%" stop-color="#4285f4" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#4285f4" stop-opacity="0" />
        </radialGradient>
      </defs>
      <!-- Radar cone -->
      <path id="radar-svg-cone" d="M 0 0 L -14 -30 A 32 32 0 0 1 14 -30 Z" fill="url(#radarGrad)" />
      <!-- Pulsing ring -->
      <circle r="7" fill="none" stroke="rgba(26, 115, 232, 0.5)" stroke-width="1.2">
        <animate attributeName="r" values="5;9;5" dur="2s" repeatCount="indefinite" />
        <animate attributeName="stroke-opacity" values="0.8;0.2;0.8" dur="2s" repeatCount="indefinite" />
      </circle>
      <!-- Blue pegman dot -->
      <circle r="4.6" fill="#1a73e8" stroke="#ffffff" stroke-width="1.6" />
      <circle r="1.8" fill="#ffffff" />
    `;

    svg.appendChild(pegmanGroup);
    this.updateMinimapPegman();
  }

  updateMinimapPegman() {
    const node = this.getCurrentNode();
    if (!node) return;

    // Update SVG Pegman position
    const pegmanGroup = document.getElementById("pegman-svg-group");
    if (pegmanGroup) {
      pegmanGroup.setAttribute("transform", `translate(${node.mapX}, ${node.mapY})`);
    }

    // Highlight active node in minimap
    this.graph.nodes.forEach(n => {
      const circle = document.getElementById(`map-node-${n.id}`);
      if (circle) {
        if (n.id === node.id) {
          circle.setAttribute("fill", "#1a73e8");
          circle.setAttribute("stroke", "#ffffff");
          circle.setAttribute("stroke-width", "1.5");
          circle.setAttribute("r", "4.5");
        } else {
          circle.setAttribute("fill", "#2b303c");
          circle.setAttribute("stroke", "rgba(255,255,255,0.4)");
          circle.setAttribute("stroke-width", "1");
          circle.setAttribute("r", "3.5");
        }
      }
    });
  }

  // =============================================================================
  // Timeline Scrubber
  // =============================================================================

  setupTimeline() {
    this.dom.timelineSteps.innerHTML = "";

    this.graph.nodes.forEach((node, index) => {
      // Step Node Button
      const stepBtn = document.createElement("button");
      stepBtn.className = `step-node ${node.id === this.currentNodeId ? "active" : ""}`;
      stepBtn.id = `step-btn-${node.id}`;
      stepBtn.textContent = node.number;
      stepBtn.title = node.name;
      stepBtn.addEventListener("click", () => {
        const direction = node.number > this.getCurrentNode().number ? "forward" : "backward";
        this.navigateTo(node.id, direction);
      });
      this.dom.timelineSteps.appendChild(stepBtn);

      // Connector line (except after last item)
      if (index < this.graph.nodes.length - 1) {
        const connector = document.createElement("div");
        connector.className = "step-connector";
        connector.id = `step-connector-${node.id}`;
        this.dom.timelineSteps.appendChild(connector);
      }
    });
  }

  updateTimelineUI() {
    const currentNum = this.getCurrentNode().number;

    this.graph.nodes.forEach((node) => {
      const btn = document.getElementById(`step-btn-${node.id}`);
      if (btn) {
        btn.classList.toggle("active", node.id === this.currentNodeId);
      }

      const connector = document.getElementById(`step-connector-${node.id}`);
      if (connector) {
        connector.classList.toggle("completed", node.number < currentNum);
      }
    });
  }

  // =============================================================================
  // Camera Pan, Tilt, and Zoom Controls
  // =============================================================================

  setZoom(val) {
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, val));
    document.documentElement.style.setProperty("--zoom", this.zoom);
  }

  resetView() {
    this.targetPanX = 0;
    this.targetPanY = 0;
    this.setZoom(1.0);
  }

  startRenderLoop() {
    const render = () => {
      // Smooth lerp for pan & tilt inertia
      this.panX += (this.targetPanX - this.panX) * 0.12;
      this.panY += (this.targetPanY - this.panY) * 0.12;

      // Calculate subtle perspective tilt based on pan
      this.tiltY = (this.panX / 280) * 9; // degrees yaw
      this.tiltX = -(this.panY / 180) * 6; // degrees pitch

      // Update CSS variables
      document.documentElement.style.setProperty("--pan-x", `${this.panX}px`);
      document.documentElement.style.setProperty("--pan-y", `${this.panY}px`);
      document.documentElement.style.setProperty("--tilt-y", `${this.tiltY}deg`);
      document.documentElement.style.setProperty("--tilt-x", `${this.tiltX}deg`);

      // Update compass & radar cone heading
      const heading = this.tiltY * 2.2;
      document.documentElement.style.setProperty("--compass-heading", `${heading}deg`);
      document.documentElement.style.setProperty("--look-heading", `${heading}deg`);

      // Rotate SVG radar cone
      const radarCone = document.getElementById("radar-svg-cone");
      if (radarCone) {
        radarCone.setAttribute("transform", `rotate(${heading})`);
      }

      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }

  // =============================================================================
  // Auto Tour (Walkthrough) Mode
  // =============================================================================

  toggleAutoTour() {
    if (this.isTourRunning) {
      this.stopAutoTour();
    } else {
      this.startAutoTour();
    }
  }

  startAutoTour() {
    this.isTourRunning = true;
    this.dom.autoTourBtn.classList.add("active");
    this.dom.autoTourBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="4" width="4" height="16"></rect>
        <rect x="14" y="4" width="4" height="16"></rect>
      </svg>
      <span>Pause Tour</span>
    `;

    // Advance loop
    this.tourTimer = setInterval(() => {
      const forwardEdge = this.getForwardEdge(this.currentNodeId);
      if (forwardEdge) {
        this.navigateTo(forwardEdge.to, "forward");
      } else {
        // Reached end; loop back to start
        const firstNode = this.graph.nodes[0];
        this.navigateTo(firstNode.id, "backward");
      }
    }, this.tourIntervalMs);
  }

  stopAutoTour() {
    this.isTourRunning = false;
    clearInterval(this.tourTimer);
    this.tourTimer = null;
    this.dom.autoTourBtn.classList.remove("active");
    this.dom.autoTourBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
      <span>Auto Walk</span>
    `;
  }

  // =============================================================================
  // Synthesized Web Audio Sound Effects
  // =============================================================================

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    this.dom.soundToggleBtn.classList.toggle("active", this.soundEnabled);

    if (this.soundEnabled && !this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }

    const icon = this.soundEnabled
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`;

    this.dom.soundToggleBtn.innerHTML = `${icon}<span>${this.soundEnabled ? "Audio On" : "Muted"}</span>`;

    if (this.soundEnabled) {
      this.playSound("click");
    }
  }

  playSound(type = "forward") {
    if (!this.soundEnabled || !this.audioCtx) return;

    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      if (type === "forward") {
        // Crisp spatial swoop + footstep click
        osc.type = "sine";
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.28);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      } else if (type === "backward") {
        // Reverse pitch tone
        osc.type = "sine";
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(280, now + 0.26);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      } else {
        // Subtle click
        osc.type = "triangle";
        osc.frequency.setValueAtTime(800, now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      }

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch (err) {
      console.warn("Audio play error", err);
    }
  }

  // =============================================================================
  // Graph Modal Visualizer
  // =============================================================================

  openGraphModal() {
    this.dom.graphModal.classList.add("open");
    requestAnimationFrame(() => this.renderGraphModalCanvas());
    this.dom.graphJsonViewer.textContent = JSON.stringify(this.graph, null, 2);
  }

  closeModals() {
    this.dom.graphModal.classList.remove("open");
    this.dom.shortcutsModal.classList.remove("open");
  }

  renderGraphModalCanvas() {
    const canvas = this.dom.graphModalCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 600;
    const height = canvas.clientHeight || 220;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    // Node positions across horizontal graph
    const nodePositions = {
      "node-1": { x: width * 0.16, y: height * 0.48 },
      "node-2": { x: width * 0.38, y: height * 0.48 },
      "node-3": { x: width * 0.62, y: height * 0.48 },
      "node-4": { x: width * 0.84, y: height * 0.48 }
    };
    this.modalNodePositions = nodePositions;

    // Draw connecting edge lines
    ctx.strokeStyle = "rgba(66, 133, 244, 0.5)";
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(nodePositions["node-1"].x, nodePositions["node-1"].y);
    ctx.lineTo(nodePositions["node-4"].x, nodePositions["node-4"].y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw bidirectional arrow midpoints
    for (let i = 1; i <= 3; i++) {
      const p1 = nodePositions[`node-${i}`];
      const p2 = nodePositions[`node-${i+1}`];
      const midX = (p1.x + p2.x) / 2;
      const midY = p1.y;

      ctx.fillStyle = "#8ab4f8";
      ctx.beginPath();
      ctx.arc(midX, midY, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw nodes
    this.graph.nodes.forEach(node => {
      const pos = nodePositions[node.id];
      if (!pos) return;
      const isActive = node.id === this.currentNodeId;

      // Glow if active
      if (isActive) {
        ctx.fillStyle = "rgba(26, 115, 232, 0.35)";
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 24, 0, Math.PI * 2);
        ctx.fill();
      }

      // Outer circle
      ctx.fillStyle = isActive ? "#1a73e8" : "#242833";
      ctx.strokeStyle = isActive ? "#ffffff" : "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Node number
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.number, pos.x, pos.y);

      // Label below
      ctx.fillStyle = isActive ? "#8ab4f8" : "#9aa0a6";
      ctx.font = "12px sans-serif";
      const shortName = node.name.replace("Corridor ", "");
      ctx.fillText(shortName, pos.x, pos.y + 26);
    });
  }

  // =============================================================================
  // Event Listeners & Interaction Handlers
  // =============================================================================

  attachEventListeners() {
    // 1. Mouse Drag Pan
    this.dom.viewport.addEventListener("mousedown", (e) => {
      if (e.target.closest(".streetview-arrow") || e.target.closest("button")) return;
      this.isDragging = true;
      this.dragStartX = e.clientX - this.targetPanX;
      this.dragStartY = e.clientY - this.targetPanY;
    });

    window.addEventListener("mousemove", (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      this.targetPanX = Math.max(-240, Math.min(240, dx));
      this.targetPanY = Math.max(-120, Math.min(120, dy));
    });

    window.addEventListener("mouseup", () => {
      this.isDragging = false;
    });

    // 2. Touch Gestures (Mobile Support)
    let touchStartX = 0;
    let touchStartY = 0;
    this.dom.viewport.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX - this.targetPanX;
        touchStartY = e.touches[0].clientY - this.targetPanY;
      }
    }, { passive: true });

    this.dom.viewport.addEventListener("touchmove", (e) => {
      if (e.touches.length === 1) {
        const dx = e.touches[0].clientX - touchStartX;
        const dy = e.touches[0].clientY - touchStartY;
        this.targetPanX = Math.max(-240, Math.min(240, dx));
        this.targetPanY = Math.max(-120, Math.min(120, dy));
      }
    }, { passive: true });

    // Double-click floor to advance (Google Street View behavior)
    this.dom.viewport.addEventListener("dblclick", (e) => {
      if (e.target.closest(".streetview-arrow") || e.target.closest(".hud-btn")) return;
      const forwardEdge = this.getForwardEdge(this.currentNodeId);
      if (forwardEdge) {
        this.navigateTo(forwardEdge.to, "forward");
      }
    });

    // 3. Scroll Wheel Zoom
    this.dom.viewport.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.0015;
      this.setZoom(this.zoom + delta);
    }, { passive: false });

    // 4. Keyboard Navigation
    window.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
        case "PageUp": {
          e.preventDefault();
          const forwardEdge = this.getForwardEdge(this.currentNodeId);
          if (forwardEdge) this.navigateTo(forwardEdge.to, "forward");
          break;
        }
        case "ArrowDown":
        case "s":
        case "S":
        case "PageDown": {
          e.preventDefault();
          const backwardEdge = this.getBackwardEdge(this.currentNodeId);
          if (backwardEdge) this.navigateTo(backwardEdge.to, "backward");
          break;
        }
        case "ArrowLeft":
        case "a":
        case "A": {
          e.preventDefault();
          this.targetPanX = Math.min(240, this.targetPanX + 40);
          break;
        }
        case "ArrowRight":
        case "d":
        case "D": {
          e.preventDefault();
          this.targetPanX = Math.max(-240, this.targetPanX - 40);
          break;
        }
        case "+":
        case "=": {
          this.setZoom(this.zoom + 0.15);
          break;
        }
        case "-":
        case "_": {
          this.setZoom(this.zoom - 0.15);
          break;
        }
        case "0":
        case "Escape": {
          this.resetView();
          this.closeModals();
          break;
        }
        case " ": {
          e.preventDefault();
          this.toggleAutoTour();
          break;
        }
        case "m":
        case "M": {
          this.dom.minimapWrapper.classList.toggle("expanded");
          break;
        }
        case "g":
        case "G": {
          this.openGraphModal();
          break;
        }
        case "?": {
          this.dom.shortcutsModal.classList.add("open");
          break;
        }
      }
    });

    // 5. Timeline Previous / Next Buttons
    this.dom.prevStepBtn.addEventListener("click", () => {
      const backwardEdge = this.getBackwardEdge(this.currentNodeId);
      if (backwardEdge) this.navigateTo(backwardEdge.to, "backward");
    });

    this.dom.nextStepBtn.addEventListener("click", () => {
      const forwardEdge = this.getForwardEdge(this.currentNodeId);
      if (forwardEdge) this.navigateTo(forwardEdge.to, "forward");
    });

    // 6. Compass Click Resets View to North
    this.dom.compassWidget.addEventListener("click", () => {
      this.resetView();
    });

    // 7. Zoom Buttons
    this.dom.zoomInBtn.addEventListener("click", () => this.setZoom(this.zoom + 0.2));
    this.dom.zoomOutBtn.addEventListener("click", () => this.setZoom(this.zoom - 0.2));
    this.dom.zoomResetBtn.addEventListener("click", () => this.resetView());

    // 8. Auto Tour & Sound Buttons
    this.dom.autoTourBtn.addEventListener("click", () => this.toggleAutoTour());
    this.dom.soundToggleBtn.addEventListener("click", () => this.toggleSound());

    // 9. Minimap Size Toggle
    this.dom.toggleMinimapBtn.addEventListener("click", () => {
      this.dom.minimapWrapper.classList.toggle("expanded");
    });

    // 10. Modals
    this.dom.graphViewBtn.addEventListener("click", () => this.openGraphModal());
    this.dom.shortcutsBtn.addEventListener("click", () => this.dom.shortcutsModal.classList.add("open"));

    // Click on Canvas in Graph Modal to Navigate Directly to Node
    this.dom.graphModalCanvas.addEventListener("click", (e) => {
      if (!this.modalNodePositions) return;
      const rect = this.dom.graphModalCanvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      this.graph.nodes.forEach(node => {
        const pos = this.modalNodePositions[node.id];
        if (!pos) return;
        const dist = Math.hypot(clickX - pos.x, clickY - pos.y);
        if (dist <= 24) {
          const direction = node.number > this.getCurrentNode().number ? "forward" : "backward";
          this.navigateTo(node.id, direction);
          this.renderGraphModalCanvas();
        }
      });
    });

    document.querySelectorAll(".modal-close-btn").forEach(btn => {
      btn.addEventListener("click", () => this.closeModals());
    });

    document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) this.closeModals();
      });
    });

    // Fullscreen Toggle
    this.dom.fullscreenBtn.addEventListener("click", () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    // Window Resize redraws graph canvas if modal open
    window.addEventListener("resize", () => {
      if (this.dom.graphModal.classList.contains("open")) {
        this.renderGraphModalCanvas();
      }
    });

    // Copy Graph JSON Button
    const copyBtn = document.getElementById("copy-graph-btn");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        const text = JSON.stringify(this.graph, null, 2);
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(() => {
            copyBtn.textContent = "Copied! ✓";
            setTimeout(() => { copyBtn.textContent = "Copy JSON"; }, 2000);
          }).catch(() => {});
        }
      });
    }
  }
}

// Instantiate on DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  window.viewer = new StreetViewer(CORRIDOR_GRAPH);
});
