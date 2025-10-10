import { Routes, Route, Navigate } from 'react-router-dom'
import SignIn from './components/auth/SignIn'
import SignUp from './components/auth/SignUp'
import './App.css'
import { useAuthContext } from './context/AuthProvider'
import { JSX } from 'react'
import Home from './pages/Home'
import NavBar from './components/ui/Navbar'

// protected wrapper
function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuthContext()

  if (loading) return <div>Loading...</div>
  if (!user) return <Navigate to="/signin" replace />
  return children
}

// public wrapper
function PublicRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuthContext()

  if (loading) return <div>Loading...</div>
  if (user) return <Navigate to="/" replace />
  return children
}

function App() {
  return (
    <div className="app">
      {/* NavBar is always visible */}
      <NavBar />

      <main>
        <Routes>
          {/* Public routes */}
          <Route
            path="/signin"
            element={
              <PublicRoute>
                <SignIn />
              </PublicRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicRoute>
                <SignUp />
              </PublicRoute>
            }
          />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />

          {/* Fallback for unknown routes */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
