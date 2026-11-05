import { HashRouter } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import AppRoutes from './routes';

function App() {
  return (
    <HashRouter>
      <AppLayout>
        <AppRoutes />
      </AppLayout>
    </HashRouter>
  );
}

export default App;
