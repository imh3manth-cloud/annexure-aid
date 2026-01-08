import { NavLink } from './NavLink';
import { ThemeSelector } from './ThemeSelector';
import { FileUp, LayoutDashboard, List, CheckCircle, Bell, BarChart3, Settings, Users, Grid3X3 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getConfig } from '@/lib/config';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LayoutProps {
  children: React.ReactNode;
}

const menuItems = [
  { to: '/upload', icon: FileUp, label: 'Upload', color: 'bg-blue-500', hoverColor: 'hover:bg-blue-600' },
  { to: '/register', icon: List, label: 'Memo Register', color: 'bg-emerald-500', hoverColor: 'hover:bg-emerald-600' },
  { to: '/verify', icon: CheckCircle, label: 'Verify Replies', color: 'bg-violet-500', hoverColor: 'hover:bg-violet-600' },
  { to: '/reminders', icon: Bell, label: 'Reminders', color: 'bg-amber-500', hoverColor: 'hover:bg-amber-600' },
  { to: '/reports', icon: BarChart3, label: 'Reports', color: 'bg-rose-500', hoverColor: 'hover:bg-rose-600' },
];

export const Layout = ({ children }: LayoutProps) => {
  const [subdivision, setSubdivision] = useState('T NARASIPURA SUB DIVISION');
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isMenuItemActive = menuItems.some(item => location.pathname === item.to);

  useEffect(() => {
    const loadConfig = () => {
      const config = getConfig();
      setSubdivision(config.subdivision);
    };
    
    loadConfig();
    
    // Listen for storage changes (when settings are updated)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'appConfig') {
        loadConfig();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom event from same tab
    const handleConfigChange = () => loadConfig();
    window.addEventListener('configUpdated', handleConfigChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('configUpdated', handleConfigChange);
    };
  }, []);

  const handleMenuItemClick = (to: string) => {
    navigate(to);
    setMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">IP</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">India Post</h1>
                <p className="text-xs text-muted-foreground">High-Value Withdrawal Verification</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                {subdivision}
              </div>
              <ThemeSelector />
            </div>
          </div>
        </div>
      </header>
      
      <div className="border-b border-border bg-secondary/30">
        <div className="container mx-auto px-4">
          <nav className="flex space-x-1">
            <NavLink
              to="/"
              className="flex items-center space-x-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-gradient-to-r hover:from-primary/5 hover:to-accent/5 transition-all duration-300 relative group"
              activeClassName="text-foreground bg-background border-b-2 border-primary shadow-sm"
            >
              <LayoutDashboard className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>Dashboard</span>
            </NavLink>
            
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-all duration-300 relative group ${
                    isMenuItemActive 
                      ? 'text-foreground bg-background border-b-2 border-primary shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-gradient-to-r hover:from-primary/5 hover:to-accent/5'
                  }`}
                >
                  <Grid3X3 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span>Operations</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="p-3 w-[320px]" align="start">
                <div className="grid grid-cols-2 gap-2">
                  {menuItems.map((item) => (
                    <button
                      key={item.to}
                      onClick={() => handleMenuItemClick(item.to)}
                      className={`flex flex-col items-center justify-center p-4 rounded-lg text-white transition-all duration-200 transform hover:scale-105 ${item.color} ${item.hoverColor} ${
                        location.pathname === item.to ? 'ring-2 ring-offset-2 ring-offset-background ring-white' : ''
                      }`}
                    >
                      <item.icon className="w-6 h-6 mb-2" />
                      <span className="text-xs font-medium text-center">{item.label}</span>
                    </button>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <NavLink
              to="/accounts"
              className="flex items-center space-x-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-gradient-to-r hover:from-primary/5 hover:to-accent/5 transition-all duration-300 relative group"
              activeClassName="text-foreground bg-background border-b-2 border-primary shadow-sm"
            >
              <Users className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>Account Details</span>
            </NavLink>
            
            <NavLink
              to="/settings"
              className="flex items-center space-x-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-gradient-to-r hover:from-primary/5 hover:to-accent/5 transition-all duration-300 relative group"
              activeClassName="text-foreground bg-background border-b-2 border-primary shadow-sm"
            >
              <Settings className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>Settings</span>
            </NavLink>
          </nav>
        </div>
      </div>
      
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
};