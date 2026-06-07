'use client';

import React, { useId } from 'react';
import Image from 'next/image';

export default function Logo({
  width = 40,
  height = 40,
  variant = 'adaptive',
  showText = false,
  textType = 'brand',
  className = '',
  brand = 'default', // Added brand prop
}) {
  const id = useId().replace(/:/g, '');
  const pathId = `logo-text-path-${id}`;

  const colors = {
    vividBlue: '#306CEC',
    lightYellow: '#FFFEF9',
    zero: '#000000',
  };

  // --- IMAGE RENDERING LOGIC ---
  // If a specific image-based brand is requested, return that instead of the SVG
  const renderImageLogo = () => {
    switch (brand) {
      case 'iTek': return <Image src="/itek-logo.png" width={width} height={height} alt="iTek" />;
      case 'i3x': return <Image src="/i3x-logo.png" width={width} height={height} alt="i3x Africa" />;
      case 'i360': return <Image src="/i360-logo.png" width={width} height={height} alt="i360" />;
      case 'i3studio': return <Image src="/i3studio-logo.png" width={width} height={height} alt="i3studio" />;
      case 'i3kingdom': return <Image src="/i3kingdom-logo.png" width={width} height={height} alt="i3KingdomHub" />;
      default: return null;
    }
  };

  const isImageLogo = brand !== 'default' && brand !== 'i3+';
  if (isImageLogo) return renderImageLogo();

  // --- ORIGINAL SVG LOGIC ---
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
      <defs>
        <path id={pathId} d="M 23 74 A 36 36 0 0 0 77 74" fill="none" />
      </defs>
      <path d="M 16.5 38 A 36 36 0 1 1 68 81.2" stroke={svgFillColor} strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M 32 81.2 A 36 36 0 0 1 16.5 62" stroke={svgFillColor} strokeWidth="4" strokeLinecap="round" fill="none" />
      <circle cx="77" cy="33" r="4.5" fill={svgFillColor} />
      <text x="47" y="58" textAnchor="middle" fontSize="27" fontWeight="800" fontFamily="var(--font-spartan), sans-serif" letterSpacing="-0.06em" fill={svgFillColor}>360</text>
      <text>
        <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle" fill={svgFillColor} fontSize="7.5" fontWeight="800" fontFamily="var(--font-sans), sans-serif" letterSpacing="0.32em">
          IMPACT
        </textPath>
      </text>
    </svg>
  );

  if (!showText) {
    return variant === 'vivid' ? <div style={containerStyle}>{svgElement}</div> : svgElement;
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px' }}>
      {variant === 'vivid' ? <div style={containerStyle}>{svgElement}</div> : svgElement}
      <span style={{ fontFamily: 'var(--font-spartan), sans-serif', fontSize: '1.25rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em', color: variant === 'vivid' ? '#FFFFFF' : 'inherit', display: 'flex', alignItems: 'center' }}>
        {textType === 'grid' ? (
          <><span style={{ color: variant === 'adaptive' ? 'var(--color-text-primary)' : 'inherit' }}>Impact</span><span style={{ color: colors.vividBlue, marginLeft: '4px' }}>Grid</span></>
        ) : (
          <><span style={{ color: variant === 'adaptive' ? 'var(--color-text-primary)' : 'inherit' }}>Impact</span><span style={{ color: colors.vividBlue, marginLeft: '2px' }}>360</span></>
        )}
      </span>
    </div>
  );
}