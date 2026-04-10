import * as pdfjsLib from 'pdfjs-dist';

// Configurer le worker PDF.js (utilisation du CDN unpkg)
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export const extractDevisItemsFromPdf = async (file: File): Promise<string[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let items: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const itemsText = parseDevisPageText(textContent.items as any[]);
    items = items.concat(itemsText);
  }

  return items;
};

const parseDevisPageText = (textItems: { str: string, transform: number[] }[]): string[] => {
  const extracted: string[] = [];
  
  // Convert into lines based on Y coordinate bounding.
  // Transform array: [scaleX, skewY, skewX, scaleY, translateX, translateY]
  const yMap = new Map<number, { text: string, x: number }[]>();

  textItems.forEach(t => {
    // The text content might be split. t.str contains the actual string.
    const text = t.str.trim();
    if (!text) return;

    let y = t.transform[5];
    let x = t.transform[4];
    
    // Group roughly by Y
    let foundY = Array.from(yMap.keys()).find(key => Math.abs(key - y) <= 4);
    if(foundY) y = foundY;

    if (!yMap.has(y)) yMap.set(y, []);
    yMap.get(y)!.push({ text: t.str, x }); // keep original string spacing
  });

  const sortedY = Array.from(yMap.keys()).sort((a, b) => b - a);

  let possibleContinuation = "";

  sortedY.forEach(y => {
    // Sort by X to reconstruct the line accurately left-to-right
    const lineParts = yMap.get(y)!.sort((a, b) => a.x - b.x);
    const lineText = lineParts.map(p => p.text).join(' ').replace(/\s+/g, ' ').trim();
    
    // Une ligne d'article type 'Grosafe' ressemble à ça :
    // "1 PAIRE DE GANT NEOPRENE LATEX NOIR DENVER DV02HH 1.00 7.800 19.00 7.800"
    // /^(\d+)\s+(.+?)\s+(?:\d+(?:\.\d+)?\s*){3,}$/u
    // Ex: "2   LUNETTE DE SECURITE CLIMAX   1.00   11.300   19.00   11.300"
    
    // Pattern: Numéro d'index au début \b\d+\b
    // Suivi de la description (.+?)
    // Suivi de chiffres à décimales (au moins 3 pour quantité, prix, tva) \b\d+\.\d+\b
    const match = lineText.match(/^(\d+)\s+(.+?)\s+(\d+(?:\.\d{2,4})?)\s+(\d+(?:\.\d{2,4})?)\s+(\d+(?:\.\d{2,4})?)/);
    
    if (match && match[2]) {
      let desc = match[2].trim();
      extracted.push(desc);
    } else {
      // Heuristic 2: Alternative layout match (e.g. without indexing)
      const altMatch = lineText.match(/^([A-Za-z].+?)\s+(\d+(?:\.\d{2,4})?)\s+(\d+(?:\.\d{2,4})?)\s+(\d+(?:\.\d{2,4})?)/);
      if (altMatch && altMatch[1]) {
          extracted.push(altMatch[1].trim());
      }
    }
  });

  return extracted;
};
