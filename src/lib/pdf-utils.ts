import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore - Vite handles ?url suffix
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export const extractTextFromPdf = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  
  // Basic check for PDF header (%PDF-)
  const header = new Uint8Array(arrayBuffer.slice(0, 5));
  const headerString = String.fromCharCode(...header);
  if (headerString !== '%PDF-') {
    throw new Error('Таңдалған файл дұрыс PDF құжаты емес (файл басы қате).');
  }

  try {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }

    return fullText;
  } catch (error: any) {
    console.error("PDF extraction error:", error);
    if (error.message?.includes('Invalid PDF structure')) {
      throw new Error('PDF құжатының құрылымы қате немесе файл зақымдалған.');
    }
    throw error;
  }
};
