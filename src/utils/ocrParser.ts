import { createWorker } from 'tesseract.js';

export const extractItemsFromImage = async (
  file: File, 
  onProgress?: (progress: number) => void
): Promise<string[]> => {
  const worker = await createWorker('fra', 1, {
    logger: m => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(m.progress);
      }
    }
  });

  try {
    const result = await worker.recognize(file);
    const data = result?.data;
    
    // Fallback to splitting text if lines property is missing
    const lines = (data as any)?.lines || (data?.text ? data.text.split('\n').map((t: string) => ({ text: t })) : []);
    
    const items: string[] = [];
    
    lines.forEach((line: any) => {
      const text = (line.text || "").trim();
      if (!text || text.length < 5) return;

      // Clean characters often misread at the start/end of OCR
      const cleanLine = text.replace(/^[|:;.\-\s]+|[|:;.\-\s]+$/g, '');

      // Pattern roughly targeting Grosafe layout: [Index] [Description] [Qty] [Price] [Tva] [Total]
      // Lenient regex for OCR noise:
      // - Starts with optional index
      // - Then the description
      // - Ends with at least 2 numeric values (Qté, Prix)
      const match = cleanLine.match(/^(?:\d+)?\s*(.+?)\s+(\d+[.,]\d{2,4})\s+(\d+[.,]\d{2,4})/);
      
      if (match && match[1]) {
        let desc = match[1].trim();
        // Remove common header noise if found in matching line
        if (!/^(TOTAL|HT|TTC|DATE|DEVIS|QUANT|PRIX)/i.test(desc)) {
          items.push(desc);
        }
      } else {
        // Fallback for lines that look like product names but missed the numbers
        // (OCR often fails on small table digits)
        const parts = cleanLine.split(/\s{2,}/); // Look for large gaps
        if (parts.length >= 1) {
          const descCandidate = parts[0].trim();
          if (descCandidate.length > 8 && 
              /^[A-Z]/.test(descCandidate) && 
              !/^(TOTAL|HT|TTC|DATE|DEVIS|PAGE|CLIENT)/i.test(descCandidate)) {
            items.push(descCandidate);
          }
        }
      }
    });

    // Final cleanup: remove duplicates and short noise
    return Array.from(new Set(items)).filter(it => it.length > 3);
  } finally {
    await worker.terminate();
  }
};
