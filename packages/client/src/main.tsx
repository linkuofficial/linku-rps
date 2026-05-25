import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { Route, Switch } from 'wouter';
import './index.css';
import { I18nProvider } from './i18n';

const App = lazy(() => import('./App.tsx'));
const JoinPage = lazy(() => import('./pages/JoinPage.tsx'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage.tsx'));
const CopyrightNoticePage = lazy(() => import('./pages/CopyrightNoticePage.tsx'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <Suspense fallback={<div className="min-h-[100dvh] bg-white" />}>
        <Switch>
          <Route path="/">
            <App />
          </Route>
          <Route path="/join/:code">
            <JoinPage />
          </Route>
          <Route path="/privacy">
            <PrivacyPolicyPage />
          </Route>
          <Route path="/copyright">
            <CopyrightNoticePage />
          </Route>
        </Switch>
      </Suspense>
    </I18nProvider>
  </StrictMode>
);