import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import SignIn from './components/auth/SignIn'
import SignUp from './components/auth/SignUp'
import './index.css'
import { useAuthContext } from './context/AuthProvider'
import Home from './pages/Home'
import NavBar from './components/ui/Navbar'
import RoomRouterWrapper from "./wrapper/RoomRouterWrapper";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthContext()

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!user) return <Navigate to="/signin" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthContext()

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (user) return <Navigate to="/" replace />
  return <>{children}</>
}

function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <NavBar />
      <main>
        <Routes>
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
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/room/:id"
            element={
              <ProtectedRoute>
                <RoomRouterWrapper />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
