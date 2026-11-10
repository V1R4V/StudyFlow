import {
  TimerIcon, FlameIcon, CalendarDotsIcon, TargetIcon, PlantIcon, TrashIcon,
  PencilSimpleIcon, DownloadSimpleIcon, UploadSimpleIcon, ArrowRightIcon,
  CheckIcon, PlayIcon, PauseIcon, PlusIcon, BookOpenIcon, EyeIcon, EyeSlashIcon,
  ArrowUpRightIcon, SquaresFourIcon, CrosshairIcon, ChartBarIcon, BellIcon,
  SunIcon, MoonIcon, SignOutIcon, CaretLeftIcon, CaretRightIcon, QuestionIcon,
  MagnifyingGlassIcon, StarIcon, GearSixIcon, GlobeHemisphereWestIcon,
} from '@phosphor-icons/react';

const icons = {
  clock: TimerIcon, flame: FlameIcon, calendar: CalendarDotsIcon, target: TargetIcon,
  seedling: PlantIcon, trash: TrashIcon, edit: PencilSimpleIcon, download: DownloadSimpleIcon,
  upload: UploadSimpleIcon, arrowRight: ArrowRightIcon, check: CheckIcon, play: PlayIcon,
  pause: PauseIcon, plus: PlusIcon, book: BookOpenIcon, eye: EyeIcon, eyeOff: EyeSlashIcon,
  expand: ArrowUpRightIcon, dashboard: SquaresFourIcon, command: CrosshairIcon,
  statistics: ChartBarIcon, bell: BellIcon, sun: SunIcon, moon: MoonIcon,
  signOut: SignOutIcon, chevronLeft: CaretLeftIcon, chevronRight: CaretRightIcon,
  help: QuestionIcon, search: MagnifyingGlassIcon, star: StarIcon,
  settings: GearSixIcon, globe: GlobeHemisphereWestIcon,
};

export default function Icon({ name, size = 18, className = '' }) {
  const emoji = { clock: '⏱️', flame: '🔥', calendar: '📅', target: '🎯', seedling: '🌱', book: '📚', statistics: '📊', dashboard: '🏠', command: '🧭', bell: '🔔', sun: '☀️', moon: '🌙', star: '⭐', settings: '⚙️', globe: '🌐' }[name];
  if (emoji) return <span className={`sf-icon sf-emoji ${className}`} style={{ fontSize: size }} aria-hidden="true">{emoji}</span>;
  const Glyph = icons[name];
  if (!Glyph) return null;
  return <Glyph size={size} weight={['flame', 'calendar', 'clock', 'target', 'book', 'statistics', 'dashboard'].includes(name) ? 'fill' : 'bold'} className={`sf-icon ${className}`} aria-hidden="true" focusable="false" />;
}
