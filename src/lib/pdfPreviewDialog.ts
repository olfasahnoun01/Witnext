/**
 * Overrides default translate-based centering on DialogContent so embedded PDFs
 * paint correctly (Chromium often shows a blank iframe when an ancestor uses CSS transform).
 */
export const pdfPreviewDialogContentClassName =
  "max-w-4xl w-[min(56rem,calc(100vw-2rem))] max-h-[90vh] flex flex-col overflow-hidden gap-4 left-4 right-4 top-8 mx-auto translate-x-0 translate-y-0 transform-none";
