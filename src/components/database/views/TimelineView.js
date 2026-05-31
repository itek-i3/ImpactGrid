'use client';

import { useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { useDatabaseStore } from '@/lib/store/useDatabaseStore';
import styles from '@/styles/database.module.css';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const BAR_COLORS = [
  '#60a5fa', '#a78bfa', '#34d399', '#fbbf24',
  '#f87171', '#f472b6', '#818cf8', '#22d3ee',
  '#fb923c', '#8b8fa3',
];

/**
 * TimelineView — horizontal Gantt-style timeline for database items.
 * Plots items by date property across a month grid.
 */
export default function TimelineView() {
  const { properties, getFilteredRows } = useDatabaseStore();
  const filteredRows = getFilteredRows();

  const nameProp = properties.find((p) => p.sortOrder === 0) || properties[0];
  const dateProp = properties.find((p) => p.type === 'date');
  const statusProp = properties.find((p) => p.name === 'Status' || p.type === 'select');

  const [monthOffset, setMonthOffset] = useState(0);

  // Current visible month
  const baseDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Parse row dates
  const timelineItems = useMemo(() => {
    if (!dateProp) return [];

    return filteredRows
      .map((row, idx) => {
        const dateVal = row.cells?.[dateProp.id];
        if (!dateVal) return null;

        const date = new Date(dateVal);
        if (isNaN(date.getTime())) return null;

        const name = row.cells?.[nameProp?.id] || 'Untitled';
        const status = statusProp ? row.cells?.[statusProp.id] : null;
        const statusOpt = statusProp?.config?.options?.find((o) => o.value === status);

        return {
          id: row.id,
          name,
          date,
          day: date.getDate(),
          month: date.getMonth(),
          year: date.getFullYear(),
          color: statusOpt?.color || BAR_COLORS[idx % BAR_COLORS.length],
          status,
        };
      })
      .filter(Boolean);
  }, [filteredRows, dateProp, nameProp, statusProp]);

  // Items visible in current month
  const visibleItems = timelineItems.filter(
    (item) => item.month === month && item.year === year
  );

  // Day columns
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  if (!dateProp) {
    return (
      <div style={{
        padding: 'var(--space-8)',
        textAlign: 'center',
        color: 'var(--color-text-muted)',
      }}>
        <p>Timeline view requires a <strong>Date</strong> property.</p>
        <p style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-2)' }}>
          Add a date-type column to your database to use this view.
        </p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Navigation */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--space-4)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}>
          <button
            onClick={() => setMonthOffset(monthOffset - 1)}
            className={styles.calendarNavBtn}
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 'var(--font-semibold)',
            color: 'var(--color-text-primary)',
            minWidth: '160px',
            textAlign: 'center',
          }}>
            {MONTH_NAMES[month]} {year}
          </span>
          <button
            onClick={() => setMonthOffset(monthOffset + 1)}
            className={styles.calendarNavBtn}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <button
          onClick={() => setMonthOffset(0)}
          style={{
            padding: 'var(--space-1) var(--space-3)',
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--font-medium)',
            background: 'var(--color-bg-tertiary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
          }}
        >
          Today
        </button>
      </div>

      {/* Timeline Grid */}
      <div style={{
        overflowX: 'auto',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
      }}>
        {/* Day headers */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-bg-tertiary)',
          position: 'sticky',
          top: 0,
          zIndex: 2,
        }}>
          {/* Name column header */}
          <div style={{
            minWidth: '180px',
            maxWidth: '180px',
            padding: 'var(--space-2) var(--space-3)',
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--font-semibold)',
            color: 'var(--color-text-secondary)',
            borderRight: '1px solid var(--color-border)',
            position: 'sticky',
            left: 0,
            background: 'var(--color-bg-tertiary)',
            zIndex: 3,
          }}>
            Item
          </div>
          {days.map((day) => {
            const isToday =
              day === new Date().getDate() &&
              month === new Date().getMonth() &&
              year === new Date().getFullYear();
            const isWeekend = new Date(year, month, day).getDay() % 6 === 0;

            return (
              <div
                key={day}
                style={{
                  minWidth: '36px',
                  padding: 'var(--space-2) 0',
                  textAlign: 'center',
                  fontSize: 'var(--text-xs)',
                  fontWeight: isToday ? 'var(--font-bold)' : 'var(--font-normal)',
                  color: isToday
                    ? 'var(--color-accent-primary)'
                    : isWeekend
                    ? 'var(--color-text-muted)'
                    : 'var(--color-text-tertiary)',
                  borderRight: '1px solid var(--color-border-subtle)',
                }}
              >
                {day}
              </div>
            );
          })}
        </div>

        {/* Rows */}
        {visibleItems.length === 0 ? (
          <div style={{
            padding: 'var(--space-8)',
            textAlign: 'center',
            color: 'var(--color-text-muted)',
            fontSize: 'var(--text-sm)',
          }}>
            No items scheduled for {MONTH_NAMES[month]} {year}.
          </div>
        ) : (
          visibleItems.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                borderBottom: '1px solid var(--color-border-subtle)',
                minHeight: '40px',
                alignItems: 'center',
              }}
            >
              {/* Name column */}
              <div style={{
                minWidth: '180px',
                maxWidth: '180px',
                padding: 'var(--space-2) var(--space-3)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--font-medium)',
                color: 'var(--color-text-primary)',
                borderRight: '1px solid var(--color-border)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                position: 'sticky',
                left: 0,
                background: 'var(--color-bg-primary)',
                zIndex: 1,
              }}>
                {item.name}
              </div>

              {/* Day cells */}
              {days.map((day) => {
                const isItemDay = day === item.day;
                const isToday =
                  day === new Date().getDate() &&
                  month === new Date().getMonth() &&
                  year === new Date().getFullYear();

                return (
                  <div
                    key={day}
                    style={{
                      minWidth: '36px',
                      height: '40px',
                      borderRight: '1px solid var(--color-border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isToday
                        ? 'var(--color-accent-primary-subtle)'
                        : undefined,
                    }}
                  >
                    {isItemDay && (
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: 'var(--radius-full)',
                          background: item.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'transform var(--transition-fast)',
                        }}
                        title={`${item.name} — ${item.status || ''}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Legend */}
      <div style={{
        marginTop: 'var(--space-3)',
        fontSize: 'var(--text-xs)',
        color: 'var(--color-text-muted)',
      }}>
        {visibleItems.length} item{visibleItems.length !== 1 ? 's' : ''} in {MONTH_NAMES[month]} {year}
        {' • '}
        {timelineItems.length} total across all months
      </div>
    </div>
  );
}
