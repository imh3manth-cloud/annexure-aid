import { NavLink } from './NavLink';
import { ThemeSelector } from './ThemeSelector';
import { FileUp, LayoutDashboard, List, CheckCircle, Bell, BarChart3, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getConfig } from '@/lib/config';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const [subdivision, setSubdivision] = useState('T NARASIPURA SUB DIVISION');

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
              to="/upload"
              className="flex items-center space-x-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-gradient-to-r hover:from-primary/5 hover:to-accent/5 transition-all duration-300 relative group"
              activeClassName="text-foreground bg-background border-b-2 border-primary shadow-sm"
            >
              <FileUp className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>Upload</span>
            </NavLink>
            
            <NavLink
              to="/register"
              className="flex items-center space-x-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-gradient-to-r hover:from-primary/5 hover:to-accent/5 transition-all duration-300 relative group"
              activeClassName="text-foreground bg-background border-b-2 border-primary shadow-sm"
            >
              <List className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>Memo Register</span>
            </NavLink>
            
            <NavLink
              to="/verify"
              className="flex items-center space-x-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-gradient-to-r hover:from-primary/5 hover:to-accent/5 transition-all duration-300 relative group"
              activeClassName="text-foreground bg-background border-b-2 border-primary shadow-sm"
            >
              <CheckCircle className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>Verify Replies</span>
            </NavLink>
            
            <NavLink
              to="/reminders"
              className="flex items-center space-x-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-gradient-to-r hover:from-primary/5 hover:to-accent/5 transition-all duration-300 relative group"
              activeClassName="text-foreground bg-background border-b-2 border-primary shadow-sm"
            >
              <Bell className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>Reminders</span>
            </NavLink>
            
            <NavLink
              to="/reports"
              className="flex items-center space-x-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-gradient-to-r hover:from-primary/5 hover:to-accent/5 transition-all duration-300 relative group"
              activeClassName="text-foreground bg-background border-b-2 border-primary shadow-sm"
            >
              <BarChart3 className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>Reports</span>
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
