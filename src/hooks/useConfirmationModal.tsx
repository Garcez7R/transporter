import { createContext, useContext, useState, ReactNode } from 'react';

interface ConfirmationModalContextType {
  showConfirmation: (message: string, onConfirm: () => void, onCancel?: () => void) => void;
  hideConfirmation: () => void;
  isVisible: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModalContext = createContext<ConfirmationModalContextType | null>(null);

export function ConfirmationModalProvider({ children }: { children: ReactNode }) {
  const [isVisible, setIsVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [onConfirm, setOnConfirm] = useState<() => void>(() => {});
  const [onCancel, setOnCancel] = useState<() => void>(() => {});

  const showConfirmation = (msg: string, confirmCallback: () => void, cancelCallback?: () => void) => {
    setMessage(msg);
    setOnConfirm(() => confirmCallback);
    setOnCancel(() => cancelCallback || (() => {}));
    setIsVisible(true);
  };

  const hideConfirmation = () => {
    setIsVisible(false);
    setMessage('');
    setOnConfirm(() => {});
    setOnCancel(() => {});
  };

  const handleConfirm = () => {
    onConfirm();
    hideConfirmation();
  };

  const handleCancel = () => {
    onCancel();
    hideConfirmation();
  };

  return (
    <ConfirmationModalContext.Provider value={{
      showConfirmation,
      hideConfirmation,
      isVisible,
      message,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
    }}>
      {children}
    </ConfirmationModalContext.Provider>
  );
}

export function useConfirmationModal() {
  const context = useContext(ConfirmationModalContext);
  if (!context) {
    throw new Error('useConfirmationModal must be used within a ConfirmationModalProvider');
  }
  return context;
}