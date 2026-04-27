import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  CalendarDays,
  Building2,
  MapPin,
  Users,
  Printer,
  Plus,
  Trash2,
  FileDown,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Save,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Types ──────────────────────────────────────────────────────────────
interface EmployeeRow {
  id: string;
  name: string;
  shifts: Record<string, string>; // dateKey → shift code
}

type PeriodType = 'weekly' | 'monthly';

// Shift code → display / style
const SHIFT_MAP: Record<string, { label: string; bg: string; text: string }> = {
  R: { label: 'R', bg: 'bg-red-500/20', text: 'text-red-600 dark:text-red-400' },
  J: { label: 'J', bg: 'bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400' },
  N: { label: 'N', bg: 'bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400' },
  'J-P1': { label: 'J-P1', bg: 'bg-orange-500/20', text: 'text-orange-600 dark:text-orange-400' },
  'J-P2': { label: 'J-P2', bg: 'bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400' },
  'N-P1': { label: 'N-P1', bg: 'bg-indigo-500/20', text: 'text-indigo-600 dark:text-indigo-400' },
  'N-P2': { label: 'N-P2', bg: 'bg-pink-500/20', text: 'text-pink-600 dark:text-pink-400' },
};

const SHIFT_HOURS: Record<string, number> = { J: 8, N: 8, R: 0 };

// ── Helpers ────────────────────────────────────────────────────────────
function buildDateRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function formatDD_MM(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getWeekStart(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function getMonthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function getMonthEnd(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function getWeekEnd(start: Date): Date {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return end;
}

// Arabic day full names
const AR_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

// ── Component ──────────────────────────────────────────────────────────
export const Planning = () => {
  // Setup state
  const [companyName, setCompanyName] = useState('');
  const [siteName, setSiteName] = useState('');
  const [periodType, setPeriodType] = useState<PeriodType>('monthly');
  const [referenceDate, setReferenceDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });

  // Employees
  const [employeeCount, setEmployeeCount] = useState<number | ''>('');
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);

  // Generated state
  const [isGenerated, setIsGenerated] = useState(false);

  const tableRef = useRef<HTMLDivElement>(null);

  // Saved data from LocalStorage
  const [savedCompanies, setSavedCompanies] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('grosafe_companies') || '[]'); } catch { return []; }
  });
  const [savedSites, setSavedSites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('grosafe_sites') || '[]'); } catch { return []; }
  });

  const handleSaveCompany = useCallback(() => {
    const trimmed = companyName.trim();
    if (trimmed && !savedCompanies.includes(trimmed)) {
      const updated = [...savedCompanies, trimmed];
      setSavedCompanies(updated);
      localStorage.setItem('grosafe_companies', JSON.stringify(updated));
      toast.success('تم حفظ الشركة بنجاح');
    }
  }, [companyName, savedCompanies]);

  const handleSaveSite = useCallback(() => {
    const trimmed = siteName.trim();
    if (trimmed && !savedSites.includes(trimmed)) {
      const updated = [...savedSites, trimmed];
      setSavedSites(updated);
      localStorage.setItem('grosafe_sites', JSON.stringify(updated));
      toast.success('تم حفظ الموقع بنجاح');
    }
  }, [siteName, savedSites]);

  // JSON Export/Import
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportJSON = useCallback(() => {
    const data = {
      companyName,
      siteName,
      periodType,
      referenceDate,
      employeeCount,
      employees,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planning_${referenceDate}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('تم تصدير البيانات (JSON)');
  }, [companyName, siteName, periodType, referenceDate, employeeCount, employees]);

  const handleImportJSON = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.employees) {
          if (json.companyName) setCompanyName(json.companyName);
          if (json.siteName) setSiteName(json.siteName);
          if (json.periodType) setPeriodType(json.periodType);
          if (json.referenceDate) setReferenceDate(json.referenceDate);
          if (json.employeeCount) setEmployeeCount(json.employeeCount);
          setEmployees(json.employees);
          setIsGenerated(true);
          toast.success('تم استيراد البيانات بنجاح');
        }
      } catch (err) {
        toast.error('ملف غير صالح');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // Compute date range
  const { startDate, endDate, dates } = useMemo(() => {
    const ref = new Date(referenceDate + 'T00:00:00');
    let s: Date, e: Date;
    if (periodType === 'weekly') {
      s = getWeekStart(ref);
      e = getWeekEnd(s);
    } else {
      s = getMonthStart(ref);
      e = getMonthEnd(ref);
    }
    return { startDate: s, endDate: e, dates: buildDateRange(s, e) };
  }, [referenceDate, periodType]);

  // Navigate period
  const navigatePeriod = useCallback(
    (dir: -1 | 1) => {
      const ref = new Date(referenceDate + 'T00:00:00');
      if (periodType === 'weekly') {
        ref.setDate(ref.getDate() + dir * 7);
      } else {
        ref.setMonth(ref.getMonth() + dir);
      }
      setReferenceDate(
        `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}-${String(ref.getDate()).padStart(2, '0')}`
      );
    },
    [referenceDate, periodType]
  );

  const updateEmployeeName = useCallback((id: string, name: string) => {
    setEmployees((prev) => prev.map((e) => e.id === id ? { ...e, name } : e));
  }, []);

  // Handle shift cell input
  const handleShiftInput = useCallback(
    (empId: string, dk: string, value: string) => {
      const upper = value.toUpperCase().slice(-1); // take last char
      let finalValue = upper;
      
      // Shortcuts
      if (upper === 'A') finalValue = 'J-P1';
      else if (upper === 'Z') finalValue = 'J-P2';
      else if (upper === 'O') finalValue = 'N-P1';
      else if (upper === 'P') finalValue = 'N-P2';

      if (finalValue && !SHIFT_MAP[finalValue]) return;
      
      setEmployees((prev) =>
        prev.map((emp) =>
          emp.id === empId
            ? { ...emp, shifts: { ...emp.shifts, [dk]: finalValue } }
            : emp
        )
      );
    },
    []
  );

  // Handle keyboard navigation
  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, empIdx: number, dateIdx: number) => {
      let nextEmp = empIdx;
      let nextDate = dateIdx;

      if (e.key === 'ArrowRight') { nextDate = dateIdx - 1; e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { nextDate = dateIdx + 1; e.preventDefault(); }
      else if (e.key === 'ArrowDown') { nextEmp = empIdx + 1; e.preventDefault(); }
      else if (e.key === 'ArrowUp') { nextEmp = empIdx - 1; e.preventDefault(); }
      else if (e.key === 'Tab') {
        // Let default tab behaviour work
        return;
      } else return;

      const cellId = `cell-${nextEmp}-${nextDate}`;
      const nextEl = document.getElementById(cellId) as HTMLInputElement | null;
      nextEl?.focus();
      nextEl?.select();
    },
    []
  );

  // Summary calculations per employee
  const summaries = useMemo(() => {
    return employees.map((emp) => {
      let totalJ = 0, totalN = 0, totalR = 0;
      let totalJP1 = 0, totalJP2 = 0, totalNP1 = 0, totalNP2 = 0;

      dates.forEach((d) => {
        const code = emp.shifts[dateKey(d)] || '';
        if (code === 'J') totalJ++;
        else if (code === 'N') totalN++;
        else if (code === 'R') totalR++;
        else if (code === 'J-P1') totalJP1++;
        else if (code === 'J-P2') totalJP2++;
        else if (code === 'N-P1') totalNP1++;
        else if (code === 'N-P2') totalNP2++;
      });

      const totalWorkDays = totalJ + totalN + totalJP1 + totalJP2 + totalNP1 + totalNP2;
      
      // Salary Formula: 
      // If work days >= 15 -> 250.000 DT
      // Else -> (250.000 / 22) * work days
      let salary = 0;
      if (totalWorkDays >= 15) {
        salary = 250.000;
      } else {
        salary = (250.000 / 22) * totalWorkDays;
      }

      return { 
        totalJ, totalN, totalR, totalJP1, totalJP2, totalNP1, totalNP2, 
        totalWorkDays, salary 
      };
    });
  }, [employees, dates]);

  // Generate table
  const handleGenerate = useCallback(() => {
    if (!employeeCount || employeeCount <= 0) {
      toast.error('الرجاء إدخال عدد الموظفين');
      return;
    }
    
    // If not already generated, or if count changed, we regenerate or adjust
    setEmployees((prev) => {
      const count = Number(employeeCount);
      if (prev.length === count) return prev;
      
      const newArr = [...prev];
      if (newArr.length > count) {
        newArr.length = count; // truncate
      } else {
        const toAdd = count - newArr.length;
        for (let i = 0; i < toAdd; i++) {
          newArr.push({ id: crypto.randomUUID(), name: '', shifts: {} });
        }
      }
      return newArr;
    });

    setIsGenerated(true);
    toast.success('تم إنشاء جدول التخطيط بنجاح');
  }, [employeeCount]);

  // Reset
  const handleReset = useCallback(() => {
    setIsGenerated(false);
    setEmployees([]);
    setCompanyName('');
    setSiteName('');
    setEmployeeCount('');
    toast.success('تم إعادة تعيين الجدول');
  }, []);

  // PDF Export
  const exportPDF = useCallback(() => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    const addHeader = (title: string) => {
      // Center
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(companyName || 'Entreprise', pageWidth / 2, 15, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(title, pageWidth / 2, 22, { align: 'center' });
      
      // RTL Layout for Headers
      doc.setFontSize(10);
      
      // Right side (Site)
      const rightTextX = pageWidth - 14;
      doc.text(`Site : ${siteName || '-'}`, rightTextX, 22, { align: 'right' });
      
      // Left side (Period and Date)
      doc.text(`Période : ${formatDD_MM(startDate)} - ${formatDD_MM(endDate)}`, 14, 15, { align: 'left' });
      doc.text(`Date d'exportation : ${new Date().toLocaleString('fr-FR')}`, 14, 22, { align: 'left' });
    };

    // --- Page 1: Schedule ---
    addHeader('Planning / Calendrier');

    const dateHeaders = dates.map((d) => formatDD_MM(d));
    // RTL: Reverse the columns
    const scheduleHead = [['#', 'Employé(e)', ...dateHeaders].reverse()];

    const scheduleBody = employees.map((emp, i) => {
      return [
        String(i + 1),
        emp.name || `Employé(e) ${i + 1}`,
        ...dates.map((d) => emp.shifts[dateKey(d)] || ''),
      ].reverse();
    });

    const empColIndex = dates.length; // because length is dates + 2, and 'Employé' is at index length - 2

    autoTable(doc, {
      head: scheduleHead,
      body: scheduleBody,
      startY: 30,
      styles: { fontSize: 7, cellPadding: 1.5, halign: 'center' },
      headStyles: { fillColor: [30, 58, 95], fontSize: 6 },
      columnStyles: { [empColIndex]: { halign: 'right' } }, // Right align employee names for RTL
      didParseCell(data) {
        const isShiftColumn = data.column.index < dates.length;
        if (data.section === 'body' && isShiftColumn) {
          const val = String(data.cell.raw);
          if (val === 'R') { data.cell.styles.fillColor = [254, 202, 202]; data.cell.styles.textColor = [185, 28, 28]; }
          else if (val === 'J') { data.cell.styles.fillColor = [187, 247, 208]; data.cell.styles.textColor = [21, 128, 61]; }
          else if (val === 'N') { data.cell.styles.fillColor = [191, 219, 254]; data.cell.styles.textColor = [29, 78, 216]; }
          else if (val === 'J-P1') { data.cell.styles.fillColor = [255, 237, 213]; data.cell.styles.textColor = [194, 65, 12]; }
          else if (val === 'J-P2') { data.cell.styles.fillColor = [243, 232, 255]; data.cell.styles.textColor = [126, 34, 206]; }
          else if (val === 'N-P1') { data.cell.styles.fillColor = [224, 231, 255]; data.cell.styles.textColor = [67, 56, 202]; }
          else if (val === 'N-P2') { data.cell.styles.fillColor = [252, 231, 243]; data.cell.styles.textColor = [190, 24, 93]; }
        }
      },
    });

    // --- Page 2: Summary ---
    doc.addPage();
    addHeader('Résumé / Récapitulatif');

    // RTL: Reverse the columns
    const summaryHead = [['#', 'Employé(e)', 'J', 'N', 'J-P1', 'J-P2', 'N-P1', 'N-P2', 'R', 'Total Travail'].reverse()];
    const summaryBody = employees.map((emp, i) => {
      const s = summaries[i];
      return [
        String(i + 1),
        emp.name || `Employé(e) ${i + 1}`,
        String(s.totalJ),
        String(s.totalN),
        String(s.totalJP1),
        String(s.totalJP2),
        String(s.totalNP1),
        String(s.totalNP2),
        String(s.totalR),
        `${s.totalWorkDays} j`,
      ].reverse();
    });

    autoTable(doc, {
      head: summaryHead,
      body: summaryBody,
      startY: 30,
      styles: { fontSize: 8, cellPadding: 2, halign: 'center' },
      headStyles: { fillColor: [30, 58, 95], fontSize: 7 },
      columnStyles: { 8: { halign: 'right' } }, // Employee name index
    });

    // --- Page 3: Salaries ---
    doc.addPage();
    addHeader('Estimation Salaires');

    const salaryHead = [['#', 'Employé(e)', 'Jours de travail', 'Salaire (DT)'].reverse()];
    const salaryBody = employees.map((emp, i) => {
      const s = summaries[i];
      return [
        String(i + 1),
        emp.name || `Employé(e) ${i + 1}`,
        String(s.totalWorkDays),
        `${s.salary.toFixed(3)} DT`,
      ].reverse();
    });

    autoTable(doc, {
      head: salaryHead,
      body: salaryBody,
      startY: 30,
      styles: { fontSize: 9, cellPadding: 3, halign: 'center' },
      headStyles: { fillColor: [21, 128, 61], fontSize: 8 },
      columnStyles: { 2: { halign: 'right' } },
    });

    doc.save(`planning_${formatDD_MM(startDate)}_${formatDD_MM(endDate)}.pdf`);
    toast.success('تم تصدير ملف PDF بنجاح');
  }, [companyName, siteName, startDate, endDate, dates, employees, summaries]);

  // Period label for display
  const periodLabel = useMemo(() => {
    const months = [
      'جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان',
      'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
    ];
    if (periodType === 'monthly') {
      return `${months[startDate.getMonth()]} ${startDate.getFullYear()}`;
    }
    return `${formatDD_MM(startDate)} → ${formatDD_MM(endDate)}`;
  }, [periodType, startDate, endDate]);

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in" dir="rtl" style={{ fontFamily: "'Inter', 'Noto Sans Arabic', system-ui, sans-serif" }}>
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <CalendarDays className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">التخطيط</h2>
            <p className="text-sm text-muted-foreground">
              جدول مناوبات الموظفين
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            accept=".json"
            ref={fileInputRef}
            onChange={handleImportJSON}
            className="hidden"
          />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2 rounded-xl">
            <Upload className="w-4 h-4" />
            استيراد
          </Button>
          {isGenerated && (
            <>
              <Button variant="outline" size="sm" onClick={exportJSON} className="gap-2 rounded-xl">
                <FileDown className="w-4 h-4" />
                تصدير JSON
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset} className="gap-2 rounded-xl">
                <RotateCcw className="w-4 h-4" />
                إعادة تعيين
              </Button>
              <Button size="sm" onClick={exportPDF} className="gap-2 rounded-xl">
                <FileDown className="w-4 h-4" />
                تصدير PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Setup Form ─────────────────────────────────── */}
      <div className="p-5 rounded-2xl bg-card border border-border shadow-sm space-y-5">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" />
          معلومات الشركة والفترة
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Company */}
          <div className="space-y-1.5">
            <Label className="text-sm">اسم الشركة</Label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  list="saved-companies"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="مثال: شركة الأمان"
                  className="pr-9"
                  dir="rtl"
                />
                <datalist id="saved-companies">
                  {savedCompanies.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              {companyName && !savedCompanies.includes(companyName.trim()) && (
                <Button variant="outline" size="icon" onClick={handleSaveCompany} title="حفظ الشركة">
                  <Save className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Site */}
          <div className="space-y-1.5">
            <Label className="text-sm">الموقع</Label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  list="saved-sites"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="مثال: المقر الرئيسي"
                  className="pr-9"
                  dir="rtl"
                />
                <datalist id="saved-sites">
                  {savedSites.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>
              {siteName && !savedSites.includes(siteName.trim()) && (
                <Button variant="outline" size="icon" onClick={handleSaveSite} title="حفظ الموقع">
                  <Save className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Period Type */}
          <div className="space-y-1.5">
            <Label className="text-sm">نوع الفترة</Label>
            <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">أسبوعي</SelectItem>
                <SelectItem value="monthly">شهري</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label className="text-sm">تاريخ مرجعي</Label>
            <Input
              type="date"
              value={referenceDate}
              onChange={(e) => setReferenceDate(e.target.value)}
              dir="ltr"
            />
          </div>

          {/* Employee Count */}
          <div className="space-y-1.5">
            <Label className="text-sm">عدد الموظفين</Label>
            <Input
              type="number"
              min="1"
              value={employeeCount}
              onChange={(e) => setEmployeeCount(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="مثال: 10"
              dir="ltr"
            />
          </div>
        </div>

        {/* Period Navigation */}
        <div className="flex items-center justify-center gap-4 py-2">
          <Button variant="ghost" size="icon" onClick={() => navigatePeriod(1)} className="rounded-full">
            <ChevronRight className="w-5 h-5" />
          </Button>
          <span className="text-sm font-semibold text-foreground min-w-[160px] text-center">
            {periodLabel}
          </span>
          <Button variant="ghost" size="icon" onClick={() => navigatePeriod(-1)} className="rounded-full">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* ── Action Section ───────────────────────────── */}
      {!isGenerated && (
        <div className="flex justify-center pt-2">
          <Button onClick={handleGenerate} className="gap-2 rounded-xl px-8" size="lg">
            <CalendarDays className="w-5 h-5" />
            إنشاء الجدول
          </Button>
        </div>
      )}

      {/* ── Legend ──────────────────────────────────────── */}
      {isGenerated && (
        <div className="flex items-center justify-center gap-6 flex-wrap text-sm">
          <span className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-xs">J</span>
            نهاري
          </span>
          <span className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center text-xs">ليلي</span>
            ليلي
          </span>
          <span className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-red-500/20 text-red-600 dark:text-red-400 font-bold flex items-center justify-center text-xs">R</span>
            راحة
          </span>
          <span className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-600 dark:text-orange-400 font-bold flex items-center justify-center text-[10px]">J-P1</span>
            J-P1 (A)
          </span>
          <span className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-600 dark:text-purple-400 font-bold flex items-center justify-center text-[10px]">J-P2</span>
            J-P2 (Z)
          </span>
          <span className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center text-[10px]">N-P1</span>
            N-P1 (O)
          </span>
          <span className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-pink-500/20 text-pink-600 dark:text-pink-400 font-bold flex items-center justify-center text-[10px]">N-P2</span>
            N-P2 (P)
          </span>
        </div>
      )}

      {/* ── Scheduling Table ───────────────────────────── */}
      {isGenerated && (
        <div ref={tableRef} className="rounded-2xl border border-border bg-card shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-muted/60">
                  <th className="sticky right-0 z-20 bg-muted/90 backdrop-blur-sm px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground border-b border-l border-border min-w-[140px]">
                    الموظف
                  </th>
                  {dates.map((d) => {
                    const isFriday = d.getDay() === 5;
                    return (
                      <th
                        key={dateKey(d)}
                        className={`px-1 py-2 text-center text-[10px] font-medium border-b border-l border-border min-w-[44px] ${
                          isFriday ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'text-muted-foreground'
                        }`}
                      >
                        <div>{AR_DAYS[d.getDay()]}</div>
                        <div className="font-semibold text-xs mt-0.5">{formatDD_MM(d)}</div>
                      </th>
                    );
                  })}
                  {/* Summary headers removed from main table */}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, empIdx) => {
                  const s = summaries[empIdx];
                  return (
                    <tr
                      key={emp.id}
                      className="group hover:bg-muted/20 transition-colors"
                    >
                      {/* Employee name - sticky */}
                      <td className="sticky right-0 z-10 bg-card group-hover:bg-muted/30 backdrop-blur-sm px-3 py-1.5 border-b border-l border-border">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground text-[10px] font-bold shrink-0">
                            {emp.name ? emp.name.charAt(0) : (empIdx + 1)}
                          </span>
                          <input
                            type="text"
                            value={emp.name}
                            onChange={(e) => updateEmployeeName(emp.id, e.target.value)}
                            placeholder="اسم الموظف"
                            className="bg-transparent border-0 outline-none w-full text-sm font-medium text-foreground focus:ring-0 p-0"
                          />
                        </div>
                      </td>

                      {/* Date cells */}
                      {dates.map((d, dateIdx) => {
                        const dk = dateKey(d);
                        const code = emp.shifts[dk] || '';
                        const style = code ? SHIFT_MAP[code] : null;
                        const isFriday = d.getDay() === 5;
                        return (
                          <td
                            key={dk}
                            className={`px-0.5 py-0.5 border-b border-l border-border text-center ${
                              isFriday ? 'bg-amber-500/5' : ''
                            }`}
                          >
                            <input
                              id={`cell-${empIdx}-${dateIdx}`}
                              type="text"
                              value={code}
                              onChange={(e) => handleShiftInput(emp.id, dk, e.target.value)}
                              onKeyDown={(e) => handleCellKeyDown(e, empIdx, dateIdx)}
                              maxLength={4}
                              className={`w-9 h-8 text-center text-xs font-bold rounded-md border-0 outline-none focus:ring-2 focus:ring-primary/50 transition-all ${
                                style
                                  ? `${style.bg} ${style.text}`
                                  : 'bg-transparent text-muted-foreground hover:bg-muted/30'
                              }`}
                              dir="ltr"
                            />
                          </td>
                        );
                      })}

                      {/* Summary cells removed from main table */}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table footer info */}
          <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-t border-border text-xs text-muted-foreground">
            <span>
              {companyName && `${companyName}`}
              {siteName && ` • ${siteName}`}
            </span>
            <span>
              {periodLabel} • {employees.length} موظف
            </span>
          </div>
        </div>
      )}

      {/* ── Summary Table ──────────────────────────────── */}
      {isGenerated && (
        <div className="rounded-2xl border border-border bg-card shadow-md overflow-hidden mt-6">
          <div className="p-4 border-b border-border bg-muted/30">
            <h3 className="text-base font-semibold text-foreground">ملخص المناوبات</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/60">
                  <th className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground border-b border-l border-border min-w-[200px]">
                    الموظف
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold border-b border-l border-border bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                    J
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold border-b border-l border-border bg-blue-500/10 text-blue-700 dark:text-blue-400">
                    N
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold border-b border-l border-border bg-orange-500/10 text-orange-700 dark:text-orange-400">
                    J-P1
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold border-b border-l border-border bg-purple-500/10 text-purple-700 dark:text-purple-400">
                    J-P2
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold border-b border-l border-border bg-indigo-500/10 text-indigo-700 dark:text-indigo-400">
                    N-P1
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold border-b border-l border-border bg-pink-500/10 text-pink-700 dark:text-pink-400">
                    N-P2
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold border-b border-l border-border bg-red-500/10 text-red-700 dark:text-red-400">
                    R
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold border-b border-border bg-primary/10 text-primary">
                    Total Travail (Jours)
                  </th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, empIdx) => {
                  const s = summaries[empIdx];
                  return (
                    <tr key={emp.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2 text-sm font-medium text-foreground border-b border-l border-border">
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
                            {emp.name ? emp.name.charAt(0) : (empIdx + 1)}
                          </span>
                          <span>{emp.name || `موظف ${empIdx + 1}`}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center text-sm font-bold border-b border-l border-border bg-emerald-500/5 text-emerald-600 dark:text-emerald-400">
                        {s.totalJ}
                      </td>
                      <td className="px-3 py-2 text-center text-sm font-bold border-b border-l border-border bg-blue-500/5 text-blue-600 dark:text-blue-400">
                        {s.totalN}
                      </td>
                      <td className="px-3 py-2 text-center text-sm font-bold border-b border-l border-border bg-orange-500/5 text-orange-600 dark:text-orange-400">
                        {s.totalJP1}
                      </td>
                      <td className="px-3 py-2 text-center text-sm font-bold border-b border-l border-border bg-purple-500/5 text-purple-600 dark:text-purple-400">
                        {s.totalJP2}
                      </td>
                      <td className="px-3 py-2 text-center text-sm font-bold border-b border-l border-border bg-indigo-500/5 text-indigo-600 dark:text-indigo-400">
                        {s.totalNP1}
                      </td>
                      <td className="px-3 py-2 text-center text-sm font-bold border-b border-l border-border bg-pink-500/5 text-pink-600 dark:text-pink-400">
                        {s.totalNP2}
                      </td>
                      <td className="px-3 py-2 text-center text-sm font-bold border-b border-l border-border bg-red-500/5 text-red-600 dark:text-red-400">
                        {s.totalR}
                      </td>
                      <td className="px-3 py-2 text-center text-sm font-bold border-b border-border bg-primary/5 text-primary">
                        {s.totalWorkDays} j
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Salary Table ────────────────────────────────── */}
      {isGenerated && (
        <div className="rounded-2xl border border-border bg-card shadow-md overflow-hidden mt-6">
          <div className="p-4 border-b border-border bg-muted/30">
            <h3 className="text-base font-semibold text-foreground">جدول الرواتب (Estimation Salaires)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/60">
                  <th className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground border-b border-l border-border min-w-[200px]">
                    الموظف
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold border-b border-l border-border">
                    أيام العمل الإجمالية
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold border-b border-border bg-emerald-500/10 text-emerald-700">
                    الراتب (DT)
                  </th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, empIdx) => {
                  const s = summaries[empIdx];
                  return (
                    <tr key={emp.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2 text-sm font-medium text-foreground border-b border-l border-border">
                        {emp.name || `موظف ${empIdx + 1}`}
                      </td>
                      <td className="px-3 py-2 text-center text-sm font-bold border-b border-l border-border">
                        {s.totalWorkDays}
                      </td>
                      <td className="px-3 py-2 text-center text-sm font-bold border-b border-border text-emerald-600">
                        {s.salary.toFixed(3)} DT
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
