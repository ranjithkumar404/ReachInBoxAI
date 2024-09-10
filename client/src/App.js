
import React, { useState, useEffect } from 'react';
import Home from './Pages/Home';
import {BrowserRouter as Router, Routes, Route,Navigate} from 'react-router-dom';
import Google from './Pages/Google';
import PageNotFound from './Pages/PageNotFound';
import {GoogleOAuthProvider} from '@react-oauth/google';
function App() {
const GoogleAuthWrapper = () => {
return(
  <GoogleOAuthProvider clientId='258666629023-4f38cbbss4042bearpl37t3n98r66gnl.apps.googleusercontent.com'>
    <Google></Google>
  </GoogleOAuthProvider>
)
}
  return (
    <div className="App p-3 flex flex-col w-screen h-screen items-center justify-center">
     <Router>
        <Routes>
          <Route path="/" element={<Navigate to='/login'/>} />
          <Route path="/login" element={<GoogleAuthWrapper />} />
          <Route path="*" element={<PageNotFound/>} />
          </Routes>
     </Router>
      </div>
  );
}

export default App;
