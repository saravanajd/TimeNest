import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import PagePlaceholder from '../components/common/PagePlaceholder';

const Settings = lazy(() => import('../pages/Settings'));
const DailyTimesheet = lazy(() => import('../pages/DailyTimesheet'));
const WeeklyView = lazy(() => import('../pages/WeeklyView'));
const MonthlyReport = lazy(() => import('../pages/MonthlyReport'));

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={
        <Suspense fallback={<div role="status">Loading timesheet...</div>}>
          <DailyTimesheet />
        </Suspense>
      } />
      <Route path="/weekly" element={<Suspense fallback={<div role="status">Loading weekly report...</div>}><WeeklyView /></Suspense>} />
      <Route path="/monthly" element={<Suspense fallback={<div role="status">Loading monthly report...</div>}><MonthlyReport /></Suspense>} />
      <Route
        path="/settings"
        element={
          <Suspense fallback={<div className="loading-state" role="status">Loading settings...</div>}>
            <Settings />
          </Suspense>
        }
      />
      <Route
        path="*"
        element={
          <PagePlaceholder
            title="Page not found"
            description="The page you are looking for does not exist."
          />
        }
      />
    </Routes>
  );
}

export default AppRoutes;
