import { NavLink } from './NavLink';
import { ThemeSelector } from './ThemeSelector';
import { FileUp, LayoutDashboard, List, CheckCircle, Bell, BarChart3, Settings, Users, Grid3X3, ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getConfig } from '@/lib/config';
import { useNavigate, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

export const menuItems = [
  { to: '/upload', icon: FileUp, label: 'Upload', description: 'Upload withdrawal data', color: 'from-blue-500 to-blue-600' },
  { to: '/register', icon: List, label: 'Memo Register', description: 'View & manage memos', color: 'from-emerald-500 to-emerald-600' },
  { to: '/verify', icon: CheckCircle, label: 'Verify Replies', description: 'Verify BO responses', color: 'from-violet-500 to-violet-600' },
  { to: '/reminders', icon: Bell, label: 'Reminders', description: 'Pending reminders', color: 'from-amber-500 to-amber-600' },
  { to: '/reports', icon: BarChart3, label: 'Reports', description: 'Generate reports', color: 'from-rose-500 to-rose-600' },
];

export const Layout = ({ children }: LayoutProps) => {
  const [subdivision, setSubdivision] = useState('T NARASIPURA SUB DIVISION');
  const navigate = useNavigate();
  const location = useLocation();

  const isOperationsPage = menuItems.some(item => location.pathname === item.to);
  const showOperationsGrid = location.pathname === '/operations';

  useEffect(() => {
    const loadConfig = () => {
      const config = getConfig();
      setSubdivision(config.subdivision);
    };
    
    loadConfig();
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'appConfig') {
        loadConfig();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    const handleConfigChange = () => loadConfig();
    window.addEventListener('configUpdated', handleConfigChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('configUpdated', handleConfigChange);
    };
  }, []);

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
            
            <NavLink
              to="/operations"
              className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-all duration-300 relative group ${
                isOperationsPage 
                  ? 'text-foreground bg-background border-b-2 border-primary shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-gradient-to-r hover:from-primary/5 hover:to-accent/5'
              }`}
              activeClassName="text-foreground bg-background border-b-2 border-primary shadow-sm"
            >
              <Grid3X3 className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>Operations</span>
            </NavLink>
            
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