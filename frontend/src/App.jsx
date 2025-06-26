import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ChatDashboard from "./components/chatDashboard";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ChatDashboard />} />
        {/* Add more routes here if needed */}
      </Routes>
    </Router>
  );
}

export default App;
