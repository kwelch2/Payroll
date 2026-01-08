import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface PromptOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  placeholder?: string;
  initialValue?: string;
}

type DialogState =
  | ({
      type: 'confirm';
    } & ConfirmOptions & {
      resolve: (value: boolean) => void;
    })
  | ({
      type: 'prompt';
      value: string;
    } & PromptOptions & {
      resolve: (value: string | null) => void;
    });

interface FeedbackContextValue {
  notify: (type: ToastType, message: string) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const nextId = useRef(1);

  const notify = useCallback((type: ToastType, message: string) => {
    const id = nextId.current++;
    setToasts(prev => [...prev, { id, type, message }]);
    window.setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setDialog({ type: 'confirm', resolve, ...options });
    });
  }, []);

  const prompt = useCallback((options: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      setDialog({
        type: 'prompt',
        value: options.initialValue ?? '',
        resolve,
        ...options
      });
    });
  }, []);

  const value = useMemo(() => ({ notify, confirm, prompt }), [notify, confirm, prompt]);

  const closeDialog = () => setDialog(null);

  const handleConfirm = () => {
    if (dialog?.type === 'confirm') {
      dialog.resolve(true);
      closeDialog();
    }
  };

  const handleCancel = () => {
    if (dialog?.type === 'confirm') {
      dialog.resolve(false);
      closeDialog();
      return;
    }
    if (dialog?.type === 'prompt') {
      dialog.resolve(null);
      closeDialog();
    }
  };

  const handlePromptConfirm = () => {
    if (dialog?.type === 'prompt') {
      dialog.resolve(dialog.value.trim() === '' ? null : dialog.value);
      closeDialog();
    }
  };

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      {/* Toasts */}
      <div className="fixed top-4 right-4 z-[80] space-y-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`rounded-lg px-4 py-3 text-sm shadow-lg border ${
              toast.type === 'success'
                ? 'bg-green-50 text-green-800 border-green-200'
                : toast.type === 'error'
                  ? 'bg-red-50 text-red-800 border-red-200'
                  : 'bg-blue-50 text-blue-800 border-blue-200'
            }`}
            role="status"
            aria-live="polite"
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* Dialog */}
      {dialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-gray-800 text-lg">
                {dialog.title || (dialog.type === 'confirm' ? 'Please Confirm' : 'Provide Details')}
              </h3>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">{dialog.message}</p>
              {dialog.type === 'prompt' && (
                <input
                  type="text"
                  className="input-field"
                  placeholder={dialog.placeholder || 'Enter value'}
                  value={dialog.value}
                  onChange={(e) => setDialog(prev => prev && prev.type === 'prompt' ? { ...prev, value: e.target.value } : prev)}
                />
              )}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button onClick={handleCancel} className="btn-secondary">
                {dialog.cancelLabel || 'Cancel'}
              </button>
              {dialog.type === 'confirm' && (
                <button onClick={handleConfirm} className="btn-primary">
                  {dialog.confirmLabel || 'Confirm'}
                </button>
              )}
              {dialog.type === 'prompt' && (
                <button onClick={handlePromptConfirm} className="btn-primary">
                  {dialog.confirmLabel || 'Save'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within FeedbackProvider');
  }
  return context;
}
