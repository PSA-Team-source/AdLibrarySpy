import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // text-base on phones: iOS Safari ZOOMS the whole page whenever a focused
          // field renders below 16px, then leaves the viewport scaled — every form
          // in the product did this on every tap. 14px returns from `sm` up.
          'flex h-11 w-full rounded-md border border-[hsl(var(--input-border))] bg-input px-3 py-2 text-base sm:h-10 sm:text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
