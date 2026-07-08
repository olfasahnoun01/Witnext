import { useEffect } from 'react';

export function useMarketingPageTitle(title: string, description?: string) {
  useEffect(() => {
    const fullTitle = title.includes('Witnext') ? title : `${title} | Witnext`;
    document.title = fullTitle;

    if (description) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', description);
    }
  }, [title, description]);
}
