import React from "react";
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowRightLeft,
  ArrowUp,
  Banknote,
  BarChart3,
  Bell,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  CreditCard,
  Download,
  Eye,
  FileText,
  Filter,
  HelpCircle,
  History,
  Home,
  Info,
  LayoutDashboard,
  Leaf,
  ListChecks,
  Mail,
  Menu,
  Moon,
  MoreHorizontal,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  PieChart,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Store,
  Sun,
  TrendingUp,
  Trophy,
  Truck,
  User,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  Wrench,
  X,
  AlertTriangle,
  DollarSign,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Les icônes du tableau de bord et de la coquille : celles de
 * l'application (Lucide, trait simple), appelées par un nom court.
 */
const ICONES = {
  home: Home,
  clipboard: ClipboardList,
  history: History,
  grid: LayoutDashboard,
  tasks: ListChecks,
  calendar: Calendar,
  bell: Bell,
  dollar: DollarSign,
  wallet: Wallet,
  box: Package,
  users: Users,
  user: User,
  userplus: UserPlus,
  usercheck: UserCheck,
  search: Search,
  help: HelpCircle,
  moon: Moon,
  sun: Sun,
  settings: Settings,
  cart: ShoppingCart,
  bag: ShoppingBag,
  clock: Clock,
  trophy: Trophy,
  chart: BarChart3,
  truck: Truck,
  check: Check,
  mail: Mail,
  plus: Plus,
  filter: Filter,
  alert: AlertTriangle,
  refresh: RefreshCw,
  swap: ArrowRightLeft,
  file: FileText,
  receipt: Receipt,
  card: CreditCard,
  wrench: Wrench,
  banknote: Banknote,
  zap: Zap,
  info: Info,
  pie: PieChart,
  trend: TrendingUp,
  pulse: Activity,
  download: Download,
  arrowleft: ArrowLeft,
  arrowdown: ArrowDown,
  arrowup: ArrowUp,
  chevright: ChevronRight,
  chevleft: ChevronLeft,
  chevdown: ChevronDown,
  menu: Menu,
  x: X,
  dots: MoreHorizontal,
  eye: Eye,
  store: Store,
  leaf: Leaf,
  sidebarclose: PanelLeftClose,
  sidebaropen: PanelLeftOpen,
} satisfies Record<string, LucideIcon>;

export type NomIcone = keyof typeof ICONES;

export const Icone: React.FC<{
  nom: NomIcone;
  className?: string;
  style?: React.CSSProperties;
  titre?: string;
}> = ({ nom, className, style, titre }) => {
  const Composant = ICONES[nom];
  return (
    <span
      className={`ico${className ? ` ${className}` : ""}`}
      style={style}
      role={titre ? "img" : undefined}
      aria-label={titre}
      aria-hidden={titre ? undefined : true}
    >
      <Composant />
    </span>
  );
};
