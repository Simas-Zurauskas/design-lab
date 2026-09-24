// LAB CHROME — icons: the Lucide runtime. Ships the FULL icon set, so any
// <i data-lucide="name" class="h-4 w-4"></i> in a design just works — no system edit to use a new
// icon. Icons render as inline SVGs with stroke: currentColor (they inherit text color).
// Loaded by screen/chrome.html (screens) and canvas/canvas.html (boards on section pages).
// The one ES module in the lab (it imports lucide), so it doesn't run from file://.
import { createIcons, icons } from 'lucide';
createIcons({ icons });
