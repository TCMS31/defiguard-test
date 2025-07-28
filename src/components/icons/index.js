import React from 'react';

/**
 * The four icons this site uses, inlined as SVG.
 *
 * They previously came from `@fortawesome/fontawesome-free`, whose stylesheet
 * and webfonts added roughly a megabyte of font files to the build for four
 * glyphs. Inline SVG has no runtime cost, no font loading and no flash of
 * missing icons.
 *
 * Paths are from Font Awesome Free 6 (CC BY 4.0).
 */

const BASE_PROPS = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: '1em',
  height: '1em',
  fill: 'currentColor',
  'aria-hidden': 'true',
  focusable: 'false',
};

/** @param {{ path: string, viewBox: string, className?: string }} props */
function Icon({ path, viewBox, className }) {
  return (
    <svg {...BASE_PROPS} viewBox={viewBox} className={className}>
      <path d={path} />
    </svg>
  );
}

export function LocationIcon(props) {
  return (
    <Icon
      {...props}
      viewBox="0 0 384 512"
      path="M215.7 499.2C267 435 384 279.4 384 192C384 86 298 0 192 0S0 86 0 192c0 87.4 117 243 168.3 307.2c12.3 15.3 35.1 15.3 47.4 0zM192 128a64 64 0 1 1 0 128 64 64 0 1 1 0-128z"
    />
  );
}

export function PhoneIcon(props) {
  return (
    <Icon
      {...props}
      viewBox="0 0 512 512"
      path="M164.9 24.6c-7.7-18.6-28-28.5-47.4-23.2l-88 24C12.1 30.2 0 46 0 64C0 311.4 200.6 512 448 512c18 0 33.8-12.1 38.6-29.5l24-88c5.3-19.4-4.6-39.7-23.2-47.4l-96-40c-16.3-6.8-35.2-2.1-46.3 11.6L304.7 368C234.3 334.7 177.3 277.7 144 207.3L193.3 167c13.7-11.2 18.4-30 11.6-46.3l-40-96z"
    />
  );
}

export function EnvelopeIcon(props) {
  return (
    <Icon
      {...props}
      viewBox="0 0 512 512"
      path="M48 64C21.5 64 0 85.5 0 112c0 15.1 7.1 29.3 19.2 38.4L236.8 313.6c11.4 8.5 27 8.5 38.4 0L492.8 150.4c12.1-9.1 19.2-23.3 19.2-38.4c0-26.5-21.5-48-48-48L48 64zM0 176L0 384c0 35.3 28.7 64 64 64l384 0c35.3 0 64-28.7 64-64l0-208L294.4 339.2c-22.8 17.1-54 17.1-76.8 0L0 176z"
    />
  );
}

export function ArrowRightIcon(props) {
  return (
    <Icon
      {...props}
      viewBox="0 0 448 512"
      path="M438.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L338.8 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l306.7 0L233.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z"
    />
  );
}
