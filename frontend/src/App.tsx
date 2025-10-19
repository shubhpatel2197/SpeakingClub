import React, { Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import SignIn from './components/auth/SignIn'
import SignUp from './components/auth/SignUp'
import './App.css'
import { useAuthContext } from './context/AuthProvider'
import Home from './pages/Home'
import NavBar from './components/ui/Navbar'
import { RoomRouteWrapper } from './wrapper/RoomRouterWrapper'

// lazy load Room to reduce initial bundle
const Room = React.lazy(() => import('./pages/Room'))

// ProtectedRoute accepts any React node as children
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthContext()

  if (loading) return <div>Loading...</div>
  if (!user) return <Navigate to="/signin" replace />
  return <>{children}</>
}

// PublicRoute accepts any React node as children
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthContext()

  if (loading) return <div>Loading...</div>
  if (user) return <Navigate to="/" replace />
  return <>{children}</>
}

function App() {
  return (
    <div className="app">
      
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

          {/* Room route (protected) - lazy loaded */}
          <Route
            path="/room/:id"
            element={
              <ProtectedRoute>
                <Suspense fallback={<div>Loading room...</div>}>
                   <RoomRouteWrapper />
                </Suspense>
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
