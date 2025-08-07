import React from 'react';

/**
 * A small button used for setting the maximum allowable value in
 * input forms.  Displays the text "Max" and can be disabled.  Use
 * this component next to numeric inputs to allow users to fill the
 * input with their full balance or capacity.
 */
export default function MaxButton({
  onClick,
  disabled = false,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`ml-2 px-2 py-1 text-sm rounded border border-blue-400 text-blue-500 disabled:opacity-50`}
    >
      Max
    </button>
  );
}