import planningPrintCss from './planningPrint.css?inline';

export type PlanningPrintSection = 'schedule' | 'summary' | 'salary';

/** Print a planning section in an isolated iframe (no Witnext browser header/footer). */
export function printPlanningSection(section: PlanningPrintSection): void {
  const el = document.querySelector(`.planning-section[data-section="${section}"]`);
  if (!el) return;

  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.no-print').forEach((node) => node.remove());

  const header = clone.querySelector('.planning-document-header');
  if (header) {
    header.classList.add('planning-document-header--active');
    header.removeAttribute('aria-hidden');
  }

  const iframe = document.createElement('iframe');
  iframe.setAttribute(
    'style',
    'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  );
  document.body.appendChild(iframe);

  const frameWin = iframe.contentWindow;
  const frameDoc = iframe.contentDocument;
  if (!frameWin || !frameDoc) {
    iframe.remove();
    return;
  }

  const isSalary = section === 'salary';
  const bodyClass = isSalary ? 'planning-print-body planning-print-body--salary' : 'planning-print-body';
  const htmlAttrs = isSalary ? 'lang="ar" dir="rtl"' : 'lang="fr" dir="ltr"';

  frameDoc.open();
  frameDoc.write(
    `<!DOCTYPE html><html ${htmlAttrs}><head><meta charset="utf-8"><title></title>` +
      `<style>${planningPrintCss}</style></head>` +
      `<body class="${bodyClass}">${clone.outerHTML}</body></html>`
  );
  frameDoc.close();

  const cleanup = () => {
    iframe.remove();
  };

  frameWin.addEventListener('afterprint', cleanup, { once: true });

  window.setTimeout(() => {
    frameWin.focus();
    frameWin.print();
    window.setTimeout(cleanup, 10_000);
  }, 120);
}
