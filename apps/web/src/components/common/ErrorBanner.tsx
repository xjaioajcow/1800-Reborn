import React from 'react';

/**
 * Display an error message in a styled banner.  Accepts any
 * throwable value; if the value contains a `message` property it
 * will be displayed, otherwise the value will be stringified.  Use
 * this component in conjunction with TanStack Query error states or
 * thrown exceptions from SDK calls.
 */
export default function ErrorBanner({ error }: { error: unknown }) {
  if (!error) return null;
  const message = (error as any).message ?? String(error);
  return (
    <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded">
      {message}
    </div>
  );
}