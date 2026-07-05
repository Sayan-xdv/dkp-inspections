'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { SkeletonTableRows } from '@/components/shared/skeleton-table';
import { parseExcelFile } from '@/lib/excel/parser';
import type { ParseResult } from '@/lib/excel/column-mapping';

export default function UploadPage() {
  const [dragOver, setDragOver] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number; duplicates: number; skipped: number; errors: Array<{ row: number; error: string }>;
  } | null>(null);
  const [fileName, setFileName] = useState('');

  const handleFile = useCallback((file: File) => {
    if (!file.name.match(/\.xlsx?$/i)) {
      toast.error('Поддерживаются только файлы .xlsx и .xls');
      return;
    }
    setFileName(file.name);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = parseExcelFile(e.target!.result as ArrayBuffer);
        setParseResult(result);
        toast.success(`Файл обработан: ${result.filtered.length} квартир для импорта`);
      } catch (err) {
        toast.error('Ошибка при чтении файла: ' + String(err));
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleImport = async () => {
    if (!parseResult) return;
    setImporting(true);
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parseResult.filtered, filename: fileName }),
      });
      const data = await res.json();
      setImportResult(data);
      if (data.imported > 0) {
        toast.success(`Импортировано ${data.imported} квартир`);
      }
      if (data.duplicates > 0) {
        toast.info(`Пропущено дубликатов: ${data.duplicates}`);
      }
    } catch (err) {
      toast.error('Ошибка импорта: ' + String(err));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <PageHeader title="Загрузка Excel" subtitle="Импорт квартир из выгрузки CRM" />

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`stagger-in mb-6 rounded-2xl border-2 border-dashed bg-white p-12 text-center transition cursor-pointer ${
          dragOver
            ? 'border-indigo-400 bg-indigo-50/30'
            : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/30'
        }`}
        style={{ animationDelay: '60ms' }}
        onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.xlsx,.xls';
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) handleFile(file);
          };
          input.click();
        }}
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50">
          {parseResult ? (
            <FileSpreadsheet className="h-7 w-7 text-emerald-500" />
          ) : (
            <Upload className="h-7 w-7 text-indigo-500" />
          )}
        </div>
        <p className="text-lg font-medium text-gray-700">
          {parseResult ? fileName : 'Перетащите файл Excel сюда'}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          {parseResult
            ? `Обработано: ${parseResult.rows.length} строк`
            : 'или нажмите для выбора файла (.xlsx, .xls)'}
        </p>
      </div>

      {/* Parse / import stats */}
      {parseResult && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard
              label="Всего строк"
              value={parseResult.rows.length}
              icon={FileSpreadsheet}
              accent="indigo"
              staggerDelay={0}
            />
            <KpiCard
              label={importResult ? 'Импортировано' : 'Пройдут фильтр'}
              value={importResult ? importResult.imported : parseResult.filtered.length}
              icon={CheckCircle2}
              accent="emerald"
              staggerDelay={70}
            />
            <KpiCard
              label="Пропущено"
              value={importResult ? importResult.skipped : parseResult.skipped}
              icon={AlertTriangle}
              accent="amber"
              staggerDelay={140}
            />
            {importResult && (
              <KpiCard
                label="Дубликаты"
                value={importResult.duplicates}
                icon={Copy}
                accent="purple"
                staggerDelay={210}
              />
            )}
          </div>

          {/* Preview table */}
          {parseResult.filtered.length > 0 && (
            <div
              className="stagger-in mb-6 rounded-2xl bg-white border border-gray-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden"
              style={{ animationDelay: '160ms' }}
            >
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">
                  Предпросмотр{' '}
                  <span className="font-mono-tabular font-normal text-gray-400">
                    ({parseResult.filtered.length} квартир)
                  </span>
                </h2>
                <Button onClick={handleImport} disabled={importing || !!importResult}>
                  {importing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : importResult ? (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  ) : null}
                  {importResult ? 'Импортировано' : 'Импортировать'}
                </Button>
              </div>
              <div className="max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Проект</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Адрес</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Кв.</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">м²</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Отделка</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Статус ОВП</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importing ? (
                      <SkeletonTableRows rows={8} cols={6} />
                    ) : (
                      parseResult.filtered.slice(0, 50).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{row.project_name}</TableCell>
                          <TableCell className="text-sm">{row.address}</TableCell>
                          <TableCell className="font-mono-tabular">{row.apartment_number}</TableCell>
                          <TableCell className="font-mono-tabular">{row.area_sqm}</TableCell>
                          <TableCell>{row.finish_type}</TableCell>
                          <TableCell>{row.ovp_status}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                {!importing && parseResult.filtered.length > 50 && (
                  <p className="text-sm text-gray-500 py-2 text-center">
                    ... и ещё <span className="font-mono-tabular">{parseResult.filtered.length - 50}</span> строк
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Import errors */}
          {importResult && importResult.errors.length > 0 && (
            <div className="stagger-in rounded-2xl border border-red-200 bg-red-50 p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <h3 className="font-semibold text-red-800">
                  Ошибки импорта{' '}
                  <span className="font-mono-tabular font-normal">({importResult.errors.length})</span>
                </h3>
              </div>
              <ul className="space-y-1 text-sm text-red-700 max-h-48 overflow-auto">
                {importResult.errors.map((err, i) => (
                  <li key={i}>
                    <span className="font-mono-tabular font-medium">Строка {err.row}:</span> {err.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
