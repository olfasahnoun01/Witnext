import { Users } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HrEmployeesList } from './HrEmployeesList';
import { HrLeavesPanel } from './HrLeavesPanel';
import { HrPayrollPanel } from './HrPayrollPanel';

export const HrEmployeesHub = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-violet-500/10">
          <Users className="w-6 h-6 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Employées</h2>
          <p className="text-sm text-muted-foreground">
            Registre du personnel, congés et suivi des salaires (sans compte de connexion).
          </p>
        </div>
      </div>

      <Tabs defaultValue="employees" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-3 h-11">
          <TabsTrigger value="employees">Employées</TabsTrigger>
          <TabsTrigger value="conges">Congés</TabsTrigger>
          <TabsTrigger value="payroll">Salaire et avances</TabsTrigger>
        </TabsList>
        <TabsContent value="employees" className="mt-4">
          <HrEmployeesList />
        </TabsContent>
        <TabsContent value="conges" className="mt-4">
          <HrLeavesPanel />
        </TabsContent>
        <TabsContent value="payroll" className="mt-4">
          <HrPayrollPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};
