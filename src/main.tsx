import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
<<<<<<< HEAD
=======
import ErrorBoundary from './components/ErrorBoundary'
>>>>>>> fix/password-reset-otp-admin-api
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
<<<<<<< HEAD
    <BrowserRouter>
      <App />
    </BrowserRouter>
=======
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
>>>>>>> fix/password-reset-otp-admin-api
  </React.StrictMode>,
)
