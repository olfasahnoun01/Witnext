import { createWorker } from 'tesseract.js';
import {
  parseDevisLinesFromPlainLines,
  parseDevisHeaderFromText,
  type ParsedDevisDocument,
} from './pdfParser';

export async function extractDevisDocumentFromImage(
  file: File,
  onProgress?: (progress: number) => void
): Promise<ParsedDevisDocument> {
  const worker = await createWorker('fra', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(m.progress);
      }
    },
  });

  try {
    const result = await worker.recognize(file);
    const data = result?.data;
    const lines =
      (data as { lines?: { text: string }[] })?.lines ||
      (data?.text ? data.text.split('\n').map((t: string) => ({ text: t })) : []);

    const lineTexts = lines
      .map((line) => (line.text || '').trim())
      .map((text) => text.replace(/^[|:;.\-\s]+|[|:;.\-\s]+$/g, ''))
      .filter((text) => text.length >= 5);

    const fullText = data?.text ?? lineTexts.join('\n');
    return {
      lines: parseDevisLinesFromPlainLines(lineTexts),
      header: parseDevisHeaderFromText(fullText),
      fullText,
    };
  } finally {
    await worker.terminate();
  }
}

export const extractItemsFromImage = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<string[]> => {
  const doc = await extractDevisDocumentFromImage(file, onProgress);
  return doc.lines.map((l) => l.designation);
};
