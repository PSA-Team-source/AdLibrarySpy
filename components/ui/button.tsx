import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Loader2 as IconLoader2 } from 'lucide-react';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-[transform,opacity] duration-200 ease-out overflow-visible rounded-full disabled:pointer-events-none disabled:opacity-50 relative select-none cursor-pointer',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--primaryColor)] text-[var(--surface)] hover:bg-[var(--primaryColorHover)]',
        destructive:
          'bg-red-600 text-white hover:bg-red-700',
        outline:
          'border border-border bg-card dark:bg-transparent text-[var(--text)] hover:bg-[var(--surface-hover)] hover:border-[var(--text-muted)]/30',
        secondary:
          'bg-[var(--surface-hover)] text-[var(--text)] hover:bg-[var(--border)]',
        ghost:
          'bg-transparent hover:bg-[var(--surface-hover)] hover:text-[var(--text)]',
        link: 'text-[var(--text)] underline-offset-4 hover:underline',
        'auth-link':
          'text-[var(--primaryColor)] font-semibold hover:underline text-sm p-0 h-auto',
        'muted-link':
          'text-[var(--text-muted)] hover:text-[var(--text)] p-0 h-auto underline-offset-4',
      },
      // Every size steps UP on phones and back DOWN from `sm` (640px).
      // The desktop scale (32/40/44) is dense-by-design for a mouse; on a
      // finger it put the two most common sizes (`sm` toolbar buttons and
      // `icon` row actions) at 32px, well under the 44px iOS/WCAG floor.
      size: {
        default: 'h-11 px-4 py-2 sm:h-10',
        sm: 'h-9 px-3 text-xs sm:h-8',
        lg: 'h-12 px-6 sm:h-11',
        xl: 'h-12 px-8',
        icon: 'h-10 w-10 sm:h-8 sm:w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const RIPPLE_STYLE = `
.button-ripple-wrapper {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}
.button-ripple {
  position: absolute;
  border-radius: 50%;
  transform: scale(0);
  animation: btn-ripple 600ms ease-out;
  background-color: var(--ripple-color, rgba(255,255,255,0.25));
}
@keyframes btn-ripple {
  0% { transform: scale(0); opacity: 0.6; }
  50% { opacity: 0.3; }
  to { transform: scale(4); opacity: 0; }
}
`;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  href?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  loading?: boolean;
  loadingText?: string;
  contentClassName?: string;
  iconLabel?: string;
}

// Inject ripple style once
let rippleStyleInjected = false;
function ensureRippleStyle() {
  if (rippleStyleInjected || typeof document === 'undefined') return;
  const el = document.createElement('style');
  el.innerHTML = RIPPLE_STYLE;
  document.head.appendChild(el);
  rippleStyleInjected = true;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      onClick,
      href,
      startIcon,
      endIcon,
      loading = false,
      loadingText,
      contentClassName,
      iconLabel,
      id,
      children,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const buttonId = id || generatedId;

    const isIconOnly = !children && (startIcon || endIcon) && !loading && !loadingText;

    // Inject ripple CSS on first render
    React.useEffect(() => {
      ensureRippleStyle();
    }, []);

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
      const button = event.currentTarget as HTMLElement;

      let wrapper = button.querySelector('.button-ripple-wrapper') as HTMLSpanElement | null;
      if (!wrapper) {
        wrapper = document.createElement('span');
        wrapper.className = 'button-ripple-wrapper';
        button.prepend(wrapper);
      }

      const ripple = document.createElement('span');
      const rect = button.getBoundingClientRect();
      const rippleSize = Math.max(rect.width, rect.height) * 2;
      const x = event.clientX - rect.left - rippleSize / 2;
      const y = event.clientY - rect.top - rippleSize / 2;

      let rippleColor = 'rgba(255,255,255,0.25)';
      if (variant === 'secondary' || variant === 'outline' || variant === 'ghost') {
        rippleColor = 'rgba(0,0,0,0.1)';
      } else if (variant === 'auth-link' || variant === 'link') {
        rippleColor = 'rgba(59,130,246,0.2)';
      }

      ripple.className = 'button-ripple';
      ripple.style.setProperty('--ripple-color', rippleColor);
      ripple.style.width = ripple.style.height = `${rippleSize}px`;
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;

      wrapper.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);

      if (onClick) onClick(event as React.MouseEvent<HTMLButtonElement>);
    };

    const buttonContent = (
      <>
        <span className="button-ripple-wrapper" aria-hidden />
        <span className={cn('z-[1] inline-flex items-center', contentClassName)}>
          {loading && (
            <IconLoader2 className="me-2 h-4 w-4 animate-spin" aria-hidden />
          )}
          {!loading && startIcon && (
            <span className="me-2 flex items-center" aria-hidden>
              {startIcon}
            </span>
          )}
          {loading ? (loadingText ?? children) : children}
          {!loading && endIcon && (
            <span className="ms-2 flex items-center" aria-hidden>
              {endIcon}
            </span>
          )}
        </span>
      </>
    );

    // Render as Link or anchor when href is provided
    if (href) {
      const isExternal =
        href.startsWith('http://') ||
        href.startsWith('https://') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:');

      const commonProps = {
        id: buttonId,
        className: cn(buttonVariants({ variant, size, className })),
        onClick: handleClick,
        'aria-label': isIconOnly ? iconLabel : undefined,
        'aria-busy': loading ? ('true' as const) : undefined,
        'aria-disabled': props.disabled ? ('true' as const) : undefined,
      };

      if (isExternal) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            {...commonProps}
            {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
          >
            {buttonContent}
          </a>
        );
      }

      return (
        <Link
          href={href}
          {...commonProps}
          {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {buttonContent}
        </Link>
      );
    }

    // asChild mode — pass-through, no injected wrappers
    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          onClick={handleClick}
          {...props}
        >
          {children as React.ReactElement}
        </Slot>
      );
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        id={buttonId}
        ref={ref}
        disabled={loading || props.disabled}
        onClick={handleClick}
        aria-label={isIconOnly ? iconLabel : undefined}
        aria-busy={loading ? 'true' : undefined}
        {...props}
      >
        {buttonContent}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
