import React from 'react';

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const LeafIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M20 4c0 8.5-5.5 15-15 15C5 10.5 11.5 4 20 4Z" />
    <path d="M5 19c3.5-5.5 7.5-9.5 11-12" />
  </svg>
);

export const CompassIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M12 2.5 19 21l-7-4-7 4Z" />
  </svg>
);

export const HeartIcon = ({ size = 20, filled = false }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base} fill={filled ? 'currentColor' : 'none'}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

export const CheckIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

export const XIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

export const ClockIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);

export const MapPinIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.6" />
  </svg>
);

export const CrescentIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />
  </svg>
);

export const MildIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M12 3.5s5.5 6 5.5 9.8a5.5 5.5 0 1 1-11 0C6.5 9.5 12 3.5 12 3.5Z" />
  </svg>
);

export const FermentIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M9 3h6M10 3v2.5M14 3v2.5" />
    <path d="M12 5.5c-4 0-5.5 3-5.5 6.5S8 20 12 20s5.5-4.5 5.5-8-1.5-6.5-5.5-6.5Z" />
    <circle cx="10.5" cy="12" r="0.5" />
    <circle cx="13.5" cy="14.5" r="0.5" />
  </svg>
);

export const SproutIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M12 20v-7" />
    <path d="M12 13C12 9 9 7 5 7c0 4 3 6 7 6Z" />
    <path d="M12 11c0-4 3-6 7-6 0 4-3 6-7 6Z" />
  </svg>
);

export const RecycleIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M20 12a8 8 0 1 1-2.34-5.66" />
    <path d="M20 3v4h-4" />
  </svg>
);

export const SparkleIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z" />
  </svg>
);

export const BookIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M12 6c-1.8-1.3-4.2-2-7-2v14c2.8 0 5.2.7 7 2 1.8-1.3 4.2-2 7-2V4c-2.8 0-5.2.7-7 2Z" />
    <path d="M12 6v14" />
  </svg>
);

export const BowlIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M4 13a8 8 0 0 0 16 0H4Z" />
    <path d="m7 10 10-6M9.5 11 19 6.5" />
  </svg>
);

export const MenuIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M4 6h16M4 12h16M4 18h10" />
  </svg>
);

export const UserIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <circle cx="12" cy="8" r="3.4" />
    <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
  </svg>
);

export const TrainIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <rect x="6" y="3.5" width="12" height="13" rx="3" />
    <path d="M6 10h12" />
    <circle cx="9.5" cy="13.2" r="0.6" />
    <circle cx="14.5" cy="13.2" r="0.6" />
    <path d="m8.5 20 1.5-3.5M15.5 20 14 16.5" />
  </svg>
);

export const PhoneIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M8.4 4.5H5.6A1.6 1.6 0 0 0 4 6.2c0 7.6 6.2 13.8 13.8 13.8a1.6 1.6 0 0 0 1.7-1.6v-2.8l-3.6-1.4-1.8 2.2a12.6 12.6 0 0 1-5.3-5.3l2.2-1.8Z" />
  </svg>
);

export const LinkIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 1 0-5.7-5.7L11.9 6.4" />
    <path d="M13.5 10.5a4 4 0 0 0-5.7 0L5 13.3a4 4 0 1 0 5.7 5.7l1.4-1.4" />
  </svg>
);

export const ChevronRightIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="m9 5 7 7-7 7" />
  </svg>
);

export const ShareIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
    <path d="m16 6-4-4-4 4" />
    <path d="M12 2v13" />
  </svg>
);

export const ShieldCheckIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M12 2s7 2.5 7 8v4.5c0 3.5-3.5 6-7 7.5-3.5-1.5-7-4-7-7.5V10c0-5.5 7-8 7-8Z" />
    <path d="m9 12.5 2 2 4-4" />
  </svg>
);

export const ChevronLeftIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);


