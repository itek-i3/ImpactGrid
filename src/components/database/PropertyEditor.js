'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  GripVertical,
  Type,
  Hash,
  Calendar,
  CheckSquare,
  List,
  Link,
  Mail,
  Phone,
  Tag,
  ChevronDown,
} from 'lucide-react';
import { useDatabaseStore } from '@/lib/store/useDatabaseStore';
import styles from '@/styles/database.module.css';

const PROPERTY_TYPES = [
  { type: 'text', label: 'Text', icon: Type },
  { type: 'number', label: 'Number', icon: Hash },
  { type: 'select', label: 'Select', icon: List },
  { type: 'multi_select', label: 'Multi-Select', icon: Tag },
  { type: 'date', label: 'Date', icon: Calendar },
  { type: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { type: 'url', label: 'URL', icon: Link },
  { type: 'email', label: 'Email', icon: Mail },
  { type: 'phone', label: 'Phone', icon: Phone },
];

const DEFAULT_COLORS = [
  '#60a5fa', '#a78bfa', '#34d399', '#fbbf24',
  '#f87171', '#f472b6', '#818cf8', '#8b8fa3',
  '#22d3ee', '#fb923c',
];

/**
 * PropertyEditor — modal/panel for creating and editing database properties.
 * Supports renaming, type changes, select option management, and deletion.
 */
export default function PropertyEditor({ property, onClose }) {
  const { updateProperty, deleteProperty } = useDatabaseStore();
  const [name, setName] = useState(property?.name || '');
  const [type, setType] = useState(property?.type || 'text');
  const [options, setOptions] = useState(property?.config?.options || []);
  const [newOption, setNewOption] = useState('');
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const panelRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        handleSave();
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [name, type, options]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(() => {
    if (!property) return;
    const updates = {
      name: name || 'Untitled',
      type,
    };
    if (type === 'select' || type === 'multi_select') {
      updates.config = { ...property.config, options };
    }
    updateProperty(property.id, updates);
  }, [property, name, type, options, updateProperty]);

  const handleAddOption = useCallback(() => {
    if (!newOption.trim()) return;
    setOptions((prev) => [
      ...prev,
      {
        value: newOption.trim(),
        color: DEFAULT_COLORS[prev.length % DEFAULT_COLORS.length],
      },
    ]);
    setNewOption('');
  }, [newOption]);

  const handleRemoveOption = useCallback((index) => {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleDelete = useCallback(() => {
    if (property) {
      deleteProperty(property.id);
      onClose();
    }
  }, [property, deleteProperty, onClose]);

  if (!property) return null;

  const TypeIcon = PROPERTY_TYPES.find((t) => t.type === type)?.icon || Type;

  return (
    <div
      ref={panelRef}
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        marginTop: '4px',
        width: '280px',
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        padding: 'var(--space-3)',
        zIndex: 'var(--z-popover)',
        animation: 'fadeInDown 0.12s ease forwards',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--space-3)',
      }}>
        <span style={{
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--font-semibold)',
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          Edit Property
        </span>
        <button
          onClick={() => {
            handleSave();
            onClose();
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Name */}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Property name"
        autoFocus
        style={{
          width: '100%',
          padding: 'var(--space-2) var(--space-2)',
          fontSize: 'var(--text-sm)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-bg-secondary)',
          color: 'var(--color-text-primary)',
          outline: 'none',
          marginBottom: 'var(--space-3)',
        }}
      />

      {/* Type Selector */}
      <div style={{ position: 'relative', marginBottom: 'var(--space-3)' }}>
        <label style={{
          display: 'block',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-text-muted)',
          marginBottom: 'var(--space-1)',
        }}>
          Type
        </label>
        <button
          onClick={() => setShowTypeMenu(!showTypeMenu)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            width: '100%',
            padding: 'var(--space-2)',
            fontSize: 'var(--text-sm)',
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-primary)',
            cursor: 'pointer',
          }}
        >
          <TypeIcon size={14} />
          {PROPERTY_TYPES.find((t) => t.type === type)?.label || type}
          <ChevronDown size={12} style={{ marginLeft: 'auto', color: 'var(--color-text-muted)' }} />
        </button>

        {showTypeMenu && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '4px',
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            padding: 'var(--space-1)',
            zIndex: 'var(--z-popover)',
            maxHeight: '240px',
            overflowY: 'auto',
          }}>
            {PROPERTY_TYPES.map((pt) => (
              <button
                key={pt.type}
                className={styles.cellSelectOption}
                onClick={() => {
                  setType(pt.type);
                  setShowTypeMenu(false);
                }}
              >
                <pt.icon size={14} />
                {pt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Select Options Editor */}
      {(type === 'select' || type === 'multi_select') && (
        <div>
          <label style={{
            display: 'block',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-muted)',
            marginBottom: 'var(--space-1)',
          }}>
            Options
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', marginBottom: 'var(--space-2)' }}>
            {options.map((opt, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-1)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <span
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: 'var(--radius-full)',
                    background: opt.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{
                  flex: 1,
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text-primary)',
                }}>
                  {opt.value}
                </span>
                <button
                  onClick={() => handleRemoveOption(idx)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
            <input
              type="text"
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddOption();
              }}
              placeholder="Add option..."
              style={{
                flex: 1,
                padding: 'var(--space-1) var(--space-2)',
                fontSize: 'var(--text-xs)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
                outline: 'none',
              }}
            />
            <button
              onClick={handleAddOption}
              style={{
                padding: 'var(--space-1) var(--space-2)',
                fontSize: 'var(--text-xs)',
                background: 'var(--color-bg-tertiary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Plus size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Divider */}
      <div style={{
        height: '1px',
        background: 'var(--color-border-subtle)',
        margin: 'var(--space-3) 0',
      }} />

      {/* Delete */}
      <button
        onClick={handleDelete}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          width: '100%',
          padding: 'var(--space-2)',
          fontSize: 'var(--text-sm)',
          color: '#ef4444',
          background: 'none',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          transition: 'background var(--transition-fast)',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#ef444411')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
      >
        <Trash2 size={14} />
        Delete property
      </button>
    </div>
  );
}
