import { Route, Routes } from 'react-router-dom';
import DailyTimesheet from '../pages/DailyTimesheet';
import MonthlyReport from '../pages/MonthlyReport';
import Settings from '../pages/Settings';
import WeeklyView from '../pages/WeeklyView';
import PagePlaceholder from '../components/common/PagePlaceholder';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DailyTimesheet />} />
      <Route path="/weekly" element={<WeeklyView />} />
      <Route path="/monthly" element={<MonthlyReport />} />
      <Route path="/settings" element={<Settings />} />
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
