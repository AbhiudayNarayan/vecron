import React, { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
// IMPORTANT: Adjust the path below ('./api/axiosClient') to match where your file actually lives!
import { axiosClient } from "./utils/axiosClient";

import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import HomePage from './pages/HomePage'
import Navbar from './components/Navbar'
import Footer from './components/Footer'

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
        <Route path='/login' Component={LoginPage} />
        <Route path='/register' Component={RegisterPage} />
      </Routes>
      <Footer />{/* <h1>Footer</h1> */}
    </div>
  )
}

export default App