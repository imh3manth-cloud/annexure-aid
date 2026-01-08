import { useNavigate, useLocation } from 'react-router-dom';
import { menuItems } from '@/components/Layout';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const Operations = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Operations</h2>
          <p className="text-muted-foreground mt-1">Select an operation to proceed</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {menuItems.map((item) => (
          <button
            key={item.to}
            onClick={() => navigate(item.to)}
            className={`relative overflow-hidden rounded-xl p-6 text-white bg-gradient-to-r ${item.color} 
              transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:-translate-y-1
              group cursor-pointer text-left`}
          >
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-full group-hover:scale-110 transition-transform">
                <item.icon className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold">{item.label}</h3>
                <p className="text-sm text-white/80">{item.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};