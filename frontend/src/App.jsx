import React, { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { axiosClient } from "./utils/axiosClient";

import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import HomePage from './pages/HomePage'
import DiscoverPage from './pages/DiscoverPage'
import ModelDetailPage from './pages/ModelDetailPage'
import ModelRunnerPage from './pages/ModelRunnerPage'
import DashboardPage from './pages/DashboardPage'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ProtectedRoute from './components/ProtectedRoute'

const App = () => {
  const checkServerHealth = async () => {
    try {
      const response = await axiosClient.get("/health/")
      const data = response.data
      console.log("Backend connection successful! Data:", data);
    } catch (error) {
      console.error("Backend connection failed:", error);
    }
  }

  useEffect(() => {
    checkServerHealth()
  }, [])

  return (
    <div>
      <Navbar /> {/* <h1>Header</h1> */}
      <Routes>
        <Route path='/' Component={HomePage} />
        <Route path='/discover' Component={DiscoverPage} />
        <Route path='/model/:id' Component={ModelDetailPage} />
        <Route path='/model/:id/run' Component={ModelRunnerPage} />
        <Route path='/login' Component={LoginPage} />
        <Route path='/register' Component={RegisterPage} />
        <Route path='/dashboard' element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      </Routes>
      <Footer />{/* <h1>Footer</h1> */}
    </div>
  )
}

export default App