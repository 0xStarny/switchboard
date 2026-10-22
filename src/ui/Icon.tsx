// Hand-drawn 20px line icons, one stroke weight, so the UI does not need an icon font.
const P: Record<string, string> = {
  inbox: 'M3 11.5 5.2 4.6A1.5 1.5 0 0 1 6.6 3.5h6.8a1.5 1.5 0 0 1 1.4 1.1L17 11.5M3 11.5V15a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 17 15v-3.5M3 11.5h4l1 2h4l1-2h4',
  stack: 'M10 3 17 6.5 10 10 3 6.5 10 3ZM3 10l7 3.5 7-3.5M3 13.5 10 17l7-3.5',
  tray: 'M4 4h12v12H4zM4 12h3.5l1 1.5h3l1-1.5H16',
  plus: 'M10 4v12M4 10h12',
  gear: 'M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1 4.7 4.7',
  search: 'M9 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM13.5 13.5 17 17',
  check: 'M4.5 10.5 8 14l7.5-8',
  checks: 'M2.5 10.5 6 14l7.5-8M10 13l1 1 7.5-8',
  mute: 'M4 8v4h3l4 3.5v-11L7 8H4ZM14 8l4 4M18 8l-4 4',
  bell: 'M5.5 13.5V9a4.5 4.5 0 0 1 9 0v4.5l1.5 1.5H4l1.5-1.5ZM8.5 17h3',
  archive: 'M3 4h14v3.5H3zM4.5 7.5V16h11V7.5M8 10.5h4',
  tag: 'M3 3h6.5l7.5 7.5-6.5 6.5L3 9.5V3ZM6.5 7a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1Z',
  folder: 'M2.5 5.5A1.5 1.5 0 0 1 4 4h3.5l2 2H16a1.5 1.5 0 0 1 1.5 1.5V15a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 15V5.5Z',
  move: 'M2.5 5.5A1.5 1.5 0 0 1 4 4h3.5l2 2H16a1.5 1.5 0 0 1 1.5 1.5V15a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 15V5.5ZM8 11.5h5M11 9.5l2 2-2 2',
  clock: 'M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM10 6.5V10l2.5 1.5',
  alarm: 'M10 17a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM10 8.5V11h2.5M3.5 5 6 2.8M16.5 5 14 2.8',
  later: 'M2.5 9 15 3l-3 11.5-2.5-4.5-7-1ZM14.5 12.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm0 1.8V16l1.2.8',
  send: 'M3 10 17 3l-4 14-3-6-7-1Z',
  reply: 'M8 5 3 10l5 5M3.5 10H12a5 5 0 0 1 5 5v1',
  info: 'M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM10 9v4.5M10 6.5v.5',
  back: 'M12.5 4 6.5 10l6 6',
  down: 'M5 7.5 10 12.5 15 7.5',
  right: 'M7.5 5 12.5 10 7.5 15',
  x: 'M5 5l10 10M15 5 5 15',
  download: 'M10 3v9.5M6 9l4 4 4-4M4 16.5h12',
  external: 'M11 3.5h5.5V9M16.5 3.5 9 11M14 12.5V16a.5.5 0 0 1-.5.5h-9A.5.5 0 0 1 4 16V7a.5.5 0 0 1 .5-.5H8',
  user: 'M10 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3.5 17a6.5 6.5 0 0 1 13 0',
  group: 'M7.5 9.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 16.5a5.5 5.5 0 0 1 11 0M13 3.6a3 3 0 0 1 0 5.8M15 11.3a5.5 5.5 0 0 1 3 5.2',
  channel: 'M3 8v4h2.5L13 16V4L5.5 8H3ZM16 7.5a3.5 3.5 0 0 1 0 5',
  bot: 'M5 7h10v8H5zM10 4v3M7.5 10.5v1M12.5 10.5v1M3 10v3M17 10v3',
  at: 'M13.5 10a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Zm0 0v1.3a2 2 0 0 0 4 0V10a7.5 7.5 0 1 0-3 6',
  pin: 'M12 3l5 5-3 1-3 3 .5 3.5L7 11 3 15m4-4L4.5 8.5 8 9l3-3 1-3Z',
  edit: 'M13.5 3.5l3 3L7 16H4v-3l9.5-9.5Z',
  trash: 'M4 6h12M8 6V4h4v2M5.5 6l.8 10.5h7.4L14.5 6',
  arrowUp: 'M10 16V4M5 9l5-5 5 5',
  arrowDown: 'M10 4v12M5 11l5 5 5-5',
  install: 'M4 4h12v9H4zM8 16.5h4M10 13v3.5M10 6v4.5M8 8.5l2 2 2-2',
  note: 'M5 3h7l3 3v11H5zM8 9h4M8 12h4',
  rule: 'M3 5h14M6 10h8M9 15h2',
}

export function Icon({ name, size = 18, className }: { name: keyof typeof P | string; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={P[name] ?? ''} />
    </svg>
  )
}
