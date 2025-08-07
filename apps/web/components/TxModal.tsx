import React, { useState } from 'react';
import { colors } from '../src/styles/colors';

interface TxModalProps {
  /** Whether the modal is visible. */
  open: boolean;
  /** Called when the user clicks the close button or the overlay. */
  onClose: () => void;
  /** Title displayed at the top of the modal. */
  title?: string;
  /** Current ship price in wei or smallest denomination. */
  price?: bigint;
  /** Estimated gas cost in units. */
  gas?: bigint;
  /** Called when the user confirms the transaction. Should return a promise. */
  onConfirm: () => Promise<any>;
}

/**
 * A reusable transaction modal that guides the user through the
 * lifecycle of a blockchain transaction. It displays price and
 * gas information up front and reports status changes as the
 * transaction progresses. Consumers are responsible for passing
 * an async onConfirm function that performs the actual write.
 */
export default function TxModal({
  open,
  onClose,
  title,
  price,
  gas,
  onConfirm,
}: TxModalProps) {
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!open) return null;

  async function handleConfirm() {
    setStatus('pending');
    setErrorMsg(null);
    try {
      await onConfirm();
      setStatus('success');
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err?.message ?? 'Transaction failed');
    }
  }

  const renderStatus = () => {
    switch (status) {
      case 'pending':
        return <p className="text-gray-700">等待链上确认…</p>;
      case 'success':
        return <p className="text-green-600">交易成功！</p>;
      case 'error':
        return <p className="text-red-600">{errorMsg ?? '交易失败'}</p>;
      default:
        return null;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl p-6 w-96"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-4" style={{ color: colors.primary }}>
          {title ?? '交易确认'}
        </h2>
        {price !== undefined && (
          <p className="mb-2 text-sm text-gray-600">船价： {price.toString()}</p>
        )}
        {gas !== undefined && (
          <p className="mb-4 text-sm text-gray-600">预估 Gas： {gas.toString()}</p>
        )}
        {renderStatus()}
        {status === 'idle' && (
          <div className="flex justify-end space-x-3 mt-4">
            <button
              className="px-4 py-2 rounded bg-gray-200 text-gray-800"
              onClick={onClose}
            >
              取消
            </button>
            <button
              className="px-4 py-2 rounded"
              style={{ backgroundColor: colors.primary, color: 'white' }}
              onClick={handleConfirm}
            >
              确认
            </button>
          </div>
        )}
        {status !== 'idle' && (
          <div className="flex justify-end mt-4">
            <button
              className="px-4 py-2 rounded"
              style={{ backgroundColor: colors.primary, color: 'white' }}
              onClick={onClose}
            >
              关闭
            </button>
          </div>
        )}
      </div>
    </div>
  );
}