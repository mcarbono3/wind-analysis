import React, { useState } from 'react';
import LandingPage from './components/LandingPage';
import AnalysisPage from './components/AnalysisPage';
import './App.css';

function App() {
  const [currentPage, setCurrentPage] = useState('landing');

  const handleStartAnalysis = () => {
    setCurrentPage('analysis');
  };

  const handleBackToLanding = () => {
    setCurrentPage('landing');
  };

  return (
    <div className="App">
      {currentPage === 'landing' ? (
        <LandingPage onStartAnalysis={handleStartAnalysis} />
      ) : (
        <AnalysisPage onBackToLanding={handleBackToLanding} />
      )}
    </div>
  );
}

export default App;

