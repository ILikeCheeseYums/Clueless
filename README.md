# 🧭 Corridor Street View

A minimal, Google Street View–style perspective explorer with a **topological navigation graph**, vanishing-point warp transitions, dynamic 3D floor chevrons, interactive SVG minimap, and synthesized spatial audio by default. Built with **Tailwind CSS** and a lean, lightweight architecture (~300 total lines of code across HTML, CSS, and JS).

---

## 🌟 Key Features

### 1. Authentic Street View Exploration
- **Dual-Layer Warp Transitions**: Dynamic vanishing-point scale and blur transitions (`warp-forward` and `warp-backward`) when moving between corridor waypoints.
- **3D Floor Chevrons**: Dynamic perspective floor arrows on the hallway floor that adapt to available navigation edges.
- **Synthesized Spatial Audio (Default)**: Web Audio API sound cues play automatically on navigation steps without external media files or mute toggles.
- **Top-Left Minimap & Location Card**: Interactive 2D floor plan rendering connected edges and clickable node circles, unified with the corridor section title and expand toggle.
- **Natural Perspective Look-Around**: Mouse drag and wheel zoom with bounded perspective clamping.

---

## 🚀 How to Run

1. **Direct File Opening**:
   Simply open [`index.html`](file:///Users/shwetank/Coding/Projects/Clueless/index.html) in any browser (Safari, Chrome, Edge, Firefox):
   ```bash
   open index.html
   ```

2. **Or via Local Web Server**:
   ```bash
   python3 -m http.server 8080
   ```
   Then visit `http://localhost:8080`.

---

## ⌨️ Controls & Shortcuts

| Action | Shortcut / Control |
|:---|:---|
| **Step Forward** | `↑` Arrow, `W`, or click forward floor chevron |
| **Step Backward** | `↓` Arrow, `S`, or click backward chevron |
| **Pan / Look Around** | Mouse drag or touch swipe |
| **Zoom In / Out** | Scroll wheel, or bottom-right zoom `+` / `-` buttons |
| **Reset View to Center** | `0` or `Escape`, or bottom-right reset button |
| **Toggle Minimap Size** | Click expand icon on top-left card |
| **Fullscreen** | Top-right `⛶` button |
