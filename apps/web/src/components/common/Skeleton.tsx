import React from 'react';

/**
 * A simple skeleton placeholder component.  Use this to indicate
 * loading state when data is being fetched.  The component can be
 * styled via the `className` prop to match the desired width and
 * height.  It uses Tailwind utility classes for a pulsing gray
 * background.
 */
export default function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}