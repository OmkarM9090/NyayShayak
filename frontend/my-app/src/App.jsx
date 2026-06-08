import Sidebar from "./components/Sidebar";
import AnalysePage from "./pages/AnalysePage";

function App() {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 p-6">
        <AnalysePage />
      </div>
    </div>
  );
}

export default App;