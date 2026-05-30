import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Sessions from './pages/Sessions'
import Operators from './pages/Operators'
import Allocations from './pages/Allocations'
import Invoices from './pages/Invoices'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Help from './pages/Help'
import Monitor from './pages/Monitor'
import Simulator from './pages/Simulator'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/operators" element={<Operators />} />
            <Route path="/allocations" element={<Allocations />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/help" element={<Help />} />
            <Route path="/monitor" element={<Monitor />} />
            <Route path="/simulator" element={<Simulator />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
