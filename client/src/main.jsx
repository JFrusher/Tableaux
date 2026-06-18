import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthProvider.jsx'
import AuthGate from './auth/AuthGate.jsx'
import PublicShareView from './pages/PublicShareView.jsx'
import FindMySeat from './pages/FindMySeat.jsx'
import StorageNotice from './components/ui/StorageNotice.jsx'
import './styles/tokens.css'
import './styles/global.css'

// Public, account-less routes are mounted ABOVE the auth gate so opening a
// share link never triggers sign-in. Everything else is the authenticated editor.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/share/:token" element={<PublicShareView />} />
        <Route path="/seat/:token" element={<FindMySeat />} />
        <Route
          path="/*"
          element={
            <AuthProvider>
              <AuthGate>
                <App />
              </AuthGate>
            </AuthProvider>
          }
        />
      </Routes>
      <StorageNotice />
    </BrowserRouter>
  </React.StrictMode>
)
