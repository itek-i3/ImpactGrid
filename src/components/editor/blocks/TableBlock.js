'use client';

import { useState, useCallback, useMemo } from 'react';
import { Plus, Trash2, BarChart2 } from 'lucide-react';
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
  const showChart = properties.showChart || false;
  const chartType = properties.chartType || 'bar';

  // Extract clean text from HTML strings
  const cleanText = (html) => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').trim();
  };

  // ── Derived Chart Properties ──
  const headers = useMemo(() => {
    return (rows[0] || []).map((h, i) => cleanText(h) || `Column ${i + 1}`);
  }, [rows]);

  const availableSeries = useMemo(() => {
    return headers.slice(1);
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
        const cellValue = cleanText(row[ci] || '');
        if (ci === 0) {
          item.name = cellValue || 'Untitled';
        } else {
          // Parse numerical value, removing currency symbols, commas, and other texts
          const numVal = parseFloat(cellValue.replace(/[^0-9.-]/g, ''));
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
    onUpdate({ content: { ...block.content, rows: newRows } });
  }, [rows, block.content, onUpdate]);

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
      onUpdate({ content: { ...block.content, rows: newRows } });
    },
    [rows, block.content, onUpdate]
  );

  const toggleChart = useCallback(() => {
    onUpdate({
      properties: {
        ...properties,
        showChart: !showChart,
      },
    });
  }, [properties, showChart, onUpdate]);

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

  // Colors palette for chart series
  const seriesColors = ['#306CEC', '#5B9BFF', '#F5A623', '#16A36B', '#E0485A', '#9B51E0', '#FF851B', '#39CCCC'];

  const renderChart = () => {
    if (chartType === 'pie') {
      const selectedSeries = activeSeries[0] || availableSeries[0];
      const pieData = chartData.map((item) => ({
        name: item.name,
        value: item[selectedSeries] || 0,
      }));

      return (
        <div className={styles.chartSection}>
          <div className={styles.chartHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#B8D4FF' }}>Graph Type:</span>
              <select
                value={chartType}
                onChange={handleChartTypeChange}
                disabled={readOnly}
                className={styles.chartSelect}
              >
                <option value="bar">Bar Chart</option>
                <option value="line">Line Chart</option>
                <option value="pie">Pie Chart</option>
              </select>
            </div>

            {!readOnly && availableSeries.length > 0 && (
              <div className={styles.chartCheckboxGroup}>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: '600' }}>Active Column:</span>
                {availableSeries.map((series) => (
                  <label key={series} className={styles.chartCheckboxLabel}>
                    <input
                      type="radio"
                      name={`pie-series-${block.id}`}
                      checked={activeSeries.includes(series)}
                      onChange={() => toggleSeries(series)}
                      style={{ accentColor: 'var(--color-accent-primary)', cursor: 'pointer' }}
                    />
                    <span>{series}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#306CEC"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  style={{ fontSize: '10px', fill: '#B8D4FF' }}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={seriesColors[index % seriesColors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'rgba(5, 12, 24, 0.95)',
                    border: '1px solid rgba(48, 108, 236, 0.3)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#E2EEFF'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    // Default: Bar Chart or Line Chart
    let ChartComponent = BarChart;
    if (chartType === 'line') {
      ChartComponent = LineChart;
    }

    return (
      <div className={styles.chartSection}>
        <div className={styles.chartHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#B8D4FF' }}>Graph Type:</span>
            <select
              value={chartType}
              onChange={handleChartTypeChange}
              disabled={readOnly}
              className={styles.chartSelect}
            >
              <option value="bar">Bar Chart</option>
              <option value="line">Line Chart</option>
              <option value="pie">Pie Chart</option>
            </select>
          </div>

          {!readOnly && availableSeries.length > 0 && (
            <div className={styles.chartCheckboxGroup}>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: '600' }}>Active Series:</span>
              {availableSeries.map((series) => (
                <label key={series} className={styles.chartCheckboxLabel}>
                  <input
                    type="checkbox"
                    checked={activeSeries.includes(series)}
                    onChange={() => toggleSeries(series)}
                    style={{ accentColor: 'var(--color-accent-primary)', cursor: 'pointer' }}
                  />
                  <span>{series}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className={styles.chartContainer}>
          <ResponsiveContainer width="100%" height={260}>
            <ChartComponent data={chartData} margin={{ top: 15, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.06)" />
              <XAxis
                dataKey="name"
                stroke="#6C82A3"
                fontSize={11}
                tickLine={false}
              />
              <YAxis
                stroke="#6C82A3"
                fontSize={11}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(5, 12, 24, 0.95)',
                  border: '1px solid rgba(48, 108, 236, 0.3)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#E2EEFF'
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px', color: '#B8D4FF' }} />
              {activeSeries.map((series, index) => {
                const color = seriesColors[index % seriesColors.length];
                if (chartType === 'bar') {
                  return <Bar key={series} dataKey={series} fill={color} radius={[4, 4, 0, 0]} />;
                } else if (chartType === 'line') {
                  return <Line key={series} type="monotone" dataKey={series} stroke={color} strokeWidth={2} activeDot={{ r: 6 }} />;
                }
                return null;
              })}
            </ChartComponent>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.tableBlock}>
      <table className={styles.table}>
        <thead>
          <tr>
            {rows[0]?.map((cell, ci) => (
              <th
                key={ci}
                contentEditable={!readOnly}
                suppressContentEditableWarning
                onBlur={(e) => !readOnly && updateCell(0, ci, e.target.innerText)}
                dangerouslySetInnerHTML={{ __html: cell }}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(1).map((row, ri) => (
            <tr key={ri + 1}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  contentEditable={!readOnly}
                  suppressContentEditableWarning
                  onBlur={(e) => !readOnly && updateCell(ri + 1, ci, e.target.innerText)}
                  dangerouslySetInnerHTML={{ __html: cell }}
                />
              ))}
            </tr>
          ))}
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
          className={`${styles.tableControlBtn} ${showChart ? styles.tableControlBtnActive : ''}`}
          onClick={toggleChart}
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: showChart ? 'rgba(48, 108, 236, 0.15)' : 'rgba(255,255,255,0.03)',
            border: `1.5px solid ${showChart ? 'rgba(91,155,255,0.40)' : 'rgba(48,108,236,0.20)'}`,
            borderRadius: '10px',
            padding: '5px 12px',
            color: showChart ? '#7EB3FF' : '#6C82A3',
            cursor: 'pointer',
            transition: 'all .15s',
            fontWeight: '600',
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
