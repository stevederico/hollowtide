function icon(paths: string, size = 22): string {
  return (
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" ` +
    `stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`
  );
}

export const ICONS = {
  book: icon('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/><path d="M9 8h6"/>'),
  menu: icon('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  soundOn: icon('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/>'),
  soundOff: icon('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9.5l4 5M21 9.5l-4 5"/>'),
  back: icon('<path d="M9 14l-5-5 5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
  left: icon('<path d="M15 5l-7 7 7 7"/>', 26),
  right: icon('<path d="M9 5l7 7-7 7"/>', 26),
  close: icon('<path d="M6 6l12 12M18 6L6 18"/>'),
  lens: icon('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/><path d="M9.5 9.5l1.5 1.5"/>', 26),
  fork: icon('<path d="M12 22v-8"/><path d="M8 3v8a4 4 0 0 0 8 0V3"/>', 26)
} as const;
