import { useState } from 'react';
import { UnifiedDocumentList } from '../devis/UnifiedDocumentList';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { DocumentCreationDialog } from './DocumentCreationDialog';
import { UnifiedDocumentType } from '@/types';

interface WarehouseDocumentManagerProps {
  type: UnifiedDocumentType;
  title: string;
  description: string;
}

export const WarehouseDocumentManager = ({
  type,
  title,
  description
}: WarehouseDocumentManagerProps) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Nouveau Document
        </Button>
      </div>

      <UnifiedDocumentList 
        key={refreshKey}
        title={title}
        description={description}
        documentTypes={[type]}
      />

      <DocumentCreationDialog 
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        type={type}
        onSuccess={handleSuccess}
      />
    </div>
  );
};
