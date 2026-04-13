import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ConfirmationModalProvider } from './hooks/useConfirmationModal';
import './styles.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <ConfirmationModalProvider>
      <App />
    </ConfirmationModalProvider>
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        registration.update().catch(() => undefined);

        const updateOnFocus = () => registration.update().catch(() => undefined);
        window.addEventListener('focus', updateOnFocus);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            updateOnFocus();
          }
        });

        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload();
        });
      })
      .catch(() => undefined);
  });
}
