import { describe, it, expect } from 'vitest';
import {
  applyPartyTvaPolicyToItems,
  defaultDevisLineTvaForParty,
  defaultDevisPricingModeIsTtc,
  isPartyExonereDeTva,
} from '../devisTvaPolicy';
import type { DevisItem } from '@/types';

function line(partial: Partial<DevisItem>): DevisItem {
  return {
    designation: 'Article',
    fournisseur: 'F',
    prix_ttc: 100,
    remise: 0,
    quantity: 1,
    ...partial,
  };
}

describe('devisTvaPolicy', () => {
  it('detects exonere status', () => {
    expect(isPartyExonereDeTva('exonere')).toBe(true);
    expect(isPartyExonereDeTva('assujetti')).toBe(false);
  });

  it('defaults line TVA to 0 for exonere and 19 for assujetti', () => {
    expect(defaultDevisLineTvaForParty('exonere')).toBe(0);
    expect(defaultDevisLineTvaForParty('assujetti')).toBe(19);
  });

  it('forces all lines to 0% for exonere party', () => {
    const items = [line({ tva: 19 }), line({ tva: 7 })];
    const next = applyPartyTvaPolicyToItems(items, 'exonere');
    expect(next.every((i) => i.tva === 0)).toBe(true);
  });

  it('defaults pricing mode to HT for exonere and TTC for assujetti', () => {
    expect(defaultDevisPricingModeIsTtc('exonere')).toBe(false);
    expect(defaultDevisPricingModeIsTtc('assujetti')).toBe(true);
  });

  it('sets 19% on assujetti lines without TVA, keeps explicit rates', () => {
    const items = [line({ tva: 0 }), line({ tva: 7 }), line({ tva: 19 })];
    const next = applyPartyTvaPolicyToItems(items, 'assujetti');
    expect(next[0].tva).toBe(19);
    expect(next[1].tva).toBe(7);
    expect(next[2].tva).toBe(19);
  });
});
