import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type PasswordInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** Optional icon rendered inside the field on the left (e.g. lock). */
  leftIcon?: React.ReactNode;
};

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, leftIcon, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);

    return (
      <div className="relative w-full">
        {leftIcon ? (
          <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground">
            {leftIcon}
          </span>
        ) : null}
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn('pr-11', leftIcon && 'pl-10', className)}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 z-10 h-full w-11 shrink-0 hover:bg-transparent"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          aria-pressed={visible}
          tabIndex={0}
        >
          {visible ? (
            <EyeOff className="h-4 w-4 text-muted-foreground" aria-hidden />
          ) : (
            <Eye className="h-4 w-4 text-muted-foreground" aria-hidden />
          )}
        </Button>
      </div>
    );
  },
);

PasswordInput.displayName = 'PasswordInput';
