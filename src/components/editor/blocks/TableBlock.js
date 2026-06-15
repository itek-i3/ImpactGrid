'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Plus, Trash2, BarChart2, Type, Hash, DollarSign, Percent, Calendar, ChevronDown, Sigma, List, X, Pencil } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import styles from '@/styles/editor.module.css';

const COLUMN_TYPES = [
  { value: 'text',     label: 'Letters / Text', icon: Type,       description: 'Free-form text, names, descriptions' },
  { value: 'number',   label: 'Number',         icon: Hash,       description: 'Plain numbers, decimals, quantities' },
  { value: 'currency', label: 'Currency',        icon: DollarSign, description: 'USD currency formatting' },
  { value: 'percent',  label: 'Percentage',      icon: Percent,    description: 'Percentage values' },
  { value: 'date',     label: 'Date',            icon: Calendar,   description: 'Calendar date selection' },
  { value: 'formula',  label: 'Formula (auto)',  icon: Sigma,      description: 'Auto-calculated from two other columns' },
  { value: 'dropdown', label: 'Dropdown / Select', icon: List,     description: 'Pick from a fixed list of options' },
];

const BADGE_COLORS = [
  { bg: 'rgba(48,108,236,0.18)',  border: 'rgba(48,108,236,0.45)',  text: '#7EB3FF' },
  { bg: 'rgba(22,163,107,0.18)',  border: 'rgba(22,163,107,0.45)',  text: '#4ade80' },
  { bg: 'rgba(245,166,35,0.18)',  border: 'rgba(245,166,35,0.45)',  text: '#F5A623' },
  { bg: 'rgba(224,72,90,0.18)',   border: 'rgba(224,72,90,0.45)',   text: '#E0485A' },
  { bg: 'rgba(155,81,224,0.18)',  border: 'rgba(155,81,224,0.45)',  text: '#9B51E0' },
  { bg: 'rgba(57,204,204,0.18)',  border: 'rgba(57,204,204,0.45)',  text: '#39CCCC' },
  { bg: 'rgba(255,133,27,0.18)',  border: 'rgba(255,133,27,0.45)',  text: '#FF851B' },
];

const OPERATIONS = [
  { value: '-', label: 'Subtract (A − B)' },
  { value: '+', label: 'Add (A + B)' },
  { value: '*', label: 'Multiply (A × B)' },
  { value: '/', label: 'Divide (A ÷ B)' },
];

// Evaluate formula config: { colA, op, colB }
function evalFormula(config, rowValues) {
  if (!config || config.colA === undefined || config.colB === undefined) return null;
  const a = parseFloat(String(rowValues[config.colA] ?? '').replace(/[^0-9.-]/g, '')) || 0;
  const b = parseFloat(String(rowValues[config.colB] ?? '').replace(/[^0-9.-]/g, '')) || 0;
  switch (config.op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return b !== 0 ? a / b : null;
    default:  return null;
  }
}

// Auto-detect calculated columns by header name — no config needed
function getAutoCalcValue(headerName, colIndex, row, columnTypes) {
  const name = (headerName || '').toLowerCase().trim();
  const getVal = (i) => parseFloat(String(row[i] || '').replace(/[^0-9.-]/g, '')) || 0;

  // Numeric columns that come before this column
  const numericBefore = columnTypes
    .slice(0, colIndex)
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => ['number', 'currency', 'percent'].includes(t));

  if (numericBefore.length === 0) return null;

  // Variance / Difference → last numeric minus first numeric (e.g. Actual - Goal)
  if (name.includes('variance') || name.includes('difference')) {
    if (numericBefore.length >= 2) {
      return getVal(numericBefore[numericBefore.length - 1].i) - getVal(numericBefore[0].i);
    }
  }

  // Total / Sum → sum of all numeric columns before this one
  if (name.includes('total') || name.includes('sum')) {
    return numericBefore.reduce((acc, { i }) => acc + getVal(i), 0);
  }

  // Balance → same as Variance
  if (name.includes('balance')) {
    if (numericBefore.length >= 2) {
      return getVal(numericBefore[numericBefore.length - 1].i) - getVal(numericBefore[0].i);
    }
  }

  return null;
}

function formatResult(value, colType) {
  if (value === null || value === undefined) return '—';
  if (colType === 'currency') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  }
  if (colType === 'percent') return `${value}%`;
  if (colType === 'number')  return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
  return String(value);
}

const getTypeIcon = (type) => {
  switch (type) {
    case 'number':   return Hash;
    case 'currency': return DollarSign;
    case 'percent':  return Percent;
    case 'date':     return Calendar;
    case 'formula':  return Sigma;
    case 'dropdown': return List;
    default:         return Type;
  }
};

const formatValue = (value, type) => {
  if (value === undefined || value === null) return '';
  const text = String(value).trim();
  if (!text) return '';

  switch (type) {
    case 'number': {
      const cleanVal = text.replace(/[^0-9.-]/g, '');
      const numVal = parseFloat(cleanVal);
      if (isNaN(numVal)) return text;
      return numVal.toLocaleString(undefined, { maximumFractionDigits: 6 });
    }
    case 'currency': {
      const cleanVal = text.replace(/[^0-9.-]/g, '');
      const numVal = parseFloat(cleanVal);
      if (isNaN(numVal)) return text;
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numVal);
    }
    case 'percent': {
      const cleanVal = text.replace(/[^0-9.-]/g, '');
      const numVal = parseFloat(cleanVal);
      if (isNaN(numVal)) return text;
      return `${numVal}%`;
    }
    case 'date': {
      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        const parts = text.split('-');
        const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
      }
      return text;
    }
    default:
      return text;
  }
};

const EditableCell = ({ value, onBlur, className, readOnly, placeholder }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value;
    }
  }, [value]);

  return (
    <div
      ref={ref}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      onBlur={(e) => {
        if (!readOnly) {
          onBlur(e.target.innerText);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.target.blur();
        }
      }}
      className={className}
      data-placeholder={placeholder}
    />
  );
};

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
      <button
        onClick={() => { if (!readOnly) setOpen((o) => !o); }}
        style={{
          width: '100%', background: 'none', border: 'none',
          cursor: readOnly ? 'default' : 'pointer',
          padding: '5px 8px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        {value ? (
          <span style={{
            display: 'inline-block',
            background: color?.bg || 'rgba(255,255,255,0.07)',
            border: `1px solid ${color?.border || 'rgba(255,255,255,0.15)'}`,
            borderRadius: 99, padding: '2px 10px',
            fontSize: 11, fontWeight: 600, color: color?.text || '#B8D4FF',
            whiteSpace: 'nowrap',
          }}>{value}</span>
        ) : (
          <span style={{ color: '#3D5A8A', fontSize: 12 }}>—</span>
        )}
        {!readOnly && <ChevronDown size={10} style={{ color: '#3D5A8A', marginLeft: 'auto', flexShrink: 0 }} />}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 2px)', left: 0, zIndex: 999,
          background: 'rgba(4,9,20,0.97)', border: '1px solid rgba(48,108,236,0.3)',
          borderRadius: 10, padding: '4px', minWidth: 160,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)', backdropFilter: 'blur(16px)',
        }}>
          {value && (
            <button
              onClick={() => { onChange(''); setOpen(false); }}
              style={{
                width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                padding: '6px 10px', textAlign: 'left', borderRadius: 6,
                fontSize: 11, color: '#6C82A3', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <X size={10} /> Clear
            </button>
          )}
          {options.map((opt, i) => {
            const c = BADGE_COLORS[i % BADGE_COLORS.length];
            const isSelected = opt === value;
            return (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false); }}
                style={{
                  width: '100%', background: isSelected ? 'rgba(48,108,236,0.10)' : 'none',
                  border: 'none', cursor: 'pointer',
                  padding: '5px 10px', textAlign: 'left', borderRadius: 6,
                  display: 'flex', alignItems: 'center', transition: 'background .1s',
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'none'; }}
              >
                <span style={{
                  display: 'inline-block',
                  background: c.bg, border: `1px solid ${c.border}`,
                  borderRadius: 99, padding: '2px 10px',
                  fontSize: 11, fontWeight: 600, color: c.text,
                }}>{opt}</span>
              </button>
            );
          })}
          {options.length === 0 && (
            <div style={{ fontSize: 11, color: '#6C82A3', padding: '6px 10px' }}>No options defined</div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * TableBlock — simple editable table with automatic graph generation (Bar, Line, Pie).
 */
export default function TableBlock({ block, onUpdate, readOnly = false }) {
  const rows = block.content?.rows || [
    ['Header 1', 'Header 2', 'Header 3'],
    ['', '', ''],
    ['', '', ''],
  ];

  const properties = block.properties || {};
  const showChart  = properties.showChart  || false;
  const showTotals = properties.showTotals || false;
  const chartType  = properties.chartType  || 'bar';
  const columnFormulas = properties.columnFormulas || {};
  const columnOptions  = properties.columnOptions  || {};

  // Extract clean text from HTML strings
  const cleanText = (html) => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').trim();
  };

  const columnTypes = useMemo(() => {
    const stored = properties.columnTypes;
    const colCount = rows[0]?.length || 0;
    const types = Array.isArray(stored) ? [...stored] : [];
    while (types.length < colCount) {
      types.push('text');
    }
    if (types.length > colCount) {
      types.length = colCount;
    }
    return types;
  }, [properties.columnTypes, rows]);

  const [activeDropdownCol, setActiveDropdownCol] = useState(null);
  const [optionsEditorCol, setOptionsEditorCol] = useState(null);
  const [newOptionText, setNewOptionText] = useState('');
  const optionsEditorRef = useRef(null);

  useEffect(() => {
    if (optionsEditorCol === null) return;
    const close = (e) => {
      if (optionsEditorRef.current && !optionsEditorRef.current.contains(e.target)) {
        setOptionsEditorCol(null);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [optionsEditorCol]);

  // ── Derived Chart Properties ──
  const headers = useMemo(() => {
    return (rows[0] || []).map((h, i) => cleanText(h) || `Column ${i + 1}`);
  }, [rows]);

  const availableSeries = useMemo(() => {
    // Exclude auto-calculated columns (Variance, Total, Sum, Balance, Difference) from chart
    const autoCalcNames = ['variance', 'difference', 'total', 'sum', 'balance'];
    return headers.slice(1).filter((h) => {
      const lower = h.toLowerCase().trim();
      return !autoCalcNames.some((n) => lower.includes(n));
    });
  }, [headers]);

  const activeSeries = useMemo(() => {
    const stored = properties.activeSeries;
    if (Array.isArray(stored)) {
      // Filter out any active series that no longer exist in headers
      const valid = stored.filter((s) => availableSeries.includes(s));
      if (chartType === 'pie' && valid.length > 1) {
        return [valid[0]];
      }
      return valid;
    }
    return availableSeries.length > 0 ? (chartType === 'pie' ? [availableSeries[0]] : availableSeries) : [];
  }, [properties.activeSeries, availableSeries, chartType]);

  const chartData = useMemo(() => {
    const dataRows = rows.slice(1);
    return dataRows.map((row) => {
      const item = {};
      headers.forEach((header, ci) => {
        if (ci === 0) {
          item.name = cleanText(row[ci] || '') || 'Untitled';
        } else {
          const numVal = parseFloat(cleanText(row[ci] || '').replace(/[^0-9.-]/g, ''));
          item[header] = isNaN(numVal) ? 0 : numVal;
        }
      });
      return item;
    });
  }, [rows, headers]);

  // ── Callbacks ──
  const updateCell = useCallback(
    (rowIndex, colIndex, value) => {
      const newRows = rows.map((row, ri) =>
        ri === rowIndex
          ? row.map((cell, ci) => (ci === colIndex ? value : cell))
          : [...row]
      );
      onUpdate({ content: { ...block.content, rows: newRows } });
    },
    [rows, block.content, onUpdate]
  );

  const addRow = useCallback(() => {
    const cols = rows[0]?.length || 3;
    const newRows = [...rows, new Array(cols).fill('')];
    onUpdate({ content: { ...block.content, rows: newRows } });
  }, [rows, block.content, onUpdate]);

  const addColumn = useCallback(() => {
    const newRows = rows.map((row, i) => [
      ...row,
      i === 0 ? `Header ${row.length + 1}` : '',
    ]);
    const newColumnTypes = [...columnTypes, 'text'];
    onUpdate({
      content: { ...block.content, rows: newRows },
      properties: { ...properties, columnTypes: newColumnTypes }
    });
  }, [rows, columnTypes, block.content, properties, onUpdate]);

  const removeRow = useCallback(
    (index) => {
      if (rows.length <= 2) return; // Keep at least header + 1 row
      const newRows = rows.filter((_, i) => i !== index);
      onUpdate({ content: { ...block.content, rows: newRows } });
    },
    [rows, block.content, onUpdate]
  );

  const removeColumn = useCallback(
    (colIndex) => {
      if ((rows[0]?.length || 0) <= 1) return;
      const newRows = rows.map((row) => row.filter((_, ci) => ci !== colIndex));
      const newColumnTypes = columnTypes.filter((_, ci) => ci !== colIndex);
      onUpdate({
        content: { ...block.content, rows: newRows },
        properties: { ...properties, columnTypes: newColumnTypes }
      });
    },
    [rows, columnTypes, block.content, properties, onUpdate]
  );

  const handleColumnTypeChange = useCallback(
    (colIndex, newType) => {
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
            const parsedDate = new Date(text);
            if (!isNaN(parsedDate.getTime())) {
              return parsedDate.toISOString().split('T')[0];
            }
            return text;
          } else {
            const cleanVal = text.replace(/[^0-9.-]/g, '');
            const numVal = parseFloat(cleanVal);
            if (isNaN(numVal)) return text;
            
            if (newType === 'currency') {
              return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numVal);
            } else if (newType === 'percent') {
              return `${numVal}%`;
            } else if (newType === 'number') {
              return numVal.toLocaleString(undefined, { maximumFractionDigits: 6 });
            } else {
              return String(numVal);
            }
          }
        });
      });

      onUpdate({
        content: { ...block.content, rows: newRows },
        properties: {
          ...properties,
          columnTypes: newColumnTypes,
        },
      });

      // Auto-open options editor when switching to dropdown
      if (newType === 'dropdown') {
        setOptionsEditorCol(colIndex);
        setNewOptionText('');
      } else {
        setOptionsEditorCol(null);
      }
    },
    [rows, columnTypes, block.content, properties, onUpdate]
  );


  const toggleChart = useCallback(() => {
    onUpdate({ properties: { ...properties, showChart: !showChart } });
  }, [properties, showChart, onUpdate]);

  const toggleTotals = useCallback(() => {
    onUpdate({ properties: { ...properties, showTotals: !showTotals } });
  }, [properties, showTotals, onUpdate]);

  const updateFormula = useCallback((colIndex, formula) => {
    const next = { ...columnFormulas, [colIndex]: formula };
    onUpdate({ properties: { ...properties, columnFormulas: next } });
  }, [properties, columnFormulas, onUpdate]);

  const updateColumnOptions = useCallback((colIndex, opts) => {
    const next = { ...columnOptions, [colIndex]: opts };
    onUpdate({ properties: { ...properties, columnOptions: next } });
  }, [properties, columnOptions, onUpdate]);

  const handleChartTypeChange = useCallback(
    (e) => {
      const nextType = e.target.value;
      const updates = { chartType: nextType };

      if (nextType === 'pie' && activeSeries.length > 1) {
        updates.activeSeries = [activeSeries[0]];
      }

      onUpdate({
        properties: {
          ...properties,
          ...updates,
        },
      });
    },
    [properties, activeSeries, onUpdate]
  );

  const toggleSeries = useCallback(
    (seriesName) => {
      let newActive;
      if (chartType === 'pie') {
        newActive = [seriesName];
      } else {
        if (activeSeries.includes(seriesName)) {
          newActive = activeSeries.filter((s) => s !== seriesName);
        } else {
          newActive = [...activeSeries, seriesName];
        }
      }
      onUpdate({
        properties: {
          ...properties,
          activeSeries: newActive,
        },
      });
    },
    [properties, activeSeries, chartType, onUpdate]
  );

  const seriesColors  = ['#306CEC', '#F5A623', '#16A36B', '#E0485A', '#9B51E0', '#39CCCC', '#FF851B', '#5B9BFF'];
  const glowColors    = ['rgba(48,108,236,0.4)', 'rgba(245,166,35,0.4)', 'rgba(22,163,107,0.4)', 'rgba(224,72,90,0.4)', 'rgba(155,81,224,0.4)', 'rgba(57,204,204,0.4)'];
  const gradientLight = ['rgba(48,108,236,0.15)', 'rgba(245,166,35,0.15)', 'rgba(22,163,107,0.15)', 'rgba(224,72,90,0.15)', 'rgba(155,81,224,0.15)', 'rgba(57,204,204,0.15)'];

  const renderChart = () => {
    const manyPoints = chartData.length > 6;
    const hasCurrency = activeSeries.some((s) => {
      const idx = headers.indexOf(s);
      return idx >= 0 && (columnTypes[idx] === 'currency');
    });

    const yFormatter = (v) => {
      if (!hasCurrency) return v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v;
      if (Math.abs(v) >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
      if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(0)}K`;
      return `$${v}`;
    };

    const tooltipFormatter = (value, name) => {
      const idx = headers.indexOf(name);
      const t = idx >= 0 ? (columnTypes[idx] || 'text') : 'text';
      if (t === 'currency') return [new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value), name];
      if (t === 'percent') return [`${value}%`, name];
      return [value.toLocaleString(), name];
    };

    const tooltipStyle = {
      background: 'rgba(4, 9, 20, 0.97)',
      border: '1px solid rgba(48,108,236,0.35)',
      borderRadius: 10,
      fontSize: 12,
      color: '#E2EEFF',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    };

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

    // SVG gradient defs for bar/area fills
    const gradientDefs = (
      <defs>
        {activeSeries.map((_, i) => {
          const id = `grad-${block.id}-${i}`;
          const color = seriesColors[i % seriesColors.length];
          return (
            <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.95} />
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
                      <radialGradient key={i} id={`piegrad-${block.id}-${i}`} cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor={color} stopOpacity={1} />
                        <stop offset="100%" stopColor={color} stopOpacity={0.7} />
                      </radialGradient>
                    );
                  })}
                </defs>
                <Pie
                  data={pieData} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" outerRadius={120} innerRadius={55}
                  paddingAngle={3} strokeWidth={0}
                  label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                  labelLine={false}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={`url(#piegrad-${block.id}-${i})`}
                      style={{ filter: `drop-shadow(0 0 6px ${glowColors[i % glowColors.length]})` }}
                    />
                  ))}
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
    const bottomMargin = manyPoints ? 60 : 12;

    return (
      <div className={styles.chartSection}>
        <div className={styles.chartHeader}>{chartControls}</div>
        <div className={styles.chartContainer}>
          <ResponsiveContainer width="100%" height={340}>
            <ChartComponent data={chartData} margin={{ top: 20, right: 24, left: 10, bottom: bottomMargin }}>
              {gradientDefs}
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="transparent"
                tick={{ fill: '#6C82A3', fontSize: 11, fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
                angle={manyPoints ? -40 : 0}
                textAnchor={manyPoints ? 'end' : 'middle'}
                interval={0}
                dy={manyPoints ? 4 : 0}
              />
              <YAxis
                stroke="transparent"
                tick={{ fill: '#6C82A3', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={yFormatter}
                width={58}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={tooltipFormatter}
                cursor={{ fill: 'rgba(48,108,236,0.06)', stroke: 'rgba(48,108,236,0.2)', strokeWidth: 1, rx: 4 }}
              />
              <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12, color: '#B8D4FF', paddingTop: 12 }} />
              {activeSeries.map((series, index) => {
                const color = seriesColors[index % seriesColors.length];
                const gradId = `url(#grad-${block.id}-${index})`;
                if (chartType === 'bar') {
                  return (
                    <Bar key={series} dataKey={series} fill={gradId} radius={[6, 6, 0, 0]} maxBarSize={52}
                      style={{ filter: `drop-shadow(0 4px 8px ${glowColors[index % glowColors.length]})` }}
                    />
                  );
                }
                return (
                  <Line key={series} type="monotone" dataKey={series} stroke={color} strokeWidth={3}
                    dot={{ r: 4, fill: color, strokeWidth: 2, stroke: 'rgba(4,9,20,0.8)' }}
                    activeDot={{ r: 6, fill: color, stroke: 'rgba(255,255,255,0.3)', strokeWidth: 2 }}
                    style={{ filter: `drop-shadow(0 0 6px ${glowColors[index % glowColors.length]})` }}
                  />
                );
              })}
            </ChartComponent>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
    <div className={`${styles.tableBlock} ${!readOnly ? styles.editMode : ''}`}>
      <table className={styles.table}>
        <thead>
          <tr>
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
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdownCol(activeDropdownCol === ci ? null : ci);
                          }}
                          title={`Change column type (current: ${colType})`}
                        >
                          <IconComponent size={13} className={styles.typeIcon} />
                          <ChevronDown size={8} className={styles.chevronIcon} />
                        </button>
                        
                        {activeDropdownCol === ci && (
                          <>
                            <div
                              className={styles.dropdownBackdrop}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdownCol(null);
                              }}
                            />
                            <div className={styles.columnTypeMenu}>
                              <div className={styles.menuHeader}>Column Data Type</div>
                              {COLUMN_TYPES.map((t) => {
                                const TypeIcon = t.icon;
                                const isSelected = colType === t.value;
                                return (
                                  <button
                                    key={t.value}
                                    className={`${styles.columnTypeMenuItem} ${isSelected ? styles.menuItemActive : ''}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleColumnTypeChange(ci, t.value);
                                      setActiveDropdownCol(null);
                                    }}
                                  >
                                    <TypeIcon size={14} className={styles.menuItemIcon} />
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
                          {/* Pencil icon to open options editor for dropdown columns */}
                          {colType === 'dropdown' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setOptionsEditorCol(optionsEditorCol === ci ? null : ci); setNewOptionText(''); }}
                              title="Edit options"
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: 20, height: 20, borderRadius: 5, border: 'none', cursor: 'pointer',
                                background: optionsEditorCol === ci ? 'rgba(48,108,236,0.25)' : 'rgba(255,255,255,0.05)',
                                color: optionsEditorCol === ci ? '#7EB3FF' : '#6C82A3',
                                transition: 'all .15s', flexShrink: 0, marginLeft: 2,
                              }}
                            >
                              <Pencil size={10} />
                            </button>
                          )}
                        </div>

                        {/* Options editor panel for dropdown columns */}
                        {colType === 'dropdown' && optionsEditorCol === ci && (() => {
                          const opts = columnOptions[ci] || [];
                          return (
                            <div ref={optionsEditorRef} className={styles.columnTypeMenu} style={{ top: 'calc(100% + 4px)', minWidth: 230, zIndex: 601 }}>
                                <div className={styles.menuHeader} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span>Dropdown Options</span>
                                  <button onClick={() => setOptionsEditorCol(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6C82A3', display: 'flex', padding: 2 }}>
                                    <X size={12} />
                                  </button>
                                </div>

                                {opts.length === 0 && (
                                  <div style={{ fontSize: 11, color: '#6C82A3', padding: '4px 12px 2px' }}>Type an option and press Enter</div>
                                )}

                                <div style={{ maxHeight: 180, overflowY: 'auto', padding: '2px 0' }}>
                                  {opts.map((opt, oi) => {
                                    const c = BADGE_COLORS[oi % BADGE_COLORS.length];
                                    return (
                                      <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px' }}>
                                        <span style={{
                                          flex: 1,
                                          background: c.bg, border: `1px solid ${c.border}`,
                                          borderRadius: 99, padding: '2px 10px',
                                          fontSize: 11, fontWeight: 600, color: c.text,
                                        }}>{opt}</span>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); updateColumnOptions(ci, opts.filter((_, i) => i !== oi)); }}
                                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6C82A3', display: 'flex', padding: 2, flexShrink: 0 }}
                                        >
                                          <X size={12} />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>

                                <div style={{ borderTop: '1px solid rgba(48,108,236,0.15)', padding: '8px 10px', display: 'flex', gap: 6 }}>
                                  <input
                                    type="text"
                                    placeholder="New option…"
                                    autoFocus
                                    value={newOptionText}
                                    onChange={(e) => setNewOptionText(e.target.value)}
                                    onKeyDown={(e) => {
                                      e.stopPropagation();
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const val = newOptionText.trim();
                                        if (val && !opts.includes(val)) updateColumnOptions(ci, [...opts, val]);
                                        setNewOptionText('');
                                      }
                                      if (e.key === 'Escape') setOptionsEditorCol(null);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                      flex: 1, fontSize: 11,
                                      background: 'rgba(255,255,255,0.05)',
                                      border: '1px solid rgba(48,108,236,0.3)', borderRadius: 7,
                                      color: '#E2EEFF', padding: '5px 9px', outline: 'none', minWidth: 0,
                                    }}
                                  />
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const val = newOptionText.trim();
                                      if (val && !opts.includes(val)) updateColumnOptions(ci, [...opts, val]);
                                      setNewOptionText('');
                                    }}
                                    style={{
                                      fontSize: 12, fontWeight: 700,
                                      background: 'rgba(48,108,236,0.3)', border: '1px solid rgba(48,108,236,0.5)',
                                      borderRadius: 7, color: '#7EB3FF', padding: '5px 12px', cursor: 'pointer',
                                    }}
                                  >Add</button>
                                </div>
                            </div>
                          );
                        })()}

                        {/* Formula config — pick two columns and an operation */}
                        {colType === 'formula' && (() => {
                          const cfg = columnFormulas[ci] || {};
                          const selectStyle = {
                            fontSize: 9, background: 'rgba(48,108,236,0.10)',
                            border: '1px solid rgba(48,108,236,0.25)', borderRadius: 4,
                            color: '#7EB3FF', padding: '2px 4px', outline: 'none',
                            cursor: 'pointer', maxWidth: 80,
                          };
                          const colOptions = (rows[0] || []).map((h, i) => i !== ci ? (
                            <option key={i} value={i}>{h || `Col ${i + 1}`}</option>
                          ) : null);
                          return (
                            <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginTop: 2 }}>
                              <select style={selectStyle} value={cfg.colA ?? ''} onChange={e => updateFormula(ci, { ...cfg, colA: parseInt(e.target.value) })}>
                                <option value="">Col A</option>
                                {colOptions}
                              </select>
                              <select style={selectStyle} value={cfg.op || '-'} onChange={e => updateFormula(ci, { ...cfg, op: e.target.value })}>
                                {OPERATIONS.map(o => <option key={o.value} value={o.value}>{o.value}</option>)}
                              </select>
                              <select style={selectStyle} value={cfg.colB ?? ''} onChange={e => updateFormula(ci, { ...cfg, colB: parseInt(e.target.value) })}>
                                <option value="">Col B</option>
                                {colOptions}
                              </select>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    <EditableCell
                      value={cell}
                      onBlur={(text) => updateCell(0, ci, text)}
                      className={styles.headerText}
                      readOnly={readOnly}
                      placeholder="Column"
                    />
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.slice(1).map((row, ri) => (
            <tr key={ri + 1}>
              {row.map((cell, ci) => {
                const colType = columnTypes[ci] || 'text';

                // Formula columns — auto-computed, read-only
                if (colType === 'formula') {
                  const formula = columnFormulas[ci] || '';
                  const result = evalFormula(formula, row);
                  const display = result !== null ? formatResult(result, 'currency') : (formula ? '…' : '—');
                  const isNeg = result !== null && result < 0;
                  return (
                    <td key={ci}>
                      <div className={styles.cellText} style={{
                        textAlign: 'right', color: isNeg ? '#ef4444' : '#4ade80',
                        fontVariantNumeric: 'tabular-nums', fontWeight: 600,
                      }}>
                        {display}
                      </div>
                    </td>
                  );
                }

                // Auto-detect by column name (Variance, Total, Sum, Balance) — no setup needed
                const headerName = cleanText(rows[0]?.[ci] || '');
                const autoVal = getAutoCalcValue(headerName, ci, row, columnTypes);
                if (autoVal !== null) {
                  const isNeg = autoVal < 0;
                  return (
                    <td key={ci}>
                      <div className={styles.cellText} style={{
                        textAlign: 'right', color: isNeg ? '#ef4444' : '#4ade80',
                        fontVariantNumeric: 'tabular-nums', fontWeight: 600,
                      }}>
                        {formatResult(autoVal, colType)}
                      </div>
                    </td>
                  );
                }

                // Dropdown columns — render a custom badge dropdown
                if (colType === 'dropdown') {
                  const opts = columnOptions[ci] || [];
                  return (
                    <td key={ci} style={{ padding: 0 }}>
                      <DropdownCell
                        value={cell || ''}
                        options={opts}
                        onChange={(val) => updateCell(ri + 1, ci, val)}
                        readOnly={readOnly}
                      />
                    </td>
                  );
                }

                // If Date and editing, render a native date input
                if (!readOnly && colType === 'date') {
                  return (
                    <td key={ci}>
                      <input
                        type="date"
                        value={cell || ''}
                        onChange={(e) => updateCell(ri + 1, ci, e.target.value)}
                        className={styles.dateCellInput}
                      />
                    </td>
                  );
                }

                // Determine alignment style
                let alignClass = styles.alignLeft;
                if (colType === 'number' || colType === 'currency' || colType === 'percent') {
                  alignClass = styles.alignRight;
                } else if (colType === 'date') {
                  alignClass = styles.alignCenter;
                }

                const displayVal = formatValue(cell, colType);

                return (
                  <td key={ci}>
                    <EditableCell
                      value={displayVal}
                      onBlur={(newVal) => {
                        const formatted = formatValue(newVal, colType);
                        updateCell(ri + 1, ci, formatted);
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
                const sum = dataRows.reduce((acc, row) => {
                  const r = evalFormula(formula, row);
                  return acc + (r !== null ? r : 0);
                }, 0);
                return { value: sum, type: 'currency' };
              }

              // Auto-calc columns (Variance, Total, etc.)
              const autoCheck = getAutoCalcValue(headerName, ci, dataRows[0] || [], columnTypes);
              if (autoCheck !== null) {
                const sum = dataRows.reduce((acc, row) => {
                  const v = getAutoCalcValue(headerName, ci, row, columnTypes);
                  return acc + (v !== null ? v : 0);
                }, 0);
                return { value: sum, type: colType };
              }

              if (['number', 'currency', 'percent'].includes(colType)) {
                const sum = dataRows.reduce((acc, row) => {
                  const raw = String(row[ci] || '').replace(/[^0-9.-]/g, '');
                  const n = parseFloat(raw);
                  return acc + (isNaN(n) ? 0 : n);
                }, 0);
                return { value: sum, type: colType };
              }
              return null;
            });
            return (
              <tr style={{ borderTop: '2px solid rgba(48,108,236,0.30)', background: 'rgba(48,108,236,0.06)' }}>
                {totals.map((tot, ci) => (
                  <td key={ci}>
                    {tot ? (
                      <div className={styles.cellText} style={{
                        textAlign: 'right', fontWeight: 700,
                        color: tot.value < 0 ? '#ef4444' : '#4ade80',
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {formatResult(tot.value, tot.type)}
                      </div>
                    ) : (
                      <div className={styles.cellText} style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>
                        {ci === 0 ? 'TOTAL' : ''}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            );
          })()}
        </tbody>
      </table>

      <div className={styles.tableControls}>
        {!readOnly && (
          <>
            <button className={styles.tableControlBtn} onClick={addRow}>
              <Plus size={12} /> Row
            </button>
            <button className={styles.tableControlBtn} onClick={addColumn}>
              <Plus size={12} /> Column
            </button>
            {rows.length > 2 && (
              <button
                className={styles.tableControlBtn}
                onClick={() => removeRow(rows.length - 1)}
              >
                <Trash2 size={12} /> Row
              </button>
            )}
            {(rows[0]?.length || 0) > 1 && (
              <button
                className={styles.tableControlBtn}
                onClick={() => removeColumn(rows[0].length - 1)}
              >
                <Trash2 size={12} /> Column
              </button>
            )}
          </>
        )}
        <button
          className={`${styles.tableControlBtn} ${showTotals ? styles.tableControlBtnActive : ''}`}
          onClick={toggleTotals}
          style={{
            marginLeft: 'auto',
            display: 'flex', alignItems: 'center', gap: '6px',
            background: showTotals ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.03)',
            border: `1.5px solid ${showTotals ? 'rgba(74,222,128,0.40)' : 'rgba(48,108,236,0.20)'}`,
            borderRadius: '10px', padding: '5px 12px',
            color: showTotals ? '#4ade80' : '#6C82A3',
            cursor: 'pointer', transition: 'all .15s', fontWeight: '600',
          }}
        >
          <Sigma size={13} />
          {showTotals ? 'Hide Totals' : 'Show Totals'}
        </button>
        <button
          className={`${styles.tableControlBtn} ${showChart ? styles.tableControlBtnActive : ''}`}
          onClick={toggleChart}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: showChart ? 'rgba(48, 108, 236, 0.15)' : 'rgba(255,255,255,0.03)',
            border: `1.5px solid ${showChart ? 'rgba(91,155,255,0.40)' : 'rgba(48,108,236,0.20)'}`,
            borderRadius: '10px', padding: '5px 12px',
            color: showChart ? '#7EB3FF' : '#6C82A3',
            cursor: 'pointer', transition: 'all .15s', fontWeight: '600',
          }}
        >
          <BarChart2 size={13} />
          {showChart ? 'Hide Graph' : 'Show Graph'}
        </button>
      </div>

      {showChart && renderChart()}
    </div>
  );
}
