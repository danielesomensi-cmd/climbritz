// UX-002 / QW2 — shared tap-feel classes for every pressable primitive
// (Button / Chip / interactive Card). Plain module (no 'use client') so the
// server-renderable Card can import the string directly.
//  - touch-manipulation: no double-tap-zoom delay on iOS/Android WebViews
//  - select-none: long-press doesn't select the label text
//  - active:scale-[0.97]: native-feeling press state, timed by the motion
//    tokens in app/globals.css (0ms under prefers-reduced-motion)
export const PRESSABLE_CLASSES =
  'touch-manipulation select-none transition duration-(--motion-duration-press) ease-press active:scale-[0.97] motion-reduce:active:scale-100';
