'use client';

import { useState } from 'react';
import { Users2, ShieldCheck, Tag, X, Mail, Phone, Calendar, UserCheck } from 'lucide-react';
import { useDatabaseStore } from '@/lib/store/useDatabaseStore';
import styles from '@/styles/community.module.css';

export default function MemberDirectory() {
  const { rows, properties } = useDatabaseStore();
  const [selectedMember, setSelectedMember] = useState(null);
  const [activeSkills, setActiveSkills] = useState([]);

  // Helper to get cell value by property name
  const getVal = (row, propName) => {
    const prop = properties.find((p) => p.name === propName);
    return prop ? row.cells[prop.id] : null;
  };

  // Stats Calculations
  const totalMembers = rows.length;
  const activeMembers = rows.filter((r) => getVal(r, 'Status') === 'Active').length;
  const staffLeaders = rows.filter(
    (r) => getVal(r, 'Role') === 'Staff' || getVal(r, 'Role') === 'Leader'
  ).length;

  // Extract all unique skills option list
  const skillsProperty = properties.find((p) => p.name === 'Skills');
  const skillsList = skillsProperty?.config?.options?.map((opt) => opt.value) || [
    'Management',
    'Marketing',
    'Design',
    'Development',
    'Events',
    'Finance',
  ];

  // Toggle skills filter
  const handleSkillToggle = (skill) => {
    if (activeSkills.includes(skill)) {
      setActiveSkills((prev) => prev.filter((s) => s !== skill));
    } else {
      setActiveSkills((prev) => [...prev, skill]);
    }
  };

  // Filter members based on selected skill tags
  const filteredMembers = rows.filter((member) => {
    if (activeSkills.length === 0) return true;
    const memberSkills = getVal(member, 'Skills') || [];
    return activeSkills.every((skill) => memberSkills.includes(skill));
  });

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'Leader':
        return { background: 'rgba(52, 211, 153, 0.15)', color: '#34d399' };
      case 'Staff':
        return { background: 'rgba(167, 139, 250, 0.15)', color: '#a78bfa' };
      case 'Volunteer':
        return { background: 'rgba(96, 165, 250, 0.15)', color: '#60a5fa' };
      default:
        return { background: 'var(--color-bg-active)', color: 'var(--color-text-secondary)' };
    }
  };

  return (
    <div className={styles.dashboard}>
      {/* KPI Section */}
      <div className={styles.kpiGrid}>
        <div className={`${styles.kpiCard} ${styles.kpiCardPrimary}`}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Total Members</span>
            <span className={styles.kpiValue}>{totalMembers}</span>
          </div>
          <div className={`${styles.kpiIconWrapper} ${styles.iconPrimary}`}>
            <Users2 size={24} />
          </div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiCardSuccess}`}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Active Members</span>
            <span className={styles.kpiValue}>{activeMembers}</span>
          </div>
          <div className={`${styles.kpiIconWrapper} ${styles.iconSuccess}`}>
            <UserCheck size={24} />
          </div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiCardInfo}`}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Leaders & Staff</span>
            <span className={styles.kpiValue}>{staffLeaders}</span>
          </div>
          <div className={`${styles.kpiIconWrapper} ${styles.iconInfo}`}>
            <ShieldCheck size={24} />
          </div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiCardWarning}`}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Skills Filters</span>
            <span className={styles.kpiValue}>
              {activeSkills.length ? activeSkills.length : 'Off'}
            </span>
          </div>
          <div className={`${styles.kpiIconWrapper} ${styles.iconWarning}`}>
            <Tag size={24} />
          </div>
        </div>
      </div>

      {/* Interactive Tag Cloud for Filtering */}
      <div className={styles.membersSearchSection}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-secondary)' }}>
            Filter Directory by Skills Tag
          </span>
          {activeSkills.length > 0 && (
            <button
              onClick={() => setActiveSkills([])}
              style={{
                fontSize: '11px',
                color: 'var(--color-text-muted)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
              }}
            >
              Clear filters <X size={10} />
            </button>
          )}
        </div>
        <div className={styles.skillCloud}>
          {skillsList.map((skill) => {
            const isActive = activeSkills.includes(skill);
            return (
              <button
                key={skill}
                onClick={() => handleSkillToggle(skill)}
                className={`${styles.skillBadge} ${isActive ? styles.skillBadgeActive : ''}`}
              >
                {skill}
              </button>
            );
          })}
        </div>
      </div>

      {/* Members Profile Grid */}
      <div className={styles.membersGrid}>
        {filteredMembers.map((member) => {
          const name = getVal(member, 'Full Name') || 'Unnamed Member';
          const role = getVal(member, 'Role') || 'Member';
          const skills = getVal(member, 'Skills') || [];
          const colors = getRoleColor(role);

          return (
            <div
              key={member.id}
              className={styles.memberProfileCard}
              onClick={() => setSelectedMember(member)}
            >
              <div className={styles.avatarCircle}>{getInitials(name)}</div>
              <div>
                <div className={styles.memberName}>{name}</div>
                <div className={styles.memberRole} style={{ color: colors.color }}>
                  {role}
                </div>
              </div>
              <div className={styles.memberSkills}>
                {skills.slice(0, 3).map((s) => (
                  <span key={s} className={styles.memberCardSkill}>
                    {s}
                  </span>
                ))}
                {skills.length > 3 && (
                  <span className={styles.memberCardSkill}>+{skills.length - 3}</span>
                )}
              </div>
              <button className={styles.memberContactBtn}>View Full Profile</button>
            </div>
          );
        })}
      </div>

      {/* Member Profile Modal */}
      {selectedMember && (
        <div className={styles.modalOverlay} onClick={() => setSelectedMember(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setSelectedMember(null)}>
              <X size={18} />
            </button>

            <div className={styles.modalHeader}>
              <div className={styles.avatarCircle} style={{ width: '80px', height: '80px', fontSize: '2rem' }}>
                {getInitials(getVal(selectedMember, 'Full Name'))}
              </div>
              <div className={styles.memberName} style={{ fontSize: 'var(--text-lg)' }}>
                {getVal(selectedMember, 'Full Name')}
              </div>
              <span
                style={{
                  fontSize: '11px',
                  padding: '2px 10px',
                  borderRadius: 'var(--radius-full)',
                  ...getRoleColor(getVal(selectedMember, 'Role')),
                  fontWeight: 'bold',
                }}
              >
                {getVal(selectedMember, 'Role')}
              </span>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.modalField}>
                <span className={styles.modalFieldName}>
                  <Mail size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                  Email
                </span>
                <span className={styles.modalFieldValue}>
                  <a
                    href={`mailto:${getVal(selectedMember, 'Email')}`}
                    style={{ color: 'var(--color-accent-primary)', textDecoration: 'none' }}
                  >
                    {getVal(selectedMember, 'Email') || 'N/A'}
                  </a>
                </span>
              </div>

              <div className={styles.modalField}>
                <span className={styles.modalFieldName}>
                  <Phone size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                  Phone
                </span>
                <span className={styles.modalFieldValue}>
                  <a
                    href={`tel:${getVal(selectedMember, 'Phone')}`}
                    style={{ color: 'var(--color-accent-primary)', textDecoration: 'none' }}
                  >
                    {getVal(selectedMember, 'Phone') || 'N/A'}
                  </a>
                </span>
              </div>

              <div className={styles.modalField}>
                <span className={styles.modalFieldName}>
                  <Calendar size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                  Joined Date
                </span>
                <span className={styles.modalFieldValue}>
                  {getVal(selectedMember, 'Joined Date') || 'N/A'}
                </span>
              </div>

              <div className={styles.modalField}>
                <span className={styles.modalFieldName}>Status</span>
                <span
                  className={styles.modalFieldValue}
                  style={{
                    color: getVal(selectedMember, 'Status') === 'Active' ? '#34d399' : '#f87171',
                  }}
                >
                  {getVal(selectedMember, 'Status') || 'Inactive'}
                </span>
              </div>

              <div style={{ marginTop: 'var(--space-2)' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>
                  SKILLS & EXPERTISE
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: 'var(--space-2)' }}>
                  {(getVal(selectedMember, 'Skills') || []).map((skill) => (
                    <span
                      key={skill}
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--color-bg-active)',
                        border: '1px solid var(--color-border-subtle)',
                      }}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
