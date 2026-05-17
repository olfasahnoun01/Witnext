/** Installation phases shown in the custom UI */
const STAGES = [
  { id: 'preparing', label: 'Preparing files', weight: 8 },
  { id: 'extracting', label: 'Extracting packages', weight: 62 },
  { id: 'components', label: 'Installing components', weight: 20 },
  { id: 'finalizing', label: 'Finalizing installation', weight: 10 },
];

function getStageLabel(stageId) {
  return STAGES.find((s) => s.id === stageId)?.label ?? 'Working…';
}

module.exports = { STAGES, getStageLabel };
