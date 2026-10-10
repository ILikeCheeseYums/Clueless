import { parseItem, buildGraphFromNomenclature } from './src/utils/graph.js';
const map = new Map();
const urls = ['/Dummy_imgs/1A-F.jpeg'];
urls.forEach(url => {
  const parsed = parseItem(url);
  map.set(parsed.id, parsed);
});
const images = Array.from(map.values());
const graph = buildGraphFromNomenclature(images);
console.log("Graph Nodes:", graph.nodes);
