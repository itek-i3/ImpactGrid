'use client';

import { useState, useCallback, useMemo, useEffect, useRef, forwardRef } from 'react';
import { useEditorStore } from '@/lib/store/useEditorStore';
import { Plus, Trash2, BarChart2, Type, Hash, DollarSign, Percent, Calendar, ChevronDown, Sigma, List, X, Pencil, Undo2, Redo2 } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import styles from '@/styles/editor.module.css';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const COLUMN_TYPES = [
  { value: 'text',     label: 'Letters / Text',   icon: Type,       description: 'Free-form text, names, descriptions' },
  { value: 'number',   label: 'Number',            icon: Hash,       description: 'Plain numbers, decimals, quantities' },
  { value: 'currency', label: 'Currency',           icon: DollarSign, description: 'Currency formatting (KES, USD, EUR …)' },
  { value: 'percent',  label: 'Percentage',         icon: Percent,    description: 'Percentage values' },
  { value: 'date',     label: 'Date',               icon: Calendar,   description: 'Calendar date selection' },
  { value: 'month',    label: 'Month',              icon: Calendar,   description: 'Select a month (Jan – Dec)' },
  { value: 'formula',  label: 'Formula (auto)',     icon: Sigma,      description: 'Auto-calculated from two other columns' },
  { value: 'dropdown', label: 'Dropdown / Select',  icon: List,       description: 'Pick from a fixed list of options' },
];

const BADGE_COLORS = [
  { bg: 'rgba(48,108,236,0.18)',  border: 'rgba(48,108,236,0.45)',  text: '#7EB3FF' },
  { bg: 'rgba(22,163,107,0.18)', border: 'rgba(22,163,107,0.45)',  text: '#4ade80' },
  { bg: 'rgba(245,166,35,0.18)', border: 'rgba(245,166,35,0.45)',  text: '#F5A623' },
  { bg: 'rgba(224,72,90,0.18)',  border: 'rgba(224,72,90,0.45)',   text: '#E0485A' },
  { bg: 'rgba(155,81,224,0.18)', border: 'rgba(155,81,224,0.45)',  text: '#9B51E0' },
  { bg: 'rgba(57,204,204,0.18)', border: 'rgba(57,204,204,0.45)',  text: '#39CCCC' },
  { bg: 'rgba(255,133,27,0.18)', border: 'rgba(255,133,27,0.45)',  text: '#FF851B' },
];

const MONTH_COLORS = [
  '#7EB3FF','#4ade80','#F5A623','#E0485A','#9B51E0',
  '#39CCCC','#FF851B','#5B9BFF','#16A36B','#F5A623','#306CEC','#E0485A',
];

const OPERATIONS = [
  { value: '-', label: 'Subtract (A − B)' },
  { value: '+', label: 'Add (A + B)' },
  { value: '*', label: 'Multiply (A × B)' },
  { value: '/', label: 'Divide (A ÷ B)' },
];

const AGG_FUNCTIONS = [
  { value: 'sum',     label: 'Sum (total)' },
  { value: 'avg',     label: 'Average' },
  { value: 'min',     label: 'Min' },
  { value: 'max',     label: 'Max' },
  { value: 'product', label: 'Product (×)' },
];

const CURRENCIES = [
  { code: 'KES', symbol: 'KSh',  label: 'Kenyan Shilling',   locale: 'en-KE' },
  { code: 'USD', symbol: '$',    label: 'US Dollar',          locale: 'en-US' },
  { code: 'EUR', symbol: '€',    label: 'Euro',               locale: 'en-DE' },
  { code: 'GBP', symbol: '£',    label: 'British Pound',      locale: 'en-GB' },
  { code: 'NGN', symbol: '₦',    label: 'Nigerian Naira',     locale: 'en-NG' },
  { code: 'ZAR', symbol: 'R',    label: 'South African Rand', locale: 'en-ZA' },
  { code: 'UGX', symbol: 'USh',  label: 'Ugandan Shilling',   locale: 'en-UG' },
  { code: 'TZS', symbol: 'TSh',  label: 'Tanzanian Shilling', locale: 'en-TZ' },
  { code: 'GHS', symbol: '₵',    label: 'Ghanaian Cedi',      locale: 'en-GH' },
];

function getCurrencyLocale(code) {
  return CURRENCIES.find((c) => c.code === code)?.locale || 'en-US';
}

function getCurrencySymbol(code) {
  return CURRENCIES.find((c) => c.code === code)?.symbol || code;
}

function applyOp(op, left, right) {
  switch (op) {
    case '+': return left + right;
    case '-': return left - right;
    case '*': return left * right;
    case '/': return right !== 0 ? left / right : null;
    default:  return null;
  }
}

function evalFormula(config, rowValues) {
  if (!config) return null;
  const parse = (i) => parseFloat(String(rowValues[i] ?? '').replace(/[^0-9.-]/g, '')) || 0;

  // Aggregate function mode: sum/avg/min/max/product across selected columns
  if (config.fn && Array.isArray(config.cols) && config.cols.length > 0) {
    const vals = config.cols.map(parse);
    switch (config.fn) {
      case 'sum':     return vals.reduce((a, b) => a + b, 0);
      case 'avg':     return vals.reduce((a, b) => a + b, 0) / vals.length;
      case 'min':     return Math.min(...vals);
      case 'max':     return Math.max(...vals);
      case 'product': return vals.reduce((a, b) => a * b, 1);
      default:        return null;
    }
  }

  // Expression mode: colA op colB [op2 colC]
  if (config.colA === undefined || config.colB === undefined) return null;
  const a = parse(config.colA);
  const b = parse(config.colB);
  const ab = applyOp(config.op, a, b);
  if (ab === null) return null;
  if (config.colC !== undefined && config.op2) {
    const c = parse(config.colC);
    return applyOp(config.op2, ab, c);
  }
  return ab;
}

function getAutoCalcValue(headerName, colIndex, row, columnTypes) {
  const name = (headerName || '').toLowerCase().trim();
  const getVal = (i) => parseFloat(String(row[i] || '').replace(/[^0-9.-]/g, '')) || 0;
  const numericBefore = columnTypes.slice(0, colIndex).map((t, i) => ({ t, i }))
    .filter(({ t }) => ['number', 'currency', 'percent'].includes(t));
  if (numericBefore.length === 0) return null;
  if (name.includes('variance') || name.includes('difference')) {
    if (numericBefore.length >= 2)
      return getVal(numericBefore[numericBefore.length - 1].i) - getVal(numericBefore[0].i);
  }
  if (name.includes('total') || name.includes('sum'))
    return numericBefore.reduce((acc, { i }) => acc + getVal(i), 0);
  if (name.includes('balance')) {
    if (numericBefore.length >= 2)
      return getVal(numericBefore[numericBefore.length - 1].i) - getVal(numericBefore[0].i);
  }
  return null;
}

function formatResult(value, colType, currencyCode = 'KES') {
  if (value === null || value === undefined) return '—';
  if (colType === 'currency')
    return new Intl.NumberFormat(getCurrencyLocale(currencyCode), { style: 'currency', currency: currencyCode }).format(value);
  if (colType === 'percent') return `${value}%`;
  if (colType === 'number') return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
  return String(value);
}

function getFormulaResultType(cfg, columnTypes) {
  if (!cfg) return 'number';
  // Aggregate mode
  if (cfg.fn && Array.isArray(cfg.cols) && cfg.cols.length > 0) {
    const types = cfg.cols.map(i => columnTypes[i] || 'number');
    if (types.some(t => t === 'currency')) return 'currency';
    if (types.every(t => t === 'percent')) return 'percent';
    return 'number';
  }
  // Expression mode
  if (cfg.colA === undefined) return 'number';
  const typeA = columnTypes[cfg.colA] || 'number';
  const typeB = cfg.colB !== undefined ? (columnTypes[cfg.colB] || 'number') : 'number';
  const typeC = cfg.colC !== undefined ? (columnTypes[cfg.colC] || 'number') : null;
  if (typeA === 'currency' || typeB === 'currency' || typeC === 'currency') return 'currency';
  if (typeA === 'percent' && typeB === 'percent' && (typeC === null || typeC === 'percent')) return 'percent';
  return 'number';
}

const getTypeIcon = (type) => {
  switch (type) {
    case 'number':   return Hash;
    case 'currency': return DollarSign;
    case 'percent':  return Percent;
    case 'date':     return Calendar;
    case 'month':    return Calendar;
    case 'formula':  return Sigma;
    case 'dropdown': return List;
    default:         return Type;
  }
};

const formatValue = (value, type, currencyCode = 'KES') => {
  if (value === undefined || value === null) return '';
  const text = String(value).trim();
  if (!text) return '';
  switch (type) {
    case 'number': {
      const n = parseFloat(text.replace(/[^0-9.-]/g, ''));
      return isNaN(n) ? text : n.toLocaleString(undefined, { maximumFractionDigits: 6 });
    }
    case 'currency': {
      const n = parseFloat(text.replace(/[^0-9.-]/g, ''));
      return isNaN(n) ? text : new Intl.NumberFormat(getCurrencyLocale(currencyCode), { style: 'currency', currency: currencyCode }).format(n);
    }
    case 'percent': {
      const n = parseFloat(text.replace(/[^0-9.-]/g, ''));
      return isNaN(n) ? text : `${n}%`;
    }
    case 'date': {
      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        const parts = text.split('-');
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        if (!isNaN(d.getTime())) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
      return text;
    }
    default:
      return text;
  }
};

const EditableCell = forwardRef(function EditableCell({ value, onBlur, className, readOnly, placeholder, cellId, onNavigate }, forwardedRef) {
  const innerRef = useRef(null);
  const ref = forwardedRef || innerRef;
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value;
  }, [value]);
  return (
    <div
      ref={ref}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      data-cell-id={cellId}
      onBlur={(e) => { if (!readOnly) onBlur(e.target.innerText); }}
      onKeyDown={(e) => {
        if (readOnly) return;
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          e.target.blur();
          onNavigate?.('down');
        } else if (e.key === 'Tab') {
          e.preventDefault();
          e.target.blur();
          onNavigate?.(e.shiftKey ? 'left' : 'right');
        } else if (e.key === 'Escape') {
          e.preventDefault();
          if (ref.current) ref.current.innerHTML = value;
          e.target.blur();
          onNavigate?.('escape');
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          e.target.blur();
          onNavigate?.('up');
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          e.target.blur();
          onNavigate?.('down');
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          e.target.blur();
          onNavigate?.('left');
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          e.target.blur();
          onNavigate?.('right');
        }
      }}
      className={className}
      data-placeholder={placeholder}
    />
  );
});

function DropdownCell({ value, options, onChange, readOnly }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const colorIdx = options.indexOf(value);
  const color = colorIdx >= 0 ? BADGE_COLORS[colorIdx % BADGE_COLORS.length] : null;
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => { if (!readOnly) setOpen((o) => !o); }} style={{ width: '100%', background: 'none', border: 'none', cursor: readOnly ? 'default' : 'pointer', padding: '5px 8px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 4 }}>
        {value ? (
          <span style={{ display: 'inline-block', background: color?.bg || 'rgba(255,255,255,0.07)', border: `1px solid ${color?.border || 'rgba(255,255,255,0.15)'}`, borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 600, color: color?.text || '#B8D4FF', whiteSpace: 'nowrap' }}>{value}</span>
        ) : (
          <span style={{ color: '#3D5A8A', fontSize: 12 }}>—</span>
        )}
        {!readOnly && <ChevronDown size={10} style={{ color: '#3D5A8A', marginLeft: 'auto', flexShrink: 0 }} />}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 2px)', left: 0, zIndex: 999, background: 'rgba(4,9,20,0.97)', border: '1px solid rgba(48,108,236,0.3)', borderRadius: 10, padding: '4px', minWidth: 160, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', backdropFilter: 'blur(16px)' }}>
          {value && <button onClick={() => { onChange(''); setOpen(false); }} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', textAlign: 'left', borderRadius: 6, fontSize: 11, color: '#6C82A3', display: 'flex', alignItems: 'center', gap: 6 }}><X size={10} /> Clear</button>}
          {options.map((opt, i) => {
            const c = BADGE_COLORS[i % BADGE_COLORS.length];
            const isSelected = opt === value;
            return (
              <button key={opt} onClick={() => { onChange(opt); setOpen(false); }} style={{ width: '100%', background: isSelected ? 'rgba(48,108,236,0.10)' : 'none', border: 'none', cursor: 'pointer', padding: '5px 10px', textAlign: 'left', borderRadius: 6, display: 'flex', alignItems: 'center', transition: 'background .1s' }} onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }} onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'none'; }}>
                <span style={{ display: 'inline-block', background: c.bg, border: `1px solid ${c.border}`, borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 600, color: c.text }}>{opt}</span>
              </button>
            );
          })}
          {options.length === 0 && <div style={{ fontSize: 11, color: '#6C82A3', padding: '6px 10px' }}>No options defined</div>}
        </div>
      )}
    </div>
  );
}

function MonthCell({ value, onChange, readOnly }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const monthIdx = MONTHS.indexOf(value);
  const color = monthIdx >= 0 ? MONTH_COLORS[monthIdx] : '#7EB3FF';
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => { if (!readOnly) setOpen((o) => !o); }} style={{ width: '100%', background: 'none', border: 'none', cursor: readOnly ? 'default' : 'pointer', padding: '5px 8px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 4 }}>
        {value ? (
          <span style={{ display: 'inline-block', background: `${color}22`, border: `1px solid ${color}55`, borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{value.slice(0, 3).toUpperCase()}</span>
        ) : (
          <span style={{ color: '#3D5A8A', fontSize: 12 }}>—</span>
        )}
        {!readOnly && <ChevronDown size={10} style={{ color: '#3D5A8A', marginLeft: 'auto', flexShrink: 0 }} />}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 2px)', left: 0, zIndex: 999, background: 'rgba(4,9,20,0.97)', border: '1px solid rgba(48,108,236,0.3)', borderRadius: 10, padding: '6px', minWidth: 160, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', backdropFilter: 'blur(16px)' }}>
          {value && <button onClick={() => { onChange(''); setOpen(false); }} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '5px 10px', textAlign: 'left', borderRadius: 6, fontSize: 11, color: '#6C82A3', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}><X size={10} /> Clear</button>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
            {MONTHS.map((m, i) => {
              const c = MONTH_COLORS[i];
              const isSelected = m === value;
              return (
                <button key={m} onClick={() => { onChange(m); setOpen(false); }} style={{ background: isSelected ? `${c}33` : 'rgba(255,255,255,0.03)', border: `1px solid ${isSelected ? `${c}66` : 'rgba(255,255,255,0.06)'}`, borderRadius: 8, padding: '5px 4px', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: isSelected ? c : '#7EB3FF', transition: 'all .1s', textAlign: 'center' }} onMouseEnter={(e) => { if (!isSelected) { e.currentTarget.style.background = `${c}22`; e.currentTarget.style.color = c; } }} onMouseLeave={(e) => { if (!isSelected) { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#7EB3FF'; } }}>
                  {m.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Data normalisation helpers ──────────────────────────────────────────────

function normaliseSheets(content) {
  if (Array.isArray(content?.sheets)) return content.sheets;
  return [{
    id: 'sheet-0',
    name: 'Sheet 1',
    rows: content?.rows || [['Header 1', 'Header 2', 'Header 3'], ['', '', ''], ['', '', '']],
  }];
}

function normaliseSheetsConfig(properties, sheetsLen) {
  if (Array.isArray(properties?.sheetsConfig)) {
    const arr = [...properties.sheetsConfig];
    while (arr.length < sheetsLen) arr.push(defaultSheetConfig());
    return arr;
  }
  const first = {
    columnTypes:   properties?.columnTypes   || [],
    columnFormulas: properties?.columnFormulas || {},
    columnOptions:  properties?.columnOptions  || {},
    showChart:  properties?.showChart  || false,
    showTotals: properties?.showTotals || false,
    chartType:  properties?.chartType  || 'bar',
    activeSeries: properties?.activeSeries || [],
    currencyCode: properties?.currencyCode || 'KES',
  };
  const arr = [first];
  while (arr.length < sheetsLen) arr.push(defaultSheetConfig());
  return arr;
}

function defaultSheetConfig() {
  return { columnTypes: [], columnFormulas: {}, columnOptions: {}, showChart: false, showTotals: false, chartType: 'bar', activeSeries: [], currencyCode: 'KES' };
}

// ── Main component ──────────────────────────────────────────────────────────

export default function TableBlock({ block, onUpdate, readOnly = false }) {
  const sheets = normaliseSheets(block.content);
  const sheetsConfig = normaliseSheetsConfig(block.properties, sheets.length);

  const [activeSheetIdx, setActiveSheetIdx] = useState(() => {
    const saved = block.content?.activeSheetIndex ?? 0;
    return Math.min(saved, sheets.length - 1);
  });

  const [editingSheetIdx, setEditingSheetIdx] = useState(null);
  const [editingSheetName, setEditingSheetName] = useState('');

  // Clamp activeSheetIdx if sheets were removed
  const safeIdx = Math.min(activeSheetIdx, sheets.length - 1);

  const rows        = sheets[safeIdx]?.rows || [['Header 1'], ['']];
  const properties  = sheetsConfig[safeIdx] || defaultSheetConfig();
  const showChart   = properties.showChart  || false;
  const showTotals  = properties.showTotals || false;
  const chartType   = properties.chartType  || 'bar';
  const columnFormulas = properties.columnFormulas || {};
  const columnOptions  = properties.columnOptions  || {};
  const currencyCode   = properties.currencyCode   || 'KES';

  const cleanText = (html) => (html || '').replace(/<[^>]*>/g, '').trim();

  const columnTypes = useMemo(() => {
    const stored = properties.columnTypes;
    const colCount = rows[0]?.length || 0;
    const types = Array.isArray(stored) ? [...stored] : [];
    while (types.length < colCount) types.push('text');
    types.length = colCount;
    return types;
  }, [properties.columnTypes, rows]);

  // ── Undo / Redo — delegated to the editor store's global history ──
  const { undo: storeUndo, redo: storeRedo } = useEditorStore();
  const handleUndo = storeUndo;
  const handleRedo = storeRedo;

  // ── Per-sheet update helpers ──
  const updateRows = useCallback((newRows) => {
    const newSheets = sheets.map((s, i) => i === safeIdx ? { ...s, rows: newRows } : s);
    onUpdate({ content: { sheets: newSheets, activeSheetIndex: safeIdx } });
  }, [sheets, safeIdx, onUpdate]);

  const updateConfig = useCallback((patch) => {
    const newConfig = sheetsConfig.map((c, i) => i === safeIdx ? { ...c, ...patch } : c);
    onUpdate({ properties: { sheetsConfig: newConfig } });
  }, [sheetsConfig, safeIdx, onUpdate]);

  const updateBoth = useCallback((newRows, patch) => {
    const newSheets = sheets.map((s, i) => i === safeIdx ? { ...s, rows: newRows } : s);
    const newConfig = sheetsConfig.map((c, i) => i === safeIdx ? { ...c, ...patch } : c);
    onUpdate({ content: { sheets: newSheets, activeSheetIndex: safeIdx }, properties: { sheetsConfig: newConfig } });
  }, [sheets, sheetsConfig, safeIdx, onUpdate]);

  // ── Sheet operations ──
  const addSheet = useCallback(() => {
    const headerRow = [...(rows[0] || ['Header 1'])];
    const colCount  = headerRow.length;
    const newSheet  = {
      id: `sheet-${Date.now()}`,
      name: `Sheet ${sheets.length + 1}`,
      rows: [headerRow, new Array(colCount).fill(''), new Array(colCount).fill('')],
    };
    const newConfig = { ...defaultSheetConfig(), columnTypes: [...columnTypes] };
    const newSheets = [...sheets, newSheet];
    const newSheetsConfig = [...sheetsConfig, newConfig];
    onUpdate({
      content:    { sheets: newSheets, activeSheetIndex: newSheets.length - 1 },
      properties: { sheetsConfig: newSheetsConfig },
    });
    setActiveSheetIdx(newSheets.length - 1);
  }, [sheets, sheetsConfig, rows, columnTypes, onUpdate]);

  const commitRenameSheet = useCallback((idx) => {
    const trimmed = editingSheetName.trim();
    if (trimmed) {
      const newSheets = sheets.map((s, i) => i === idx ? { ...s, name: trimmed } : s);
      onUpdate({ content: { sheets: newSheets, activeSheetIndex: safeIdx } });
    }
    setEditingSheetIdx(null);
  }, [sheets, editingSheetName, safeIdx, onUpdate]);

  const deleteSheet = useCallback((idx) => {
    if (sheets.length <= 1) return;
    const newSheets = sheets.filter((_, i) => i !== idx);
    const newSheetsConfig = sheetsConfig.filter((_, i) => i !== idx);
    const newActiveIdx = safeIdx >= newSheets.length ? newSheets.length - 1 : safeIdx > idx ? safeIdx - 1 : safeIdx;
    onUpdate({
      content:    { sheets: newSheets, activeSheetIndex: newActiveIdx },
      properties: { sheetsConfig: newSheetsConfig },
    });
    setActiveSheetIdx(newActiveIdx);
  }, [sheets, sheetsConfig, safeIdx, onUpdate]);

  // ── Row selection + move ──
  const [selectedRowIdx, setSelectedRowIdx] = useState(null); // 1-based (rows[0] is header)
  const [focusedCell, setFocusedCell] = useState(null); // { row: 0-based data row, col: 0-based col }
  const tableWrapperRef = useRef(null);

  const moveRow = useCallback((fromIdx, direction) => {
    const toIdx = fromIdx + direction;
    if (toIdx < 1 || toIdx >= rows.length) return;
    const newRows = [...rows];
    [newRows[fromIdx], newRows[toIdx]] = [newRows[toIdx], newRows[fromIdx]];
    updateRows(newRows);
    setSelectedRowIdx(toIdx);
  }, [rows, updateRows]);

  // ── Cell / row / column operations (unchanged logic, now through helpers) ──
  const [activeDropdownCol, setActiveDropdownCol]         = useState(null);
  const [optionsEditorCol, setOptionsEditorCol]           = useState(null);
  const [newOptionText, setNewOptionText]                 = useState('');
  const [activeFormulaBuilderCol, setActiveFormulaBuilderCol] = useState(null);
  const [showCurrencyPicker, setShowCurrencyPicker]       = useState(false);
  const optionsEditorRef   = useRef(null);
  const currencyPickerRef  = useRef(null);

  useEffect(() => {
    if (optionsEditorCol === null) return;
    const close = (e) => { if (optionsEditorRef.current && !optionsEditorRef.current.contains(e.target)) setOptionsEditorCol(null); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [optionsEditorCol]);

  useEffect(() => {
    if (!showCurrencyPicker) return;
    const close = (e) => { if (currencyPickerRef.current && !currencyPickerRef.current.contains(e.target)) setShowCurrencyPicker(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showCurrencyPicker]);

  const updateCell = useCallback((rowIndex, colIndex, value) => {
    const newRows = rows.map((row, ri) => ri === rowIndex ? row.map((cell, ci) => ci === colIndex ? value : cell) : [...row]);
    updateRows(newRows);
  }, [rows, updateRows]);

  const addRow = useCallback(() => {
    updateRows([...rows, new Array(rows[0]?.length || 3).fill('')]);
  }, [rows, updateRows]);

  const addColumn = useCallback(() => {
    const newRows = rows.map((row, i) => [...row, i === 0 ? `Header ${row.length + 1}` : '']);
    updateBoth(newRows, { columnTypes: [...columnTypes, 'text'] });
  }, [rows, columnTypes, updateBoth]);

  const removeRow = useCallback((index) => {
    if (rows.length <= 2) return;
    updateRows(rows.filter((_, i) => i !== index));
  }, [rows, updateRows]);

  const removeColumn = useCallback((colIndex) => {
    if ((rows[0]?.length || 0) <= 1) return;
    const newRows = rows.map((row) => row.filter((_, ci) => ci !== colIndex));
    updateBoth(newRows, { columnTypes: columnTypes.filter((_, ci) => ci !== colIndex) });
  }, [rows, columnTypes, updateBoth]);

  const handleColumnTypeChange = useCallback((colIndex, newType) => {
    const newColumnTypes = [...columnTypes];
    newColumnTypes[colIndex] = newType;
    const newRows = rows.map((row, ri) => {
      if (ri === 0) return row;
      return row.map((cell, ci) => {
        if (ci !== colIndex) return cell;
        const text = cleanText(cell);
        if (!text) return '';
        if (newType === 'date') {
          if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
          const p = new Date(text);
          return !isNaN(p.getTime()) ? p.toISOString().split('T')[0] : text;
        }
        if (newType === 'month' || newType === 'dropdown') return text;
        const n = parseFloat(text.replace(/[^0-9.-]/g, ''));
        if (isNaN(n)) return text;
        if (newType === 'currency') return new Intl.NumberFormat(getCurrencyLocale(currencyCode), { style: 'currency', currency: currencyCode }).format(n);
        if (newType === 'percent') return `${n}%`;
        if (newType === 'number') return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
        return String(n);
      });
    });
    updateBoth(newRows, { columnTypes: newColumnTypes });
    if (newType === 'dropdown') { setOptionsEditorCol(colIndex); setNewOptionText(''); }
    else setOptionsEditorCol(null);
  }, [rows, columnTypes, updateBoth, currencyCode]);

  const toggleChart  = useCallback(() => updateConfig({ showChart:  !showChart  }), [updateConfig, showChart]);
  const toggleTotals = useCallback(() => updateConfig({ showTotals: !showTotals }), [updateConfig, showTotals]);
  const updateCurrencyCode = useCallback((code) => { updateConfig({ currencyCode: code }); setShowCurrencyPicker(false); }, [updateConfig]);

  const updateFormula = useCallback((colIndex, formula) => {
    updateConfig({ columnFormulas: { ...columnFormulas, [colIndex]: formula } });
  }, [updateConfig, columnFormulas]);

  // ── Keyboard navigation helper ──
  const focusCellEditor = useCallback((row, col) => {
    const el = tableWrapperRef.current?.querySelector(`[data-cell-id="${row}-${col}"]`);
    if (!el) return;
    el.focus();
    try {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (_) {}
  }, []);

  const handleTableKeyDown = useCallback((e) => {
    const inEditable    = document.activeElement?.getAttribute('contenteditable') === 'true';
    const inNativeInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    const cols = (rows[0]?.length || 0);
    const dataRowCount = rows.length - 1;

    // Native inputs (sheet rename, options editor, etc.) handle their own keys.
    // Only intercept global shortcuts — Escape, Ctrl+Z/Y/Shift+Z.
    if (inNativeInput) {
      if (e.key === 'Escape') {
        // Let the input's own onKeyDown handle Escape first (it runs before bubbling reaches here
        // only if stopPropagation is called; since it isn't, we just skip our handling so the
        // input's handler has already run by this point in React's synthetic event order).
        // Nothing extra needed — the input already called setEditingSheetIdx(null).
        return;
      }
      // Allow Ctrl+Z/Y through for undo/redo (handled below), block everything else.
      if (!((e.ctrlKey || e.metaKey) && ['z','y'].includes(e.key.toLowerCase()))) return;
    }

    // Escape: close menus in priority order, then deselect
    if (e.key === 'Escape') {
      e.preventDefault();
      if (activeFormulaBuilderCol !== null) { setActiveFormulaBuilderCol(null); return; }
      if (showCurrencyPicker)               { setShowCurrencyPicker(false);      return; }
      if (activeDropdownCol !== null)       { setActiveDropdownCol(null);        return; }
      if (optionsEditorCol !== null)        { setOptionsEditorCol(null);         return; }
      setFocusedCell(null);
      setSelectedRowIdx(null);
      tableWrapperRef.current?.focus();
      return;
    }

    // Undo: Ctrl/Cmd + Z
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      // If editing a non-empty cell, let the browser undo letter-by-letter
      if (inEditable && document.activeElement?.textContent?.length > 0) return;
      e.preventDefault();
      handleUndo();
      return;
    }

    // Redo: Ctrl/Cmd + Shift + Z  or  Ctrl/Cmd + Y
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
      if (inEditable && document.activeElement?.textContent?.length > 0) return;
      e.preventDefault();
      handleRedo();
      return;
    }

    // Sheet switch: Ctrl/Cmd + ArrowLeft / ArrowRight
    if ((e.ctrlKey || e.metaKey) && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      setActiveSheetIdx((i) => e.key === 'ArrowRight'
        ? Math.min(i + 1, sheets.length - 1)
        : Math.max(i - 1, 0));
      return;
    }

    // While inside a text editor, handle only special navigation keys
    if (inEditable) return;

    // Nothing focused yet — any arrow / tab / enter focuses first cell
    if (!focusedCell) {
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab','Enter'].includes(e.key)) {
        e.preventDefault();
        setFocusedCell({ row: 0, col: 0 });
      }
      return;
    }

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const move = (dr, dc) => setFocusedCell(prev => ({
      row: clamp((prev?.row ?? 0) + dr, 0, dataRowCount - 1),
      col: clamp((prev?.col ?? 0) + dc, 0, cols - 1),
    }));

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (e.altKey && selectedRowIdx !== null) moveRow(selectedRowIdx, -1);
        else move(-1, 0);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (e.altKey && selectedRowIdx !== null) moveRow(selectedRowIdx, 1);
        else move(1, 0);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        move(0, -1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        move(0, 1);
        break;
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) move(0, -1); else move(0, 1);
        break;
      case 'Enter':
        e.preventDefault();
        focusCellEditor(focusedCell.row, focusedCell.col);
        break;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        updateCell(focusedCell.row + 1, focusedCell.col, '');
        break;
      default:
        // Start editing on printable key
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && !readOnly) {
          const colType = columnTypes[focusedCell.col] || 'text';
          if (['text','number','currency','percent'].includes(colType)) {
            e.preventDefault();
            const el = tableWrapperRef.current?.querySelector(`[data-cell-id="${focusedCell.row}-${focusedCell.col}"]`);
            if (el) { el.innerHTML = e.key; el.focus(); try { const r=document.createRange(),s=window.getSelection(); r.selectNodeContents(el); r.collapse(false); s.removeAllRanges(); s.addRange(r); } catch(_){} }
          }
        }
    }
  }, [focusedCell, rows, selectedRowIdx, moveRow, activeFormulaBuilderCol, showCurrencyPicker,
      activeDropdownCol, optionsEditorCol, sheets, columnTypes, currencyCode, readOnly, updateCell, focusCellEditor,
      handleUndo, handleRedo, rows]);

  const updateColumnOptions = useCallback((colIndex, opts) => {
    updateConfig({ columnOptions: { ...columnOptions, [colIndex]: opts } });
  }, [updateConfig, columnOptions]);

  // ── Chart ──
  const headers = useMemo(() => (rows[0] || []).map((h, i) => cleanText(h) || `Column ${i + 1}`), [rows]);

  const availableSeries = useMemo(() => {
    const autoCalcNames = ['variance', 'difference', 'total', 'sum', 'balance'];
    return headers.slice(1).filter((h) => !autoCalcNames.some((n) => h.toLowerCase().includes(n)));
  }, [headers]);

  const activeSeries = useMemo(() => {
    const stored = properties.activeSeries;
    if (Array.isArray(stored)) {
      const valid = stored.filter((s) => availableSeries.includes(s));
      return chartType === 'pie' && valid.length > 1 ? [valid[0]] : valid;
    }
    return availableSeries.length > 0 ? (chartType === 'pie' ? [availableSeries[0]] : availableSeries) : [];
  }, [properties.activeSeries, availableSeries, chartType]);

  const chartData = useMemo(() => rows.slice(1).map((row) => {
    const item = {};
    headers.forEach((header, ci) => {
      if (ci === 0) { item.name = cleanText(row[ci] || '') || 'Untitled'; }
      else {
        const n = parseFloat(cleanText(row[ci] || '').replace(/[^0-9.-]/g, ''));
        item[header] = isNaN(n) ? 0 : n;
      }
    });
    return item;
  }), [rows, headers]);

  const handleChartTypeChange = useCallback((e) => {
    const nextType = e.target.value;
    const updates = { chartType: nextType };
    if (nextType === 'pie' && activeSeries.length > 1) updates.activeSeries = [activeSeries[0]];
    updateConfig(updates);
  }, [updateConfig, activeSeries]);

  const toggleSeries = useCallback((seriesName) => {
    let newActive;
    if (chartType === 'pie') { newActive = [seriesName]; }
    else {
      newActive = activeSeries.includes(seriesName)
        ? activeSeries.filter((s) => s !== seriesName)
        : [...activeSeries, seriesName];
    }
    updateConfig({ activeSeries: newActive });
  }, [updateConfig, activeSeries, chartType]);

  const seriesColors  = ['#306CEC', '#F5A623', '#16A36B', '#E0485A', '#9B51E0', '#39CCCC', '#FF851B', '#5B9BFF'];
  const glowColors    = ['rgba(48,108,236,0.4)', 'rgba(245,166,35,0.4)', 'rgba(22,163,107,0.4)', 'rgba(224,72,90,0.4)', 'rgba(155,81,224,0.4)', 'rgba(57,204,204,0.4)'];

  const renderChart = () => {
    const manyPoints = chartData.length > 6;
    const hasCurrency = activeSeries.some((s) => { const idx = headers.indexOf(s); return idx >= 0 && columnTypes[idx] === 'currency'; });
    const sym = getCurrencySymbol(currencyCode);
    const yFormatter = (v) => {
      if (!hasCurrency) return v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v;
      if (Math.abs(v) >= 1000000) return `${sym}${(v / 1000000).toFixed(1)}M`;
      if (Math.abs(v) >= 1000) return `${sym}${(v / 1000).toFixed(0)}K`;
      return `${sym}${v}`;
    };
    const tooltipFormatter = (value, name) => {
      const idx = headers.indexOf(name);
      const t = idx >= 0 ? (columnTypes[idx] || 'text') : 'text';
      if (t === 'currency') return [new Intl.NumberFormat(getCurrencyLocale(currencyCode), { style: 'currency', currency: currencyCode }).format(value), name];
      if (t === 'percent')  return [`${value}%`, name];
      return [value.toLocaleString(), name];
    };
    const tooltipStyle = { background: 'rgba(4,9,20,0.97)', border: '1px solid rgba(48,108,236,0.35)', borderRadius: 10, fontSize: 12, color: '#E2EEFF', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' };

    const chartControls = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#6C82A3', fontWeight: 600 }}>Type</span>
          <select value={chartType} onChange={handleChartTypeChange} disabled={readOnly} className={styles.chartSelect}>
            <option value="bar">Bar</option>
            <option value="line">Line</option>
            <option value="pie">Pie</option>
          </select>
        </div>
        {!readOnly && availableSeries.length > 1 && chartType !== 'pie' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#6C82A3', fontWeight: 600 }}>Show</span>
            {availableSeries.map((series, idx) => (
              <label key={series} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: activeSeries.includes(series) ? seriesColors[idx % seriesColors.length] : '#6C82A3', cursor: 'pointer', fontWeight: 600 }}>
                <input type="checkbox" checked={activeSeries.includes(series)} onChange={() => toggleSeries(series)} style={{ accentColor: seriesColors[idx % seriesColors.length], cursor: 'pointer' }} />
                {series}
              </label>
            ))}
          </div>
        )}
        {!readOnly && chartType === 'pie' && availableSeries.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#6C82A3', fontWeight: 600 }}>Column</span>
            {availableSeries.map((series) => (
              <label key={series} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: activeSeries.includes(series) ? '#7EB3FF' : '#6C82A3', cursor: 'pointer', fontWeight: 600 }}>
                <input type="radio" name={`pie-${block.id}`} checked={activeSeries.includes(series)} onChange={() => toggleSeries(series)} style={{ accentColor: 'var(--color-accent-primary)', cursor: 'pointer' }} />
                {series}
              </label>
            ))}
          </div>
        )}
      </div>
    );

    const gradientDefs = (
      <defs>
        {activeSeries.map((_, i) => {
          const id = `grad-${block.id}-${safeIdx}-${i}`;
          const color = seriesColors[i % seriesColors.length];
          return (
            <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={color} stopOpacity={0.95} />
              <stop offset="100%" stopColor={color} stopOpacity={0.25} />
            </linearGradient>
          );
        })}
      </defs>
    );

    if (chartType === 'pie') {
      const selectedSeries = activeSeries[0] || availableSeries[0];
      const pieData = chartData.map((item) => ({ name: item.name, value: item[selectedSeries] || 0 }));
      return (
        <div className={styles.chartSection}>
          <div className={styles.chartHeader}>{chartControls}</div>
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <defs>
                  {pieData.map((_, i) => {
                    const color = seriesColors[i % seriesColors.length];
                    return (
                      <radialGradient key={i} id={`piegrad-${block.id}-${safeIdx}-${i}`} cx="50%" cy="50%" r="50%">
                        <stop offset="0%"   stopColor={color} stopOpacity={1} />
                        <stop offset="100%" stopColor={color} stopOpacity={0.7} />
                      </radialGradient>
                    );
                  })}
                </defs>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120} innerRadius={55} paddingAngle={3} strokeWidth={0} label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''} labelLine={false}>
                  {pieData.map((_, i) => <Cell key={i} fill={`url(#piegrad-${block.id}-${safeIdx}-${i})`} style={{ filter: `drop-shadow(0 0 6px ${glowColors[i % glowColors.length]})` }} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={tooltipFormatter} />
                <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12, color: '#B8D4FF', paddingTop: 16 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    const ChartComponent = chartType === 'line' ? LineChart : BarChart;
    return (
      <div className={styles.chartSection}>
        <div className={styles.chartHeader}>{chartControls}</div>
        <div className={styles.chartContainer}>
          <ResponsiveContainer width="100%" height={340}>
            <ChartComponent data={chartData} margin={{ top: 20, right: 24, left: 10, bottom: manyPoints ? 60 : 12 }}>
              {gradientDefs}
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="name" stroke="transparent" tick={{ fill: '#6C82A3', fontSize: 11, fontWeight: 500 }} tickLine={false} axisLine={false} angle={manyPoints ? -40 : 0} textAnchor={manyPoints ? 'end' : 'middle'} interval={0} dy={manyPoints ? 4 : 0} />
              <YAxis stroke="transparent" tick={{ fill: '#6C82A3', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={yFormatter} width={58} />
              <Tooltip contentStyle={tooltipStyle} formatter={tooltipFormatter} cursor={{ fill: 'rgba(48,108,236,0.06)', stroke: 'rgba(48,108,236,0.2)', strokeWidth: 1, rx: 4 }} />
              <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12, color: '#B8D4FF', paddingTop: 12 }} />
              {activeSeries.map((series, index) => {
                const color = seriesColors[index % seriesColors.length];
                const gradId = `url(#grad-${block.id}-${safeIdx}-${index})`;
                if (chartType === 'bar') return <Bar key={series} dataKey={series} fill={gradId} radius={[6, 6, 0, 0]} maxBarSize={52} style={{ filter: `drop-shadow(0 4px 8px ${glowColors[index % glowColors.length]})` }} />;
                return <Line key={series} type="monotone" dataKey={series} stroke={color} strokeWidth={3} dot={{ r: 4, fill: color, strokeWidth: 2, stroke: 'rgba(4,9,20,0.8)' }} activeDot={{ r: 6, fill: color, stroke: 'rgba(255,255,255,0.3)', strokeWidth: 2 }} style={{ filter: `drop-shadow(0 0 6px ${glowColors[index % glowColors.length]})` }} />;
              })}
            </ChartComponent>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // ── Render ──
  return (
    <div
      ref={tableWrapperRef}
      className={`${styles.tableBlock} ${!readOnly ? styles.editMode : ''}`}
      tabIndex={readOnly ? undefined : 0}
      onKeyDown={readOnly ? undefined : handleTableKeyDown}
      onFocus={() => {}} /* keep focus on wrapper when clicking between cells */
      style={{ outline: 'none' }}
    >

      {/* ── Sheet tab bar (top) ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 3,
        borderBottom: '1px solid rgba(48,108,236,0.15)',
        background: 'rgba(0,0,0,0.30)',
        padding: '6px 10px',
        overflowX: 'auto',
      }}>
        {sheets.map((sheet, i) => {
          const isActive = i === safeIdx;
          return (
            <div
              key={sheet.id}
              style={{
                display: 'flex', alignItems: 'center', flexShrink: 0,
                background: isActive ? 'rgba(48,108,236,0.20)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isActive ? 'rgba(48,108,236,0.45)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 8,
                transition: 'all .15s',
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
            >
              {editingSheetIdx === i ? (
                <input
                  autoFocus
                  value={editingSheetName}
                  onChange={(e) => setEditingSheetName(e.target.value)}
                  onBlur={() => commitRenameSheet(i)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') { e.preventDefault(); commitRenameSheet(i); }
                    if (e.key === 'Escape') { e.preventDefault(); setEditingSheetIdx(null); }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    fontSize: 11, fontWeight: 600, padding: '4px 10px',
                    background: 'transparent', border: 'none',
                    color: '#7EB3FF', outline: 'none',
                    width: Math.max(60, editingSheetName.length * 7 + 20),
                  }}
                />
              ) : (
                <button
                  onClick={() => {
                    if (!isActive) { setActiveSheetIdx(i); setFocusedCell(null); }
                    else if (!readOnly) { setEditingSheetIdx(i); setEditingSheetName(sheet.name); }
                  }}
                  title={isActive && !readOnly ? 'Click to rename' : sheet.name}
                  style={{
                    fontSize: 11, fontWeight: 600, padding: '4px 10px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: isActive ? '#7EB3FF' : '#6C82A3',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {sheet.name}
                </button>
              )}

              {/* Delete button — only show when more than 1 sheet */}
              {!readOnly && sheets.length > 1 && editingSheetIdx !== i && (
                <button
                  onClick={(e) => { e.stopPropagation(); deleteSheet(i); }}
                  title={`Delete "${sheet.name}"`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 16, height: 16, borderRadius: 4, border: 'none',
                    background: 'none', color: '#3D5A8A', cursor: 'pointer',
                    marginRight: 5, flexShrink: 0, padding: 0, transition: 'all .12s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(224,72,90,0.18)'; e.currentTarget.style.color = '#E0485A'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#3D5A8A'; }}
                >
                  <X size={10} />
                </button>
              )}
            </div>
          );
        })}

        {!readOnly && (
          <button
            onClick={addSheet}
            title="Add sheet"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 8, border: '1px dashed rgba(48,108,236,0.30)',
              background: 'transparent', color: '#3D5A8A',
              cursor: 'pointer', flexShrink: 0, marginLeft: 2,
              fontSize: 11, fontWeight: 600, transition: 'all .15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(48,108,236,0.10)'; e.currentTarget.style.color = '#7EB3FF'; e.currentTarget.style.borderColor = 'rgba(48,108,236,0.50)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#3D5A8A'; e.currentTarget.style.borderColor = 'rgba(48,108,236,0.30)'; }}
          >
            <Plus size={11} /> Sheet
          </button>
        )}
      </div>

      <table className={styles.table}>
        <thead>
          <tr>
            {/* Row handle header — empty, just sets column width */}
            {!readOnly && <th style={{ width: 28, minWidth: 28, padding: 0, background: 'rgba(0,0,0,0.2)', borderRight: '1px solid rgba(48,108,236,0.10)' }} />}
            {rows[0]?.map((cell, ci) => {
              const colType = columnTypes[ci] || 'text';
              const IconComponent = getTypeIcon(colType);
              return (
                <th key={ci} className={styles.tableHeader}>
                  <div className={styles.headerContainer}>
                    {!readOnly && (
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flexDirection: 'column', gap: 2 }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <button
                            className={styles.columnTypeTrigger}
                            onClick={(e) => { e.stopPropagation(); setActiveDropdownCol(activeDropdownCol === ci ? null : ci); }}
                            title={`Column type: ${colType}`}
                          >
                            <IconComponent size={13} className={styles.typeIcon} style={colType === 'month' ? { color: '#F5A623' } : undefined} />
                            <ChevronDown size={8} className={styles.chevronIcon} />
                          </button>

                          {activeDropdownCol === ci && (
                            <>
                              <div className={styles.dropdownBackdrop} onClick={(e) => { e.stopPropagation(); setActiveDropdownCol(null); }} />
                              <div className={styles.columnTypeMenu}>
                                <div className={styles.menuHeader}>Column Data Type</div>
                                {COLUMN_TYPES.map((t) => {
                                  const TypeIcon = t.icon;
                                  const isSelected = colType === t.value;
                                  return (
                                    <button
                                      key={t.value}
                                      className={`${styles.columnTypeMenuItem} ${isSelected ? styles.menuItemActive : ''}`}
                                      onClick={(e) => { e.stopPropagation(); handleColumnTypeChange(ci, t.value); setActiveDropdownCol(null); }}
                                    >
                                      <TypeIcon size={14} className={styles.menuItemIcon} style={t.value === 'month' ? { color: '#F5A623' } : undefined} />
                                      <div className={styles.menuItemText}>
                                        <span className={styles.menuItemLabel}>{t.label}</span>
                                        <span className={styles.menuItemDesc}>{t.description}</span>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </>
                          )}

                          {colType === 'dropdown' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setOptionsEditorCol(optionsEditorCol === ci ? null : ci); setNewOptionText(''); }}
                              title="Edit options"
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 5, border: 'none', cursor: 'pointer', background: optionsEditorCol === ci ? 'rgba(48,108,236,0.25)' : 'rgba(255,255,255,0.05)', color: optionsEditorCol === ci ? '#7EB3FF' : '#6C82A3', transition: 'all .15s', flexShrink: 0, marginLeft: 2 }}
                            >
                              <Pencil size={10} />
                            </button>
                          )}

                          {/* Formula edit pencil — stays inline with the type icon */}
                          {colType === 'formula' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setActiveFormulaBuilderCol(activeFormulaBuilderCol === ci ? null : ci); }}
                              title={activeFormulaBuilderCol === ci ? 'Close formula editor' : 'Edit formula'}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 5, border: 'none', cursor: 'pointer', background: activeFormulaBuilderCol === ci ? 'rgba(48,108,236,0.25)' : 'rgba(255,255,255,0.05)', color: activeFormulaBuilderCol === ci ? '#7EB3FF' : '#6C82A3', transition: 'all .15s', flexShrink: 0, marginLeft: 2 }}
                            >
                              <Pencil size={10} />
                            </button>
                          )}
                        </div>

                        {/* Dropdown options editor */}
                        {colType === 'dropdown' && optionsEditorCol === ci && (() => {
                          const opts = columnOptions[ci] || [];
                          return (
                            <div ref={optionsEditorRef} className={styles.columnTypeMenu} style={{ top: 'calc(100% + 4px)', minWidth: 230, zIndex: 601 }}>
                              <div className={styles.menuHeader} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>Dropdown Options</span>
                                <button onClick={() => setOptionsEditorCol(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6C82A3', display: 'flex', padding: 2 }}><X size={12} /></button>
                              </div>
                              {opts.length === 0 && <div style={{ fontSize: 11, color: '#6C82A3', padding: '4px 12px 2px' }}>Type an option and press Enter</div>}
                              <div style={{ maxHeight: 180, overflowY: 'auto', padding: '2px 0' }}>
                                {opts.map((opt, oi) => {
                                  const c = BADGE_COLORS[oi % BADGE_COLORS.length];
                                  return (
                                    <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px' }}>
                                      <span style={{ flex: 1, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 600, color: c.text }}>{opt}</span>
                                      <button onClick={(e) => { e.stopPropagation(); updateColumnOptions(ci, opts.filter((_, i) => i !== oi)); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6C82A3', display: 'flex', padding: 2, flexShrink: 0 }}><X size={12} /></button>
                                    </div>
                                  );
                                })}
                              </div>
                              <div style={{ borderTop: '1px solid rgba(48,108,236,0.15)', padding: '8px 10px', display: 'flex', gap: 6 }}>
                                <input
                                  type="text" placeholder="New option…" autoFocus value={newOptionText}
                                  onChange={(e) => setNewOptionText(e.target.value)}
                                  onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); const v = newOptionText.trim(); if (v && !opts.includes(v)) updateColumnOptions(ci, [...opts, v]); setNewOptionText(''); } if (e.key === 'Escape') setOptionsEditorCol(null); }}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ flex: 1, fontSize: 11, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(48,108,236,0.3)', borderRadius: 7, color: '#E2EEFF', padding: '5px 9px', outline: 'none', minWidth: 0 }}
                                />
                                <button onClick={(e) => { e.stopPropagation(); const v = newOptionText.trim(); if (v && !opts.includes(v)) updateColumnOptions(ci, [...opts, v]); setNewOptionText(''); }} style={{ fontSize: 12, fontWeight: 700, background: 'rgba(48,108,236,0.3)', border: '1px solid rgba(48,108,236,0.5)', borderRadius: 7, color: '#7EB3FF', padding: '5px 12px', cursor: 'pointer' }}>Add</button>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Formula builder — floating popup, no height impact on header */}
                        {colType === 'formula' && activeFormulaBuilderCol === ci && (() => {
                          const cfg = columnFormulas[ci] || {};
                          const isAggMode = !!cfg.fn;
                          const headers = rows[0] || [];
                          const colOpts = headers.map((h, i) => i !== ci ? <option key={i} value={i}>{h || `Col ${i + 1}`}</option> : null);
                          const ss = { width: '100%', fontSize: 12, background: '#0d1b38', border: '1px solid rgba(48,108,236,0.30)', borderRadius: 7, color: '#E2EEFF', padding: '6px 9px', outline: 'none', cursor: 'pointer' };
                          const tabBtn = (active) => ({ fontSize: 11, fontWeight: 700, flex: 1, padding: '5px 0', borderRadius: 6, border: 'none', cursor: 'pointer', background: active ? 'rgba(48,108,236,0.35)' : 'rgba(255,255,255,0.04)', color: active ? '#7EB3FF' : '#6C82A3', transition: 'all .15s' });
                          const selectedCols = Array.isArray(cfg.cols) ? cfg.cols : [];
                          const toggleCol = (i) => {
                            const next = selectedCols.includes(i) ? selectedCols.filter(c => c !== i) : [...selectedCols, i];
                            updateFormula(ci, { ...cfg, cols: next });
                          };
                          return (
                            <div
                              style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 700, background: 'rgba(4,9,20,0.97)', border: '1px solid rgba(48,108,236,0.35)', borderRadius: 12, padding: '12px', minWidth: 240, boxShadow: '0 8px 32px rgba(0,0,0,0.55)', display: 'flex', flexDirection: 'column', gap: 8 }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#3D5A8A', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Formula</div>
                                <button onClick={(e) => { e.stopPropagation(); setActiveFormulaBuilderCol(null); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 5, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.06)', color: '#6C82A3', flexShrink: 0 }} title="Close"><X size={12} /></button>
                              </div>

                              {/* Mode tabs */}
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button style={tabBtn(!isAggMode)} onClick={(e) => { e.stopPropagation(); updateFormula(ci, { op: cfg.op || '-' }); }}>A op B</button>
                                <button style={tabBtn(isAggMode)} onClick={(e) => { e.stopPropagation(); updateFormula(ci, { fn: cfg.fn || 'sum', cols: cfg.cols || [] }); }}>Function</button>
                              </div>

                              {isAggMode ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  <select style={ss} value={cfg.fn || 'sum'} onChange={e => updateFormula(ci, { ...cfg, fn: e.target.value })}>
                                    {AGG_FUNCTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                  </select>
                                  <div style={{ fontSize: 11, color: '#6C82A3', marginTop: 2 }}>Select columns to include:</div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
                                    {headers.map((h, i) => {
                                      if (i === ci) return null;
                                      const checked = selectedCols.includes(i);
                                      return (
                                        <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 6px', borderRadius: 6, background: checked ? 'rgba(48,108,236,0.15)' : 'transparent' }} onClick={(e) => { e.stopPropagation(); toggleCol(i); }}>
                                          <div style={{ width: 14, height: 14, borderRadius: 4, border: `1.5px solid ${checked ? '#306CEC' : '#3D5A8A'}`, background: checked ? '#306CEC' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            {checked && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                          </div>
                                          <span style={{ fontSize: 12, color: checked ? '#E2EEFF' : '#8A9DC0' }}>{h || `Col ${i + 1}`}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                  {selectedCols.length > 0 && (
                                    <div style={{ fontSize: 11, color: '#4ade80', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 6, padding: '4px 8px' }}>
                                      {(cfg.fn || 'sum').toUpperCase()}({selectedCols.map(i => headers[i] || `Col ${i + 1}`).join(', ')})
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  <select style={ss} value={cfg.colA ?? ''} onChange={e => updateFormula(ci, { ...cfg, colA: parseInt(e.target.value) })}>
                                    <option value="">Column A…</option>{colOpts}
                                  </select>
                                  <select style={ss} value={cfg.op || '-'} onChange={e => updateFormula(ci, { ...cfg, op: e.target.value })}>
                                    {OPERATIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                  </select>
                                  <select style={ss} value={cfg.colB ?? ''} onChange={e => updateFormula(ci, { ...cfg, colB: parseInt(e.target.value) })}>
                                    <option value="">Column B…</option>{colOpts}
                                  </select>
                                  <select style={ss} value={cfg.op2 || ''} onChange={e => {
                                    const val = e.target.value;
                                    const next = { ...cfg, op2: val };
                                    if (!val) { delete next.op2; delete next.colC; }
                                    updateFormula(ci, next);
                                  }}>
                                    <option value="">+ Add operand…</option>
                                    {OPERATIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                  </select>
                                  {cfg.op2 && (
                                    <select style={ss} value={cfg.colC ?? ''} onChange={e => updateFormula(ci, { ...cfg, colC: parseInt(e.target.value) })}>
                                      <option value="">Column C…</option>{colOpts}
                                    </select>
                                  )}
                                </div>
                              )}

                              <button
                                onClick={(e) => { e.stopPropagation(); setActiveFormulaBuilderCol(null); }}
                                style={{ fontSize: 12, fontWeight: 700, background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.35)', borderRadius: 8, color: '#4ade80', padding: '7px 0', cursor: 'pointer', width: '100%' }}
                              >
                                Done
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    <EditableCell value={cell} onBlur={(text) => updateCell(0, ci, text)} className={styles.headerText} readOnly={readOnly} placeholder="Column" />
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.slice(1).map((row, ri) => (
            <tr key={ri + 1} style={selectedRowIdx === ri + 1 ? { background: 'rgba(48,108,236,0.10)' } : undefined}>
              {/* Row handle cell */}
              {!readOnly && (
                <td
                  style={{ width: 28, minWidth: 28, padding: 0, textAlign: 'center', verticalAlign: 'middle', borderRight: '1px solid rgba(48,108,236,0.10)', cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => setSelectedRowIdx(selectedRowIdx === ri + 1 ? null : ri + 1)}
                >
                  {selectedRowIdx === ri + 1 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); moveRow(ri + 1, -1); }}
                        title="Move up"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#306CEC', fontSize: 12, lineHeight: 1, padding: '1px 4px' }}
                      >↑</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); moveRow(ri + 1, 1); }}
                        title="Move down"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#306CEC', fontSize: 12, lineHeight: 1, padding: '1px 4px' }}
                      >↓</button>
                    </div>
                  ) : (
                    <span style={{ color: '#3D5A8A', fontSize: 10 }}>{ri + 1}</span>
                  )}
                </td>
              )}
              {row.map((cell, ci) => {
                const colType = columnTypes[ci] || 'text';
                const isFocused = focusedCell?.row === ri && focusedCell?.col === ci;
                const focusedStyle = isFocused ? { outline: '2px solid rgba(48,108,236,0.75)', outlineOffset: -1, position: 'relative', zIndex: 1 } : undefined;
                const handleCellClick = () => {
                  setFocusedCell({ row: ri, col: ci });
                  // For editable text cells, let the click naturally focus the contenteditable
                  // so the blinking cursor appears immediately. For read-only / special cells,
                  // return focus to the wrapper for keyboard navigation.
                  const isEditable = !readOnly && ['text', 'number', 'currency', 'percent'].includes(colType);
                  if (!isEditable) tableWrapperRef.current?.focus();
                };

                if (colType === 'formula') {
                  const formula = columnFormulas[ci] || '';
                  const result = evalFormula(formula, row);
                  const resultType = getFormulaResultType(formula, columnTypes);
                  const display = result !== null ? formatResult(result, resultType, currencyCode) : (formula ? '…' : '—');
                  return <td key={ci} style={focusedStyle} onClick={handleCellClick}><div className={styles.cellText} style={{ textAlign: 'right', color: result !== null && result < 0 ? '#ef4444' : '#4ade80', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{display}</div></td>;
                }

                const headerName = cleanText(rows[0]?.[ci] || '');
                const autoVal = getAutoCalcValue(headerName, ci, row, columnTypes);
                if (autoVal !== null) {
                  return <td key={ci} style={focusedStyle} onClick={handleCellClick}><div className={styles.cellText} style={{ textAlign: 'right', color: autoVal < 0 ? '#ef4444' : '#4ade80', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{formatResult(autoVal, colType, currencyCode)}</div></td>;
                }

                if (colType === 'month') {
                  return (
                    <td key={ci} style={{ padding: 0, ...focusedStyle }} onClick={handleCellClick}>
                      <MonthCell value={cell || ''} onChange={(val) => updateCell(ri + 1, ci, val)} readOnly={readOnly} />
                    </td>
                  );
                }

                if (colType === 'dropdown') {
                  return <td key={ci} style={{ padding: 0, ...focusedStyle }} onClick={handleCellClick}><DropdownCell value={cell || ''} options={columnOptions[ci] || []} onChange={(val) => updateCell(ri + 1, ci, val)} readOnly={readOnly} /></td>;
                }

                if (!readOnly && colType === 'date') {
                  return <td key={ci} style={focusedStyle} onClick={handleCellClick}><input type="date" value={cell || ''} onChange={(e) => updateCell(ri + 1, ci, e.target.value)} className={styles.dateCellInput} /></td>;
                }

                let alignClass = styles.alignLeft;
                if (['number', 'currency', 'percent'].includes(colType)) alignClass = styles.alignRight;
                else if (colType === 'date') alignClass = styles.alignCenter;

                return (
                  <td key={ci} style={focusedStyle} onClick={handleCellClick}>
                    <EditableCell
                      cellId={`${ri}-${ci}`}
                      value={formatValue(cell, colType, currencyCode)}
                      onBlur={(newVal) => { updateCell(ri + 1, ci, formatValue(newVal, colType, currencyCode)); }}
                      onNavigate={(dir) => {
                        const colCount = rows[0]?.length || 0;
                        const dataRows = rows.length - 1;
                        // Enter on the last row → add a new row and focus it
                        if (dir === 'down' && ri + 1 >= dataRows && !readOnly) {
                          addRow();
                          const newRowIdx = dataRows;
                          setFocusedCell({ row: newRowIdx, col: ci });
                          setTimeout(() => {
                            const el = tableWrapperRef.current?.querySelector(`[data-cell-id="${newRowIdx}-${ci}"]`);
                            if (el) { el.focus(); try { const r=document.createRange(),s=window.getSelection(); r.selectNodeContents(el); r.collapse(false); s.removeAllRanges(); s.addRange(r); } catch(_){} }
                            else tableWrapperRef.current?.focus();
                          }, 0);
                          return;
                        }
                        let nextRow = ri, nextCol = ci;
                        if      (dir === 'down')  nextRow = Math.min(ri + 1, dataRows - 1);
                        else if (dir === 'up')    nextRow = Math.max(ri - 1, 0);
                        else if (dir === 'right') nextCol = Math.min(ci + 1, colCount - 1);
                        else if (dir === 'left')  nextCol = Math.max(ci - 1, 0);
                        setFocusedCell({ row: nextRow, col: nextCol });
                        if (dir !== 'escape') {
                          const nextEl = tableWrapperRef.current?.querySelector(`[data-cell-id="${nextRow}-${nextCol}"]`);
                          if (nextEl) {
                            nextEl.focus();
                            try { const r=document.createRange(),s=window.getSelection(); r.selectNodeContents(nextEl); r.collapse(false); s.removeAllRanges(); s.addRange(r); } catch(_){}
                          } else {
                            tableWrapperRef.current?.focus();
                          }
                        } else {
                          tableWrapperRef.current?.focus();
                        }
                      }}
                      className={`${styles.cellText} ${alignClass}`}
                      readOnly={readOnly}
                    />
                  </td>
                );
              })}
            </tr>
          ))}

          {/* Totals row */}
          {showTotals && (() => {
            const dataRows = rows.slice(1);
            const totals = (rows[0] || []).map((header, ci) => {
              const colType = columnTypes[ci] || 'text';
              const headerName = cleanText(header || '');
              if (colType === 'formula') {
                const formula = columnFormulas[ci] || '';
                const resultType = getFormulaResultType(formula, columnTypes);
                const sum = dataRows.reduce((acc, row) => { const r = evalFormula(formula, row); return acc + (r !== null ? r : 0); }, 0);
                return { value: sum, type: resultType };
              }
              const autoCheck = getAutoCalcValue(headerName, ci, dataRows[0] || [], columnTypes);
              if (autoCheck !== null) {
                const sum = dataRows.reduce((acc, row) => { const v = getAutoCalcValue(headerName, ci, row, columnTypes); return acc + (v !== null ? v : 0); }, 0);
                return { value: sum, type: colType };
              }
              if (['number', 'currency', 'percent'].includes(colType)) {
                const sum = dataRows.reduce((acc, row) => { const n = parseFloat(String(row[ci] || '').replace(/[^0-9.-]/g, '')); return acc + (isNaN(n) ? 0 : n); }, 0);
                return { value: sum, type: colType };
              }
              return null;
            });
            return (
              <tr style={{ borderTop: '2px solid rgba(48,108,236,0.30)', background: 'rgba(48,108,236,0.06)' }}>
                {/* Row handle spacer — keeps totals aligned with data rows */}
                {!readOnly && <td style={{ width: 28, minWidth: 28 }} />}
                {totals.map((tot, ci) => (
                  <td key={ci}>
                    {tot ? (
                      <div className={styles.cellText} style={{ textAlign: 'right', fontWeight: 700, color: tot.value < 0 ? '#ef4444' : '#4ade80', fontVariantNumeric: 'tabular-nums' }}>{formatResult(tot.value, tot.type, currencyCode)}</div>
                    ) : (
                      <div className={styles.cellText} style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>{ci === 0 ? 'TOTAL' : ''}</div>
                    )}
                  </td>
                ))}
              </tr>
            );
          })()}
        </tbody>
      </table>

      {/* ── Controls bar ── */}
      <div className={styles.tableControls}>
        {!readOnly && (
          <>
            <button className={styles.tableControlBtn} onClick={handleUndo} title="Undo (Ctrl+Z)" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Undo2 size={12} /></button>
            <button className={styles.tableControlBtn} onClick={handleRedo} title="Redo (Ctrl+Y)" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Redo2 size={12} /></button>
            <button className={styles.tableControlBtn} onClick={addRow}><Plus size={12} /> Row</button>
            <button className={styles.tableControlBtn} onClick={addColumn}><Plus size={12} /> Column</button>
            {rows.length > 2 && <button className={styles.tableControlBtn} onClick={() => removeRow(rows.length - 1)}><Trash2 size={12} /> Row</button>}
            {(rows[0]?.length || 0) > 1 && <button className={styles.tableControlBtn} onClick={() => removeColumn(rows[0].length - 1)}><Trash2 size={12} /> Column</button>}
          </>
        )}
        {/* Currency selector */}
        <div style={{ position: 'relative', marginLeft: 'auto' }} ref={currencyPickerRef}>
          <button
            onClick={() => setShowCurrencyPicker((v) => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 10, border: `1.5px solid ${showCurrencyPicker ? 'rgba(48,108,236,0.55)' : 'rgba(48,108,236,0.20)'}`, background: showCurrencyPicker ? 'rgba(48,108,236,0.15)' : 'rgba(255,255,255,0.03)', color: showCurrencyPicker ? '#7EB3FF' : '#6C82A3', cursor: 'pointer', fontSize: 12, fontWeight: 700, transition: 'all .15s' }}
          >
            <DollarSign size={13} />
            {getCurrencySymbol(currencyCode)} · {currencyCode}
          </button>
          {showCurrencyPicker && (
            <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, background: 'rgba(4,9,20,0.97)', border: '1px solid rgba(48,108,236,0.35)', borderRadius: 10, padding: '6px 0', minWidth: 210, zIndex: 700, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#3D5A8A', padding: '4px 14px 6px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Currency</div>
              {CURRENCIES.map((c) => (
                <button
                  key={c.code}
                  onClick={() => updateCurrencyCode(c.code)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: currencyCode === c.code ? 'rgba(48,108,236,0.15)' : 'none', border: 'none', cursor: 'pointer', padding: '6px 14px', textAlign: 'left', transition: 'background .12s' }}
                  onMouseEnter={(e) => { if (currencyCode !== c.code) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={(e) => { if (currencyCode !== c.code) e.currentTarget.style.background = 'none'; }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#7EB3FF', width: 36, flexShrink: 0 }}>{c.symbol}</span>
                  <span style={{ fontSize: 11, color: currencyCode === c.code ? '#7EB3FF' : '#B8D4FF', fontWeight: currencyCode === c.code ? 700 : 400 }}>{c.label}</span>
                  {currencyCode === c.code && <span style={{ marginLeft: 'auto', color: '#4ade80', fontSize: 11 }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className={`${styles.tableControlBtn} ${showTotals ? styles.tableControlBtnActive : ''}`} onClick={toggleTotals} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: showTotals ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.03)', border: `1.5px solid ${showTotals ? 'rgba(74,222,128,0.40)' : 'rgba(48,108,236,0.20)'}`, borderRadius: '10px', padding: '5px 12px', color: showTotals ? '#4ade80' : '#6C82A3', cursor: 'pointer', transition: 'all .15s', fontWeight: '600' }}>
          <Sigma size={13} />{showTotals ? 'Hide Totals' : 'Show Totals'}
        </button>
        <button className={`${styles.tableControlBtn} ${showChart ? styles.tableControlBtnActive : ''}`} onClick={toggleChart} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: showChart ? 'rgba(48,108,236,0.15)' : 'rgba(255,255,255,0.03)', border: `1.5px solid ${showChart ? 'rgba(91,155,255,0.40)' : 'rgba(48,108,236,0.20)'}`, borderRadius: '10px', padding: '5px 12px', color: showChart ? '#7EB3FF' : '#6C82A3', cursor: 'pointer', transition: 'all .15s', fontWeight: '600' }}>
          <BarChart2 size={13} />{showChart ? 'Hide Graph' : 'Show Graph'}
        </button>
      </div>

      {showChart && renderChart()}
    </div>
  );
}
