import React from 'react'
import { Link } from 'react-router-dom'
const Home = () => {
  return (
    <div className='flex space-y-4 flex-col bg-slate-300 rounded-md h-[500px] w-[500px] text-white place-items-center justify-center'>
        <h1 className='text-2xl'>Log Into Your Account!</h1>
        <Link className='text-xl hover:underline' to="/login">GOOGLE LOGIN</Link>
    </div>
  )
}

export default Home