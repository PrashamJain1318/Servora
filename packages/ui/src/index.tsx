import React from 'react';

/**
 * @servora/ui
 * Foundational UI primitives and shared components.
 */

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

  const variantStyles: Record<string, string> = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-zinc-800 text-white hover:bg-zinc-700 focus:ring-zinc-500',
    outline: 'border border-zinc-700 text-zinc-200 hover:bg-zinc-800 focus:ring-zinc-500',
    ghost: 'text-zinc-300 hover:bg-zinc-800 hover:text-white focus:ring-zinc-500',
  };

  const sizeStyles: Record<string, string> = {
    sm: 'text-xs px-3 py-1.5',
    md: 'text-sm px-4 py-2',
    lg: 'text-base px-6 py-3',
  };

  const appliedVariant = variantStyles[variant] ?? variantStyles['primary']!;
  const appliedSize = sizeStyles[size] ?? sizeStyles['md']!;

  return (
    <button className={`${baseStyles} ${appliedVariant} ${appliedSize} ${className}`} {...props}>
      {children}
    </button>
  );
};
