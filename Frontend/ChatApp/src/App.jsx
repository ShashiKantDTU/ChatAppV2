import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AuthProvider from './components/authcontext/authcontext.jsx';
import DarkSignupForm from './pages/signup.jsx';
import DarkLoginForm from './pages/login.jsx';
import CheckAuth from './checkauth.jsx';
import ChatApp from './ChatApp.jsx';
import PrivateRoute from './components/privateroutes.jsx';
import Logout from './components/logout.jsx';

function App() {
  return (
    <Router> {/* ✅ Wrap everything inside Router */}
      <AuthProvider> {/* ✅ Now inside Router */}
        <Routes>
          <Route path="/" element={<PrivateRoute><ChatApp /></PrivateRoute>} />
          <Route path="/checkauth" element={<CheckAuth />} />
          <Route path="/signup" element={<DarkSignupForm />} />
          <Route path="/login" element={<DarkLoginForm />} />
          <Route path="/logout" element={<Logout />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
