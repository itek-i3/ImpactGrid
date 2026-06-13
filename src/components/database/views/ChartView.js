'use client';

import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { useDatabaseStore } from '@/lib/store/useDatabaseStore';

const PIE_COLORS = [
  '#4F8EF7','#F5A623','#22D3A0','#A78BFA','#22D3EE','#FB7185','#FCD34D',
  '#60a5fa','#34d399','#fb923c',
];

const chartAxis = {
  fontSize: 11,
  fill: '#3D5A8A',
  fontFamily: "'JetBrains Mono', monospace",
};

const ttStyle = {
  contentStyle: {
    background: '#0a1628',
    border: '1px solid rgba(48,108,236,0.35)',
    borderRadius: 12,
    fontSize: 12,
    fontFamily: "'JetBrains Mono', monospace",
    boxShadow: '0 16px 48px rgba(0,0,0,.70)',
    padding: '10px 14px',
  },
  labelStyle:  { color: '#E2EEFF', fontWeight: 700, marginBottom: 4 },
  itemStyle:   { color: '#fff' },
};

/* ── 3D bar shape ── */
function Bar3D({ x, y, width, height, value, fill }) {
  if (!height || height <= 0 || !value) return null;
  const depth = Math.min(width * 0.65, 22);
  const rise  = depth * 0.52;
  const top  = `${x},${y} ${x+depth},${y-rise} ${x+width+depth},${y-rise} ${x+width},${y}`;
  const side = `${x+width},${y} ${x+width+depth},${y-rise} ${x+width+depth},${y+height-rise} ${x+width},${y+height}`;
  return (
    <g>
      <ellipse cx={x+width/2+depth/2} cy={y+height+4} rx={width*0.55} ry={4} fill="rgba(48,108,236,0.22)" />
      <rect x={x} y={y} width={width} height={height} fill="url(#cvBar3D)" rx={2} />
      <polygon points={top} fill="rgba(160,210,255,0.62)" />
      <polygon points={side} fill="rgba(4,12,40,0.82)" />
      <line x1={x} y1={y} x2={x+width} y2={y} stroke="rgba(255,255,255,0.40)" strokeWidth={1.2} />
      <rect x={x+2} y={y+2} width={width-4} height={Math.min(height*0.18, 9)} fill="rgba(255,255,255,0.16)" rx={1.5} />
    </g>
  );
}

export default function ChartView() {
  const { properties, getFilteredRows } = useDatabaseStore();
  const filteredRows = getFilteredRows();

  const selectProps = properties.filter((p) => p.type === 'select' || p.type === 'multi_select');
  const numberProps = properties.filter((p) => p.type === 'number');

  const [groupByProp, setGroupByProp] = useState(selectProps[0]?.id || '');
  const [valueProp, setValueProp]     = useState(numberProps[0]?.id || '');
  const [chartType, setChartType]     = useState('bar');

  const chartData = useMemo(() => {
    if (!groupByProp) return [];
    const groups = {};
    filteredRows.forEach((row) => {
      const group = String(row.cells?.[groupByProp] || 'Other');
      if (!groups[group]) groups[group] = { label: group, count: 0, sum: 0 };
      groups[group].count++;
      if (valueProp) groups[group].sum += Number(row.cells?.[valueProp] || 0);
    });
    return Object.values(groups).sort((a, b) => b.count - a.count);
  }, [filteredRows, groupByProp, valueProp]);

  const groupProp = properties.find((p) => p.id === groupByProp);
  const getColor  = (label, idx) => {
    const opt = groupProp?.config?.options?.find((o) => o.value === label);
    return opt?.color || PIE_COLORS[idx % PIE_COLORS.length];
  };

  const rechartsData = chartData.map((d) => ({
    name:  d.label,
    value: valueProp ? d.sum : d.count,
  }));

  if (selectProps.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#3D5A8A', fontSize: 13 }}>
        Chart view requires at least one <strong style={{ color: '#7EB3FF' }}>Select</strong> or <strong style={{ color: '#7EB3FF' }}>Multi-Select</strong> property to group data.
      </div>
    );
  }

  const selBtn = (active) => ({
    padding: '4px 14px',
    fontSize: 11,
    fontWeight: active ? 700 : 500,
    background: active ? 'rgba(48,108,236,0.18)' : 'transparent',
    color: active ? '#7EB3FF' : '#3D5A8A',
    border: active ? '1px solid rgba(48,108,236,0.40)' : '1px solid rgba(48,108,236,0.12)',
    borderRadius: 8,
    cursor: 'pointer',
    textTransform: 'capitalize',
    transition: '.15s',
  });

  const selStyle = {
    padding: '4px 10px',
    fontSize: 11,
    border: '1px solid rgba(48,108,236,0.20)',
    borderRadius: 7,
    background: '#0d1b38',
    color: '#7EB3FF',
    outline: 'none',
    cursor: 'pointer',
  };

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['bar', 'pie'].map((t) => (
            <button key={t} onClick={() => setChartType(t)} style={selBtn(chartType === t)}>{t}</button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#3D5A8A' }}>
          Group by
          <select value={groupByProp} onChange={(e) => setGroupByProp(e.target.value)} style={selStyle}>
            {selectProps.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {numberProps.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#3D5A8A' }}>
            Value
            <select value={valueProp} onChange={(e) => setValueProp(e.target.value)} style={selStyle}>
              <option value="">Count</option>
              {numberProps.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Chart */}
      {chartType === 'bar' ? (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={rechartsData} margin={{ top: 18, right: 32, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="cvBar3D" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#7EC4FF" stopOpacity={1} />
                <stop offset="50%"  stopColor="#306CEC" stopOpacity={1} />
                <stop offset="100%" stopColor="#1A3A88" stopOpacity={1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(48,108,236,0.10)" vertical={false} />
            <XAxis dataKey="name" tick={chartAxis} axisLine={false} tickLine={false} />
            <YAxis tick={chartAxis} axisLine={false} tickLine={false} />
            <Tooltip {...ttStyle} cursor={{ fill: 'transparent' }} />
            <Bar dataKey="value" maxBarSize={52} shape={<Bar3D />} activeBar={false} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <Chart3DPie data={chartData} valueProp={valueProp} getColor={getColor} />
      )}
    </div>
  );
}

function Chart3DPie({ data, valueProp, getColor }) {
  const total = data.reduce((s, d) => s + (valueProp ? d.sum : d.count), 0);
  const pieData = data.map((d, i) => ({
    name:  d.label,
    value: valueProp ? d.sum : d.count,
    color: getColor(d.label, i),
  }));

  const customLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.04) return null;
    const r   = innerRadius + (outerRadius - innerRadius) * 0.55;
    const rad = (midAngle * Math.PI) / 180;
    return (
      <text
        x={cx - r * Math.cos(rad)}
        y={cy - r * Math.sin(rad)}
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fontSize: 11, fill: '#fff', fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}
      >
        {(percent * 100).toFixed(0)}%
      </text>
    );
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 40, flexWrap: 'wrap', justifyContent: 'center' }}>
      <ResponsiveContainer width={240} height={240}>
        <PieChart>
          <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={110}
            dataKey="value" labelLine={false} label={customLabel}
            stroke="rgba(0,0,0,0.40)" strokeWidth={1.5}>
            {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Pie>
          <Tooltip {...ttStyle} />
        </PieChart>
      </ResponsiveContainer>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {pieData.map((s) => (
          <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#7EB3FF' }}>{s.name}</span>
            <span style={{ fontSize: 11, color: '#3D5A8A', marginLeft: 'auto', paddingLeft: 16, fontFamily: "'JetBrains Mono',monospace" }}>
              {s.value.toLocaleString()} ({total > 0 ? ((s.value/total)*100).toFixed(1) : 0}%)
            </span>
          </div>
        ))}
        <div style={{ fontSize: 11, color: '#3D5A8A', marginTop: 4, paddingTop: 8, borderTop: '1px solid rgba(48,108,236,0.15)', fontFamily: "'JetBrains Mono',monospace" }}>
          Total: <strong style={{ color: '#7EB3FF' }}>{total.toLocaleString()}</strong>
        </div>
      </div>
    </div>
  );
}
