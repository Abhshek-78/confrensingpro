import './App.css'
import Landing from './pages/Landing'
import Authentication from './pages/Authentication.jsx'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from './contexts/Authcontex.jsx';
import VideoMeet from './pages/VideoMeet.jsx';

function App() {
  

  return (
    <BrowserRouter>
    <AuthProvider>
      <Routes>

        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Authentication />}/>
        <Route path="/:url" element={<VideoMeet />}/>
        
      </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
