'use client';

import { useMemo, useState } from 'react';
import { useDatabaseStore } from '@/lib/store/useDatabaseStore';
import styles from '@/styles/database.module.css';

const CHART_COLORS = [
  '#60a5fa', '#a78bfa', '#34d399', '#fbbf24',
  '#f87171', '#f472b6', '#818cf8', '#22d3ee',
  '#fb923c', '#8b8fa3',
];

/**
 * ChartView — visual chart rendering for database data.
 * Supports bar and pie charts using pure CSS (no Recharts dependency required).
 * Falls back gracefully when Recharts isn't available.
 */
export default function ChartView() {
  const { properties, getFilteredRows } = useDatabaseStore();
  const filteredRows = getFilteredRows();

  const selectProps = properties.filter(
    (p) => p.type === 'select' || p.type === 'multi_select'
  );
  const numberProps = properties.filter((p) => p.type === 'number');

  const [groupByProp, setGroupByProp] = useState(
    selectProps[0]?.id || ''
  );
  const [valueProp, setValueProp] = useState(
    numberProps[0]?.id || ''
  );
  const [chartType, setChartType] = useState('bar');

  // Compute chart data
  const chartData = useMemo(() => {
    if (!groupByProp) return [];

    const groups = {};
    filteredRows.forEach((row) => {
      const group = String(row.cells?.[groupByProp] || 'Other');
      if (!groups[group]) {
        groups[group] = { label: group, count: 0, sum: 0 };
      }
      groups[group].count++;
      if (valueProp) {
        groups[group].sum += Number(row.cells?.[valueProp] || 0);
      }
    });

    return Object.values(groups).sort((a, b) => b.count - a.count);
  }, [filteredRows, groupByProp, valueProp]);

  const maxValue = useMemo(() => {
    const vals = chartData.map((d) => (valueProp ? d.sum : d.count));
    return Math.max(...vals, 1);
  }, [chartData, valueProp]);

  const totalValue = useMemo(
    () => chartData.reduce((acc, d) => acc + (valueProp ? d.sum : d.count), 0),
    [chartData, valueProp]
  );

  const groupProp = properties.find((p) => p.id === groupByProp);

  const getColor = (label, idx) => {
    const opt = groupProp?.config?.options?.find((o) => o.value === label);
    return opt?.color || CHART_COLORS[idx % CHART_COLORS.length];
  };

  if (selectProps.length === 0) {
    return (
      <div style={{
        padding: 'var(--space-8)',
        textAlign: 'center',
        color: 'var(--color-text-muted)',
      }}>
        <p>Chart view requires at least one <strong>Select</strong> or <strong>Multi-Select</strong> property to group data.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        marginBottom: 'var(--space-6)',
        flexWrap: 'wrap',
      }}>
        {/* Chart Type */}
        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
          {['bar', 'pie'].map((t) => (
            <button
              key={t}
              onClick={() => setChartType(t)}
              style={{
                padding: 'var(--space-1) var(--space-3)',
                fontSize: 'var(--text-xs)',
                fontWeight: chartType === t ? 'var(--font-semibold)' : 'var(--font-normal)',
                background: chartType === t ? 'var(--color-accent-primary-subtle)' : 'var(--color-bg-tertiary)',
                color: chartType === t ? 'var(--color-accent-primary)' : 'var(--color-text-tertiary)',
                border: chartType === t
                  ? '1px solid var(--color-accent-primary)'
                  : '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Group By */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-muted)',
        }}>
          Group by
          <select
            value={groupByProp}
            onChange={(e) => setGroupByProp(e.target.value)}
            style={{
              padding: '2px var(--space-2)',
              fontSize: 'var(--text-xs)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-bg-primary)',
              color: 'var(--color-text-primary)',
              outline: 'none',
            }}
          >
            {selectProps.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Value By */}
        {numberProps.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-muted)',
          }}>
            Value
            <select
              value={valueProp}
              onChange={(e) => setValueProp(e.target.value)}
              style={{
                padding: '2px var(--space-2)',
                fontSize: 'var(--text-xs)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                outline: 'none',
              }}
            >
              <option value="">Count</option>
              {numberProps.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Chart */}
      {chartType === 'bar' ? (
        <BarChart data={chartData} maxValue={maxValue} valueProp={valueProp} getColor={getColor} />
      ) : (
        <PieChart data={chartData} totalValue={totalValue} valueProp={valueProp} getColor={getColor} />
      )}
    </div>
  );
}

/** Pure-CSS Bar Chart */
function BarChart({ data, maxValue, valueProp, getColor }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-2)',
    }}>
      {data.map((item, idx) => {
        const value = valueProp ? item.sum : item.count;
        const pct = (value / maxValue) * 100;
        const color = getColor(item.label, idx);

        return (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            {/* Label */}
            <span style={{
              minWidth: '120px',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-medium)',
              color: 'var(--color-text-secondary)',
              textAlign: 'right',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {item.label}
            </span>

            {/* Bar */}
            <div style={{
              flex: 1,
              height: '28px',
              background: 'var(--color-bg-tertiary)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              position: 'relative',
            }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: color,
                  borderRadius: 'var(--radius-md)',
                  transition: 'width 0.5s ease',
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 'var(--space-2)',
                  minWidth: value > 0 ? '40px' : 0,
                }}
              >
                <span style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--font-semibold)',
                  color: 'white',
                  whiteSpace: 'nowrap',
                }}>
                  {valueProp ? value.toLocaleString() : `${value} item${value !== 1 ? 's' : ''}`}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Pure-CSS Pie/Donut Chart */
function PieChart({ data, totalValue, valueProp, getColor }) {
  let cumAngle = 0;

  const segments = data.map((item, idx) => {
    const value = valueProp ? item.sum : item.count;
    const pct = totalValue > 0 ? (value / totalValue) * 100 : 0;
    const angle = (pct / 100) * 360;
    const start = cumAngle;
    cumAngle += angle;

    return {
      ...item,
      value,
      pct,
      angle,
      start,
      color: getColor(item.label, idx),
    };
  });

  // Build conic gradient
  const gradientStops = segments
    .map((s) => `${s.color} ${s.start}deg ${s.start + s.angle}deg`)
    .join(', ');

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-8)',
      flexWrap: 'wrap',
      justifyContent: 'center',
    }}>
      {/* Donut */}
      <div style={{
        width: '220px',
        height: '220px',
        borderRadius: '50%',
        background: totalValue > 0
          ? `conic-gradient(${gradientStops})`
          : 'var(--color-bg-tertiary)',
        position: 'relative',
        boxShadow: 'var(--shadow-md)',
      }}>
        {/* Inner hole for donut */}
        <div style={{
          position: 'absolute',
          top: '25%',
          left: '25%',
          width: '50%',
          height: '50%',
          borderRadius: '50%',
          background: 'var(--color-bg-primary)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--font-bold)',
            color: 'var(--color-text-primary)',
          }}>
            {totalValue.toLocaleString()}
          </span>
          <span style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-muted)',
          }}>
            {valueProp ? 'total' : 'items'}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
      }}>
        {segments.map((s) => (
          <div
            key={s.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}
          >
            <span
              style={{
                width: '12px',
                height: '12px',
                borderRadius: 'var(--radius-full)',
                background: s.color,
                flexShrink: 0,
              }}
            />
            <span style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text-secondary)',
            }}>
              {s.label}
            </span>
            <span style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
              marginLeft: 'auto',
            }}>
              {s.value.toLocaleString()} ({s.pct.toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
