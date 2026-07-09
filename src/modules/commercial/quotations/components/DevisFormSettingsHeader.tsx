import { FileText, ShoppingCart, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { clientTvaStatusLabel, type ClientTvaStatus } from '@/config/sectionThemes';
import type { Devis } from '@/types';
import {
  DevisDocumentSettingsBar,
  DevisDocumentSettingsGroup,
  DevisFlowBadge,
  DevisFodecToggle,
  DevisPricingToggle,
  DevisSegmentedGrid,
  DevisSegmentedOption,
  DevisZohoTopBar,
} from '@/components/devis/DevisFormUi';

type DevisFormSettingsHeaderProps = {
  editingDevis: Devis | null;
  forceDocType?: 'devis' | 'bc';
  lockDevisType?: boolean;
  docType: 'devis' | 'bc' | 'ba';
  setDocType: (t: 'devis' | 'bc' | 'ba') => void;
  devisType: 'achat' | 'vente';
  setDevisType: (t: 'achat' | 'vente') => void;
  isAchat: boolean;
  partyExonereDeTva: boolean;
  thirdPartyTvaStatus: ClientTvaStatus | null;
  isTtc: boolean;
  onPricingModeChange: (nextTtc: boolean) => void;
  isFodecEnabled: boolean;
  setIsFodecEnabled: (v: boolean) => void;
  draftSavedAt?: string | null;
};

export function DevisFormSettingsHeader({
  editingDevis,
  forceDocType,
  lockDevisType,
  docType,
  setDocType,
  devisType,
  setDevisType,
  isAchat,
  partyExonereDeTva,
  thirdPartyTvaStatus,
  isTtc,
  onPricingModeChange,
  isFodecEnabled,
  setIsFodecEnabled,
  draftSavedAt,
}: DevisFormSettingsHeaderProps) {
  return (
    <DevisZohoTopBar>
      <DevisDocumentSettingsBar>
        <div className="flex flex-wrap items-end gap-4 min-w-0">
          <DevisDocumentSettingsGroup label="Nature">
            {!editingDevis && !forceDocType ? (
              <DevisSegmentedGrid>
                <DevisSegmentedOption
                  value="devis"
                  current={docType}
                  onSelect={setDocType}
                  accent={isAchat ? 'achat' : 'vente'}
                  label="Devis"
                  icon={FileText}
                  className="min-h-[2.5rem] py-1.5"
                />
                <DevisSegmentedOption
                  value="bc"
                  current={docType}
                  onSelect={setDocType}
                  accent={isAchat ? 'achat' : 'vente'}
                  label="BC"
                  icon={ShoppingCart}
                  className="min-h-[2.5rem] py-1.5"
                />
              </DevisSegmentedGrid>
            ) : (
              <DevisFlowBadge devisType={devisType} docType={docType} />
            )}
          </DevisDocumentSettingsGroup>

          <DevisDocumentSettingsGroup label="Flux">
            {!forceDocType && !lockDevisType ? (
              <DevisSegmentedGrid>
                <DevisSegmentedOption
                  value="achat"
                  current={devisType}
                  onSelect={setDevisType}
                  accent="achat"
                  label="Achat"
                  icon={ArrowDownLeft}
                  className="min-h-[2.5rem] py-1.5"
                />
                <DevisSegmentedOption
                  value="vente"
                  current={devisType}
                  onSelect={setDevisType}
                  accent="vente"
                  label="Vente"
                  icon={ArrowUpRight}
                  className="min-h-[2.5rem] py-1.5"
                />
              </DevisSegmentedGrid>
            ) : (
              <DevisFlowBadge devisType={devisType} docType={docType} />
            )}
          </DevisDocumentSettingsGroup>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          {partyExonereDeTva ? (
            <div className="rounded-md border border-border/70 bg-background/80 px-3 py-2 text-xs text-muted-foreground max-w-xs">
              Prix <span className="font-medium text-foreground">HT</span>
              {thirdPartyTvaStatus ? (
                <> — {clientTvaStatusLabel(thirdPartyTvaStatus)}</>
              ) : null}
              . Aucune TVA sur ce document.
            </div>
          ) : (
            <DevisPricingToggle isTtc={isTtc} onChange={onPricingModeChange} compact />
          )}
          {isAchat && !partyExonereDeTva && (
            <DevisFodecToggle enabled={isFodecEnabled} onChange={setIsFodecEnabled} compact />
          )}
          {draftSavedAt && !editingDevis && (
            <p className="text-[11px] text-muted-foreground px-1 tabular-nums">
              Brouillon local ·{' '}
              {new Date(draftSavedAt).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
      </DevisDocumentSettingsBar>
    </DevisZohoTopBar>
  );
}
