'use client';

import React, { useId } from 'react';

/**
 * Logo component representing the official Impact360 visual identity.
 * Features a circular badge with "360°" and "IMPACT" curved along the bottom.
 */
export default function Logo({
  width = 40,
  height = 40,
  variant = 'adaptive', // 'vivid' | 'primary' | 'secondary' | 'adaptive'
  showText = false,
  textType = 'brand', // 'brand' (Impact360) | 'grid' (Impact Grid)
  className = '',
}) {
  // Generate a unique ID for the SVG text path to avoid collisions when multiple logos are rendered
  const id = useId().replace(/:/g, '');
  const pathId = `logo-text-path-${id}`;

  // Color mappings based on guidelines
  const colors = {
    vividBlue: '#306CEC',
    lightYellow: '#FFFEF9',
    zero: '#000000',
  };

  // Determine styles based on variant
  let containerStyle = {};
  let svgFillColor = 'currentColor';

  if (variant === 'vivid') {
    containerStyle = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.vividBlue,
      borderRadius: '12px',
      padding: '6px',
      width: `${width}px`,
      height: `${height}px`,
    };
    svgFillColor = '#FFFFFF';
  } else if (variant === 'primary') {
    svgFillColor = '#FFFFFF';
  } else if (variant === 'secondary') {
    svgFillColor = colors.zero;
  } else if (variant === 'adaptive') {
    // Uses currentColor to adapt to parent's text styling
    svgFillColor = 'currentColor';
  }

  const svgElement = (
    <svg
      width={variant === 'vivid' ? '100%' : width}
      height={variant === 'vivid' ? '100%' : height}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'block' }}
    >
      {/* Hidden path used for text curving along the bottom of the circle */}
      <defs>
        <path
          id={pathId}
          d="M 23 74 A 36 36 0 0 0 77 74"
          fill="none"
        />
      </defs>

      {/* Main Circle Arc (Top, Right, and bottom right) */}
      <path
        d="M 16.5 38 A 36 36 0 1 1 68 81.2"
        stroke={svgFillColor}
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />

      {/* Bottom-Left Circle Arc (underneath the overlapping 3) */}
      <path
        d="M 32 81.2 A 36 36 0 0 1 16.5 62"
        stroke={svgFillColor}
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />

      {/* Degree Symbol Dot (at the top right of the 360) */}
      <circle
        cx="77"
        cy="33"
        r="4.5"
        fill={svgFillColor}
      />

      {/* 360 Numbers (League Spartan Bold font style) */}
      <text
        x="47"
        y="58"
        textAnchor="middle"
        fontSize="27"
        fontWeight="800"
        fontFamily="var(--font-spartan), sans-serif"
        letterSpacing="-0.06em"
        fill={svgFillColor}
      >
        360
      </text>

      {/* Curved IMPACT Text */}
      <text>
        <textPath
          href={`#${pathId}`}
          startOffset="50%"
          textAnchor="middle"
          fill={svgFillColor}
          fontSize="7.5"
          fontWeight="800"
          fontFamily="var(--font-sans), sans-serif"
          letterSpacing="0.32em"
        >
          IMPACT
        </textPath>
      </text>
    </svg>
  );

  if (!showText) {
    return variant === 'vivid' ? <div style={containerStyle}>{svgElement}</div> : svgElement;
  }

  // Display logo with brand text alongside it
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px' }}>
      {variant === 'vivid' ? <div style={containerStyle}>{svgElement}</div> : svgElement}
      <span
        style={{
          fontFamily: 'var(--font-spartan), sans-serif',
          fontSize: '1.25rem',
          fontWeight: '800',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: variant === 'vivid' ? '#FFFFFF' : 'inherit',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {textType === 'grid' ? (
          <>
            <span style={{ color: variant === 'adaptive' ? 'var(--color-text-primary)' : 'inherit' }}>Impact</span>
            <span style={{ color: colors.vividBlue, marginLeft: '4px' }}>Grid</span>
          </>
        ) : (
          <>
            <span style={{ color: variant === 'adaptive' ? 'var(--color-text-primary)' : 'inherit' }}>Impact</span>
            <span style={{ color: colors.vividBlue, marginLeft: '2px' }}>360</span>
          </>
        )}
      </span>
    </div>
  );
}
