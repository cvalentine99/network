import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import {
  Activity,
  CircleDot,
  HelpCircle,
  LayoutDashboard,
  Network,
  PanelLeft,
  Radio,
  Settings,
  Target,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { GOLD, MUTED, BRIGHT, CYAN } from "./DashboardWidgets";

type MenuItem = {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  path: string;
  placeholder?: boolean;
};

type MenuSection = {
  title: string;
  items: MenuItem[];
};

const menuSections: MenuSection[] = [
  {
    title: "Monitoring",
    items: [
      { icon: LayoutDashboard, label: "Impact Deck", path: "/" },
      { icon: Activity, label: "Flow Theater", path: "/flow-theater" },
      { icon: Target, label: "Blast Radius", path: "/blast-radius" },
    ],
  },
  {
    title: "Analysis",
    items: [
      { icon: CircleDot, label: "Correlation", path: "/correlation", placeholder: true },
      { icon: Network, label: "Topology", path: "/topology", placeholder: true },
    ],
  },
  {
    title: "System",
    items: [
      { icon: Settings, label: "Settings", path: "/settings" },
      { icon: HelpCircle, label: "Help", path: "/help", placeholder: true },
    ],
  },
];

const allMenuItems = menuSections.flatMap(s => s.items);

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = allMenuItems.find((item) => item.path === location);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft =
        sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4" style={{ color: GOLD }} />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <Radio className="h-4 w-4 shrink-0" style={{ color: CYAN }} />
                  <span
                    className="font-semibold tracking-tight truncate text-sm"
                    style={{ color: BRIGHT }}
                  >
                    NetPerf NOC
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            {menuSections.map((section) => (
              <div key={section.title}>
                {!isCollapsed && (
                  <div className="px-4 py-2 mt-2 first:mt-0">
                    <p
                      className="text-[9px] font-bold uppercase tracking-widest"
                      style={{ color: MUTED }}
                    >
                      {section.title}
                    </p>
                  </div>
                )}
                <SidebarMenu className="px-2 py-1">
                  {section.items.map((item) => {
                    const isActive = location === item.path;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => {
                            if (item.placeholder) {
                              toast("Coming soon", { description: `${item.label} is not yet implemented.` });
                              return;
                            }
                            setLocation(item.path);
                          }}
                          tooltip={item.label}
                          className="h-10 transition-all font-normal"
                        >
                          <item.icon
                            className="h-4 w-4"
                            style={{ color: isActive ? GOLD : item.placeholder ? "oklch(0.45 0 0)" : MUTED }}
                          />
                          <span
                            className="text-sm"
                            style={{
                              color: isActive ? BRIGHT : item.placeholder ? "oklch(0.45 0 0)" : MUTED,
                            }}
                          >
                            {item.label}
                          </span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </div>
            ))}
          </SidebarContent>

          <SidebarFooter className="p-3" />
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div
            className="flex h-14 items-center justify-between px-2 backdrop-blur sticky top-0 z-40"
            style={{
              background: "oklch(0.05 0 0 / 95%)",
              borderBottom: "1px solid oklch(1 0 0 / 8%)",
            }}
          >
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg" />
              <div className="flex items-center gap-3">
                <span className="tracking-tight text-foreground text-sm">
                  {activeMenuItem?.label ?? "Menu"}
                </span>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
