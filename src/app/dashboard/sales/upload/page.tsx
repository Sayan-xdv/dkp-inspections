'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Upload, FileSpreadsheet, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { parseExcelFile } from '@/lib/excel/parser';
import type { ParseResult, ParsedRow } from '@/lib/excel/column-mapping';

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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Загрузка Excel</h1>

      {/* Drop zone */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
              dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            }`}
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
            {parseResult ? (
              <FileSpreadsheet className="mx-auto h-12 w-12 text-green-500 mb-3" />
            ) : (
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            )}
            <p className="text-lg font-medium text-gray-700">
              {parseResult ? fileName : 'Перетащите файл Excel сюда'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {parseResult
                ? `Обработано: ${parseResult.rows.length} строк`
                : 'или нажмите для выбора файла (.xlsx, .xls)'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Parse stats */}
      {parseResult && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-gray-500">Всего строк</p>
                <p className="text-2xl font-bold">{parseResult.rows.length}</p>
              </CardContent>
            </Card>
            <Card className="border-green-200">
              <CardContent className="pt-4">
                <p className="text-sm text-green-600">Пройдут фильтр (импорт)</p>
                <p className="text-2xl font-bold text-green-700">{parseResult.filtered.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-gray-500">Пропущено (фильтр)</p>
                <p className="text-2xl font-bold text-gray-400">{parseResult.skipped}</p>
              </CardContent>
            </Card>
          </div>

          {/* Preview table */}
          {parseResult.filtered.length > 0 && (
            <Card className="mb-6">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">
                  Предпросмотр ({parseResult.filtered.length} квартир)
                </CardTitle>
                <Button onClick={handleImport} disabled={importing || !!importResult}>
                  {importing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : importResult ? (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  ) : null}
                  {importResult ? 'Импортировано' : 'Импортировать'}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Проект</TableHead>
                        <TableHead>Адрес</TableHead>
                        <TableHead>Кв.</TableHead>
                        <TableHead>м²</TableHead>
                        <TableHead>Отделка</TableHead>
                        <TableHead>Статус ОВП</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parseResult.filtered.slice(0, 50).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{row.project_name}</TableCell>
                          <TableCell className="text-sm">{row.address}</TableCell>
                          <TableCell>{row.apartment_number}</TableCell>
                          <TableCell>{row.area_sqm}</TableCell>
                          <TableCell>{row.finish_type}</TableCell>
                          <TableCell>{row.ovp_status}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {parseResult.filtered.length > 50 && (
                    <p className="text-sm text-gray-500 mt-2 text-center">
                      ... и ещё {parseResult.filtered.length - 50} строк
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Import result */}
          {importResult && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-4">
                <h3 className="font-bold text-green-800 mb-2">Результат импорта</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-green-600">Импортировано:</span>{' '}
                    <strong>{importResult.imported}</strong>
                  </div>
                  <div>
                    <span className="text-yellow-600">Дубликаты:</span>{' '}
                    <strong>{importResult.duplicates}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500">Пропущено:</span>{' '}
                    <strong>{importResult.skipped}</strong>
                  </div>
                  <div>
                    <span className="text-red-600">Ошибки:</span>{' '}
                    <strong>{importResult.errors.length}</strong>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
