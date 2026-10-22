// Monoline icons for the reminders UI, drawn to match the sidebar set.
function Svg({ size = 16, strokeWidth = 1.8, children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const IconCheck = props => <Svg strokeWidth={2.4} {...props}><path d="M5 10.5l3.2 3L15 6.5" /></Svg>;
export const IconPlus = props => <Svg {...props}><path d="M10 4.5v11M4.5 10h11" /></Svg>;
export const IconClose = props => <Svg {...props}><path d="M5.5 5.5l9 9M14.5 5.5l-9 9" /></Svg>;
export const IconNote = props => <Svg {...props}><path d="M5 3.5h7l3 3v10H5z" /><path d="M8 10h4M8 13h4" /></Svg>;
export const IconList = props => <Svg {...props}><path d="M8.5 6h7M8.5 10h7M8.5 14h7" /><path d="M4.5 6h.01M4.5 10h.01M4.5 14h.01" strokeWidth={2.6} /></Svg>;
export const IconRepeat = props => <Svg {...props}><path d="M4 9V8a3 3 0 0 1 3-3h8l-2.5-2.5M16 11v1a3 3 0 0 1-3 3H5l2.5 2.5" /></Svg>;
export const IconTrash = props => <Svg {...props}><path d="M4 6h12M8 6V4h4v2M6 6l.7 10h6.6L14 6" /></Svg>;
export const IconSearch = props => <Svg {...props}><circle cx="9" cy="9" r="5" /><path d="M13 13l3.5 3.5" /></Svg>;
export const IconBell = props => (
  <Svg {...props}>
    <path d="M5 8a5 5 0 0 1 10 0c0 4.5 2 6 2 6H3s2-1.5 2-6" />
    <path d="M8.5 17a1.75 1.75 0 0 0 3 0" />
  </Svg>
);
export const IconCalendar = props => (
  <Svg {...props}><rect x="3.5" y="4.5" width="13" height="12" rx="2" /><path d="M3.5 8.5h13M7 3v3M13 3v3" /></Svg>
);
export const IconClock = props => <Svg {...props}><circle cx="10" cy="10" r="6.5" /><path d="M10 6.5V10l2.2 2.2" /></Svg>;
export const IconFilter = props => <Svg {...props}><path d="M3.5 5h13M6 10h8M8.5 15h3" /></Svg>;
export const IconArrowRight = props => <Svg {...props}><path d="M4.5 10h11M11 5.5l4.5 4.5-4.5 4.5" /></Svg>;
