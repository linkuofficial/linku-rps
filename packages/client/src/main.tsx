import '@fontsource-variable/geist';
import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { Route, Switch, Redirect } from 'wouter';
import './index.css';
import { I18nProvider } from './i18n';

const App = lazy(() => import('./App.tsx'));
const JoinPage = lazy(() => import('./pages/JoinPage.tsx'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage.tsx'));
const CopyrightNoticePage = lazy(() => import('./pages/CopyrightNoticePage.tsx'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <Suspense fallback={
        <div className="min-h-[100dvh] bg-surface flex items-center justify-center">
          <div className="inline-flex items-center gap-2 text-on-surface-variant text-label-sm">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-on-surface-variant border-t-transparent" aria-hidden="true" />
            <span>Loading…</span>
          </div>
        </div>
      }>
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
          <Route>
            <Redirect to="/" />
          </Route>
        </Switch>
      </Suspense>
    </I18nProvider>
  </StrictMode>
);