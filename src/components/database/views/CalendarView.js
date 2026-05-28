'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useDatabaseStore } from '@/lib/store/useDatabaseStore';
import styles from '@/styles/database.module.css';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * CalendarView — monthly calendar grid with events placed on due dates.
 */
export default function CalendarView() {
  const { properties, getFilteredRows } = useDatabaseStore();
  const filteredRows = getFilteredRows();

  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Find the date property
  const dateProp = properties.find((p) => p.type === 'date');
  const nameProp = properties.find((p) => p.sortOrder === 0) || properties[0];
  const statusProp = properties.find((p) => p.name === 'Status');

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days = [];

    // Previous month padding
    const prevMonthLast = new Date(year, month, 0).getDate();
    for (let i = startPad - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLast - i),
        isOtherMonth: true,
      });
    }

    // Current month
    for (let d = 1; d <= totalDays; d++) {
      days.push({
        date: new Date(year, month, d),
        isOtherMonth: false,
      });
    }

    // Next month padding (fill to 42 = 6 rows)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isOtherMonth: true,
      });
    }

    return days;
  }, [year, month]);

  // Map rows to dates
  const eventsByDate = useMemo(() => {
    const map = {};
    if (!dateProp) return map;

    filteredRows.forEach((row) => {
      const dateVal = row.cells?.[dateProp.id];
      if (!dateVal) return;
      const dateKey = dateVal.slice(0, 10);
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(row);
    });

    return map;
  }, [filteredRows, dateProp]);

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  if (!dateProp) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        No date property found. Add a date property to use Calendar view.
      </div>
    );
  }

  return (
    <div className={styles.calendar}>
      <div className={styles.calendarHeader}>
        <div className={styles.calendarNav}>
          <button className={styles.calendarNavBtn} onClick={prevMonth}>
            <ChevronLeft size={18} />
          </button>
          <span className={styles.calendarTitle}>
            {MONTHS[month]} {year}
          </span>
          <button className={styles.calendarNavBtn} onClick={nextMonth}>
            <ChevronRight size={18} />
          </button>
        </div>
        <button
          className={styles.dbToolbarBtn}
          onClick={goToday}
        >
          Today
        </button>
      </div>

      <div className={styles.calendarGrid}>
        {DAYS.map((day) => (
          <div key={day} className={styles.calendarDayHeader}>
            {day}
          </div>
        ))}

        {calendarDays.map((day, i) => {
          const dateKey = `${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, '0')}-${String(day.date.getDate()).padStart(2, '0')}`;
          const events = eventsByDate[dateKey] || [];
          const isToday = dateKey === todayKey;

          return (
            <div
              key={i}
              className={`${styles.calendarDay} ${
                day.isOtherMonth ? styles.calendarDayOther : ''
              } ${isToday ? styles.calendarDayToday : ''}`}
            >
              <div className={styles.calendarDayNumber}>
                {day.date.getDate()}
              </div>
              {events.slice(0, 3).map((row) => {
                const status = statusProp
                  ? statusProp.config?.options?.find(
                      (o) => o.value === row.cells?.[statusProp.id]
                    )
                  : null;
                return (
                  <div
                    key={row.id}
                    className={styles.calendarEvent}
                    style={{ background: status?.color || 'var(--color-accent-primary)' }}
                  >
                    {row.cells?.[nameProp?.id] || 'Untitled'}
                  </div>
                );
              })}
              {events.length > 3 && (
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', padding: '0 6px' }}>
                  +{events.length - 3} more
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
