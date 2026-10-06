# 🧭 Corridor Street View (Graph-Based Image Explorer)

An interactive, Google Street View–style indoor panoramic explorer built with vanilla HTML5, CSS3 3D transforms, and modern JavaScript. It models continuous spatial traversal across real photographs using a directional graph.

---

## 📸 Image Path Sequence

The 4 corridor images in [`Dummy_imgs/`](file:///Users/shwetank/Coding/Projects/Clueless/Dummy_imgs) form a linear line graph traversing the corridor from south to north:

| Node | Name | Image File | Description |
|:---:|:---|:---|:---|
| **Node 1** | Corridor Entrance (South) | `Dummy_imgs/img-2.jpeg` | Entrance looking down the corridor with Room 101 on the right |
| **Node 2** | Mid Corridor (South Section) | `Dummy_imgs/img-1.jpeg` | Past the first doorway and partition wall |
| **Node 3** | Mid Corridor (North Section) | `Dummy_imgs/img-3.jpeg` | Approaching the end alcove and doorway |
| **Node 4** | Corridor Alcove / End Wall | `Dummy_imgs/img-4.jpeg` | North terminus facing the terminal wall and archway |

---

## 🚀 How to Run

You can open the project in any browser immediately:

1. **Direct File Opening**:
   Simply open [`index.html`](file:///Users/shwetank/Coding/Projects/Clueless/index.html) directly in Safari, Chrome, Edge, or Firefox:
   ```bash
   open index.html
   ```

2. **Or via Local Web Server**:
   ```bash
   python3 -m http.server 8080
   ```
   Then navigate to `http://localhost:8080` in your web browser.

---

## 🌟 Google Street View Features Included

- **3D Ground-Plane Chevrons**: Perspective floor arrows (`perspective(500px) rotateX(55deg)`) hovering over the tiled floor with pulse rings and distance labels.
- **Street View Warp / Glide Transitions**: Dual-layer crossfade with zoom-in forward scaling and motion blur matching the hallway vanishing point.
- **Interactive Floor Plan Minimap**:
  - Architectural vector floor plan showing corridor walls, doorways, and path line.
  - Interactive **Pegman** position marker that smoothly moves between nodes.
  - **Dynamic Radar Vision Cone** tracking user camera heading and tilt in real time.
  - Hovering any node displays a live photo thumbnail preview.
  - Clicking any node navigates directly to that stop.
- **Camera Pan, Tilt & Zoom**:
  - Drag mouse or swipe to look around with perspective tilt and inertia damping.
  - Scroll wheel or `+` / `-` buttons to zoom in up to 2.4×.
- **Dynamic Compass Dial**: Live rotating compass dial pointing true North.
- **Bottom Timeline Scrubber**: Step numbers `[1] — [2] — [3] — [4]` with forward and back buttons.
- **Auto Walkthrough (Tour Mode)**: Automatically steps forward through the hallway path every 3.2 seconds (press `Space` or click **Auto Walk**).
- **Spatial Audio Effects**: Pure Web Audio API synthesized footstep/swoop sound effects (click **Muted** to enable).
- **Graph Inspector Modal**: Visual diagram of the graph with live current node highlight and instant JSON schema export.

---

## ⌨️ Controls & Shortcuts

| Action | Shortcut / Control |
|:---|:---|
| **Step Forward** | `↑` Arrow, `W`, `PageUp`, or click floor chevron |
| **Step Backward** | `↓` Arrow, `S`, `PageDown`, or click backward chevron |
| **Look Left / Right** | Drag mouse or `←` `→` / `A` `D` |
| **Zoom In / Out** | Scroll wheel, `+` / `-` keys, or zoom buttons |
| **Reset View** | `0` or `Escape`, or click Compass |
| **Toggle Auto Tour** | `Space` bar |
| **Toggle Minimap Size** | `M` key |
| **Graph Inspector** | `G` key |
| **Help & Shortcuts** | `?` key |
| **Fullscreen** | Top-right `⛶` button |

---

## 🔀 How to Extend the Graph (Adding Branches or Rooms)

In [`app.js`](file:///Users/shwetank/Coding/Projects/Clueless/app.js), the path is declared in `CORRIDOR_GRAPH`:

```javascript
const CORRIDOR_GRAPH = {
  nodes: [
    { id: "node-1", number: 1, name: "Corridor Entrance", image: "Dummy_imgs/img-2.jpeg", mapX: 50, mapY: 82, heading: 0 },
    { id: "node-2", number: 2, name: "Mid Corridor A",    image: "Dummy_imgs/img-1.jpeg", mapX: 50, mapY: 60, heading: 0 },
    // To add a side room (e.g. Room 101 on the right of node-1):
    // { id: "node-room-101", number: 5, name: "Room 101", image: "Dummy_imgs/room-101.jpeg", mapX: 85, mapY: 82, heading: 90 }
  ],
  edges: [
    { from: "node-1", to: "node-2", direction: "forward", label: "Walk Forward" },
    { from: "node-2", to: "node-1", direction: "backward", label: "Step Back" },
    // Connecting a branch:
    // { from: "node-1", to: "node-room-101", direction: "right", label: "Enter Room 101" }
  ]
};
```

