// Central icon component — the design system uses Lucide line icons (the canvas
// loads lucide via unpkg), so the app renders the same set through
// lucide-react-native (vector, via react-native-svg). This replaces the emoji
// stand-ins used across screens before the icon system landed.
//
// Usage: <Icon name="house" size={22} color="#443F4E" />. `name` is the Lucide
// kebab id (matches the canvas's data-lucide); the map below pulls in only the
// icons we actually use so the bundle stays lean.
import {
  ArrowDown,
  Bed,
  Bell,
  Book,
  BookOpen,
  Calendar,
  CalendarClock,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleCheckBig,
  Clock,
  Dog,
  Gift,
  House,
  Inbox,
  LayoutDashboard,
  Lightbulb,
  ListTodo,
  Lock,
  LogOut,
  Mail,
  Minus,
  Moon,
  MoreHorizontal,
  Pencil,
  PiggyBank,
  Plus,
  Repeat,
  Settings,
  ShoppingBag,
  Smile,
  Sparkles,
  Star,
  Sun,
  Trash2,
  TrendingUp,
  Users,
  Utensils,
  X,
  type LucideIcon,
} from 'lucide-react-native';

// Default icon color = body text (--text-body / ink-700) from the design tokens.
const DEFAULT_COLOR = '#443F4E';

const ICONS = {
  'arrow-down': ArrowDown,
  bed: Bed,
  bell: Bell,
  book: Book,
  'book-open': BookOpen,
  calendar: Calendar,
  'calendar-clock': CalendarClock,
  camera: Camera,
  check: Check,
  'check-circle': CheckCircle2,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  circle: Circle,
  'circle-check-big': CircleCheckBig,
  clock: Clock,
  dog: Dog,
  gift: Gift,
  house: House,
  inbox: Inbox,
  'layout-dashboard': LayoutDashboard,
  lightbulb: Lightbulb,
  'list-todo': ListTodo,
  lock: Lock,
  'log-out': LogOut,
  mail: Mail,
  minus: Minus,
  moon: Moon,
  'more-horizontal': MoreHorizontal,
  pencil: Pencil,
  'piggy-bank': PiggyBank,
  plus: Plus,
  repeat: Repeat,
  settings: Settings,
  'shopping-bag': ShoppingBag,
  smile: Smile,
  sparkles: Sparkles,
  star: Star,
  sun: Sun,
  'trash-2': Trash2,
  'trending-up': TrendingUp,
  users: Users,
  utensils: Utensils,
  x: X,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 24,
  color = DEFAULT_COLOR,
  strokeWidth = 2,
  fill = 'none',
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
}) {
  const Cmp = ICONS[name];
  return <Cmp size={size} color={color} strokeWidth={strokeWidth} fill={fill} />;
}
