import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { cn } from '@/lib/utils';

type Props = {
  className?: string;
};

export const ThemeToggle = ({ className }: Props) => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-lg"
        disabled
      >
        <div className="h-4 w-4 animate-pulse bg-muted rounded" />
      </Button>
    );
  }

  const isDark = resolvedTheme === 'dark';

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className={cn(
            'h-9 w-9 rounded-lg relative overflow-hidden group hover:bg-muted transition-all duration-300',
            className
          )}
          aria-label={isDark ? 'Activer le mode clair' : 'Activer le mode sombre'}
        >
          {/* Sun icon - visible in dark mode */}
          <Sun 
            className={`h-4 w-4 absolute transition-all duration-500 ease-out ${
              isDark 
                ? 'rotate-0 scale-100 opacity-100' 
                : 'rotate-90 scale-0 opacity-0'
            }`}
          />
          {/* Moon icon - visible in light mode */}
          <Moon 
            className={`h-4 w-4 absolute transition-all duration-500 ease-out ${
              isDark 
                ? '-rotate-90 scale-0 opacity-0' 
                : 'rotate-0 scale-100 opacity-100'
            }`}
          />
          <span className="sr-only">
            {isDark ? 'Activer le mode clair' : 'Activer le mode sombre'}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {isDark ? 'Mode clair' : 'Mode sombre'}
      </TooltipContent>
    </Tooltip>
  );
};
