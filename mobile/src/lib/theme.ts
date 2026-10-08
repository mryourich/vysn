/** Farben wie auf der Website (app/globals.css) */
export const C = {
  bg: '#f4f6f9',
  surface: '#ffffff',
  surface2: '#f8f9fb',
  line: '#e3e7ee',
  lineStrong: '#cfd6e1',
  ink: '#0b1220',
  ink2: '#344054',
  muted: '#667085',
  primary: '#13873e',
  primaryDark: '#0b6b31',
  primarySoft: '#e8f6ec',
  brand: '#06100b',
  success: '#067647',
  successSoft: '#e7f6ee',
  warning: '#9a5b00',
  warningSoft: '#fdf3e1',
  danger: '#c01f14',
  dangerSoft: '#fdecea',
  info: '#1d5fc4',
  infoSoft: '#eaf1fd',
};

export const TONE: Record<string, { fg: string; bg: string }> = {
  neutral: { fg: C.ink2, bg: '#eef1f5' },
  info: { fg: C.info, bg: C.infoSoft },
  success: { fg: C.success, bg: C.successSoft },
  warning: { fg: C.warning, bg: C.warningSoft },
  danger: { fg: C.danger, bg: C.dangerSoft },
};

export const R = { sm: 8, md: 12, lg: 16 };
