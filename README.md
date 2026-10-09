# 🧭 Street View Navigator

A lightweight, Google Street View–style 3D perspective corridor walker with an **autonomous graph engine**, **360° panorama support**, clean transitions, spatial audio, and an interactive SVG minimap.

Navigation routes are **self-derived directly from image filenames** using a standardized nomenclature.

---

## 🏷️ Nomenclature Specification

Image filenames follow the convention:
```
{step}{branch}-{turn}.jpeg
```
*(Supports standard image extensions: `.jpeg`, `.jpg`, `.png`, `.webp`, `.avif`)*

### Components:
1. **`{step}`** *(Integer)*: Sequential distance index / stop number (e.g., `1`, `2`, `3`).
2. **`{branch}`** *(Letter)*:
   - **`A`**: Main corridor spine.
   - **`B`, `C`, etc.**; Alternate side branches / corridors.
3. **`-{turn}`** *(Direction code)*:
   - **`-F` (Forward)**: Straight ahead along the corridor (formerly `-N`, which also automatically maps to `-F`).
   - **`-R` (Right)**: Right turn split connecting from parent node `(step - 1)` to this node.
   - **`-L` (Left)**: Left turn split connecting from parent node `(step - 1)` to this node.

### Adaptive Directional Arrows:
Floor chevrons **only appear when their corresponding direction physically exists**:
- At **`1A-F`** (entrance): Only the **Forward** arrow is displayed (no backward arrow).
- At **`4A-F`**: **Left** (to `5A-L`) and **Backward** (to `3A-F`) arrows appear.
- At dead ends (**`5A-L`**): Only the **Backward** arrow appears.

---

## 🌐 360° Panorama Support

The engine automatically detects panoramic photos (aspect ratio $\ge 1.8$, 2:1 equirectangular 360s, or wide stitched panoramas such as `5A-L.jpeg`):
- **Infinite 360° Horizontal Scrolling**: Drag left or right with mouse or touch to smoothly spin around the entire scene with seamless wrapping.
- **Dynamic 360° Floor Arrow Tracking**: Navigation arrows glide across the floor in exact sync with your viewing angle, pointing toward doors and hallways as you rotate.
- **Panorama Indicator Badge**: A subtle floating `360° Panorama` badge appears automatically at panoramic stops.

---

## 🖼️ Uncropped Image Display (Fit vs. Fill)

By default, the engine displays **100% uncropped images** using `contain` mode, preserving your photos' original aspect ratio and resolution (whether portrait `3:4`, widescreen `16:9`, or ultrawide panorama `3.2:1`).
- Press **`C`** or click the **`⤢`** button in the bottom-right toolbar to toggle between:
  - **Fit (Default)**: Full image visible from edge to edge with zero cropping.
  - **Fill**: Full-bleed edge-to-edge coverage.

---

## 🌟 Adding & Changing Images at Will

You can dynamically add, append, or replace images at any time:
1. **Direct Add Button**: Click the image `+` button in the top-left toolbar.
2. **Minimap Footer**: Click the minimap icon (or press `M`), then click **Add Images** or **Reset**.
3. **Drag & Drop**: Drag images or an entire folder onto the browser window. A visual drop-zone overlay appears automatically.
4. **Smart Merging**:
   - Dropping new steps (e.g., `5A-L.jpeg`, `6A-F.jpeg`) **adds** them to the current walkthrough.
   - Dropping a tour starting from stop `1` automatically loads the new walkthrough.
   - Clicking **Reset** restores the default corridor.

---

## 🚀 How to Run

1. **Directly in Browser**:
   Open [`index.html`](index.html) in any browser:
   ```bash
   open index.html
   ```

2. **Via Local Web Server**:
   ```bash
   python3 -m http.server 8080
   ```
   Navigate to `http://localhost:8080`.

---

## ⌨️ Controls & Shortcuts

| Action | Shortcut / Control |
|:---|:---|
| **Step Forward** | `↑` Arrow, `W`, or click forward chevron |
| **Step Backward** | `↓` Arrow, `S`, or click backward chevron |
| **Turn Right** | `→` Arrow, `D`, or click right chevron |
| **Turn Left** | `←` Arrow, `A`, or click left chevron |
| **Look Around / 360° Pan** | Mouse drag or touch swipe horizontally & vertically |
| **Add / Change Images** | Top-left image button, or drop files |
| **Toggle Fit / Fill (No Crop)** | `C` key, or bottom-right `⤢` button |
| **Zoom In / Out** | Scroll wheel, or bottom-right `+` / `-` buttons |
| **Reset View** | `0` or `Escape`, or bottom-right reset button |
| **Toggle Minimap** | `M` key, or click top-left map icon |
| **Fullscreen** | Top-right `⛶` button |
