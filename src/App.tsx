import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import './index.css';

function App() {
  // sidebarOpen state available in store for sidebar visibility

  return (
    <div className="flex h-screen bg-neon-black overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Dashboard />
      </div>
    </div>
  );
}

export default App;
