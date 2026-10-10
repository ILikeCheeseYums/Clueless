/**
 * Parses an image file name or object to extract node nomenclature.
 * 
 * The nomenclature follows the format: {Step}{Branch}-{Turn}
 * - Step: A sequential number indicating progression (e.g., 1, 2, 3)
 * - Branch: A letter identifying the pathway. 'A' is the main branch. 
 * - Turn: 'F' (Forward - neutral/no turn), 'R' (Right), or 'L' (Left)
 * 
 * Example: "2A-R.jpeg" -> Step 2, Branch A, Turn Right.
 * 
 * @param {string|Object} item - The filename string or an object containing image details.
 * @returns {Object} An object containing the extracted properties: id, step, branch, turn, and image URL.
 */
export function parseItem(item) {
  const nameStr = typeof item === "string" ? item : (item.name || item.id || "");
  const imgUrl = typeof item === "string" ? item : (item.image || item.url || item.src || "");
  
  // Extract just the base filename without extension
  const base = nameStr.split("/").pop().replace(/\.[^.]+$/, "");
  
  // Regex matches patterns like "1A-F", "2B_R", "3C", etc.
  // Group 1: Step (\d+)
  // Group 2: Branch ([A-Za-z]+)
  // Group 3: Optional Turn ([A-Za-z0-9_]+)
  const m = base.match(/(?:^|[^0-9A-Za-z])(\d+)([A-Za-z]+)(?:[-_]([A-Za-z0-9_]+))?(?:$|[^0-9A-Za-z])/);
  
  // Fallback for unformatted images
  if (!m) return { id: base || "node", step: 1, branch: "A", turn: "F", image: imgUrl };
  
  const rawTurn = (m[3] || "F").toUpperCase();
  const turn = rawTurn.includes("R") ? "R" : rawTurn.includes("L") ? "L" : "F";
  const step = parseInt(m[1], 10);
  const branch = m[2].toUpperCase();
  
  const isPano = /pano/i.test(nameStr) || /pano/i.test(imgUrl);
  
  return { id: `${step}${branch}-${turn}`, step, branch, turn, image: imgUrl, isPanorama: isPano };
}

/**
 * Autonomously constructs a walkable 3D graph (nodes and directional edges) 
 * from a raw list of parsed nomenclature images.
 * 
 * @param {Array} inputList - Array of raw image items.
 * @returns {Object} An object containing `{ nodes, edges }` to be used by the navigation engine.
 */
export function buildGraphFromNomenclature(inputList) {
  const nodes = [], edges = [];
  const parsed = inputList.map(parseItem);

  // Group nodes by their Branch letter (e.g., A, B, C)
  const branchMap = {};
  parsed.forEach(n => (branchMap[n.branch] = branchMap[n.branch] || []).push(n));
  
  // Sort branches to ensure 'A' (main trunk) is processed first
  const branchKeys = Object.keys(branchMap).sort((a, b) => a === "A" ? -1 : b === "A" ? 1 : a.localeCompare(b));
  
  // Sort nodes within each branch sequentially by their step number
  branchKeys.forEach(k => branchMap[k].sort((a, b) => a.step - b.step));

  /* =========================================================================
     Compute spatial minimap layout (X,Y coordinates on a 0-100 scale)
     ========================================================================= */
  const mainBranch = branchMap["A"] || [];
  const coords = {};

  // Layout the main trunk (Branch A) vertically down the center
  mainBranch.forEach((item, idx) => {
    const y = mainBranch.length > 1 ? Math.round(82 - (idx / (mainBranch.length - 1)) * 64) : 50;
    const x = item.turn === "R" ? 68 : item.turn === "L" ? 32 : 50;
    coords[item.id] = { x, y };
  });

  // Layout alternative branches (Branch B, C, etc.) relative to where they split off from the main trunk
  branchKeys.filter(k => k !== "A").forEach(bk => {
    const list = branchMap[bk];
    const first = list[0];
    
    // Find the parent node on the main branch that precedes this new branch's starting step
    const parent = mainBranch.find(m => m.step === first.step - 1) || mainBranch[0] || { id: "root", step: 1 };
    const parentCoord = coords[parent.id] || { x: 50, y: 50 };
    
    // Determine the spatial direction the new branch should protrude
    const dir = first.turn === "L" ? -1 : first.turn === "R" ? 1 : first.turn === "F" ? 0 : ((bk.charCodeAt(0) - 65) % 2 === 1 ? -1 : 1);

    list.forEach((item, idx) => {
      const x = dir === 0 ? parentCoord.x : Math.max(12, Math.min(88, parentCoord.x + dir * (24 + idx * 8)));
      const y = Math.max(12, Math.min(88, parentCoord.y - (dir === 0 ? 18 : 12) - idx * 16));
      coords[item.id] = { x, y };
    });
  });

  // Assemble final nodes array with computed coordinates
  branchKeys.forEach(bk => {
    branchMap[bk].forEach(item => {
      const { x, y } = coords[item.id] || { x: 50, y: 50 };
      nodes.push({ id: item.id, number: item.step, branch: item.branch, turn: item.turn, image: item.image, mapX: x, mapY: y, isPanorama: item.isPanorama });
    });
  });

  /* =========================================================================
     Establish 3D Navigational Edges (Paths between nodes)
     ========================================================================= */
     
  // 1. Sequential connections within the same branch (e.g., 1A <-> 2A <-> 3A)
  branchKeys.forEach(bk => {
    const list = branchMap[bk];
    for (let i = 0; i < list.length - 1; i++) {
      const from = list[i], to = list[i + 1];
      const dir = to.turn === "R" ? "right" : to.turn === "L" ? "left" : "forward";
      
      edges.push({ from: from.id, to: to.id, direction: dir });
      edges.push({ from: to.id, to: from.id, direction: "backward" });
    }
  });

  // 2. Branch split connections (e.g., Main trunk 2A <-> Branch start 3B)
  branchKeys.filter(k => k !== "A").forEach(bk => {
    const list = branchMap[bk];
    const first = list[0];
    if (!first) return;
    
    // Find the node on the main branch where this sub-branch physically splits off
    const parent = mainBranch.find(m => m.step === first.step - 1) || mainBranch[mainBranch.length - 1];
    
    if (parent) {
      const dir = first.turn === "R" ? "right" : first.turn === "L" ? "left" : "forward";
      edges.push({ from: parent.id, to: first.id, direction: dir });
      edges.push({ from: first.id, to: parent.id, direction: "backward" });
    }
  });

  return { nodes, edges };
}

