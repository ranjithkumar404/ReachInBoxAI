import React from 'react'
import { useGoogleLogin } from '@react-oauth/google'
const Google = () => {
  const gresponse=async(res)=>{
    try {
     // if(res['code']) 
    } catch (error) {
      console.log(error)
      
    }
  }
  const glog=useGoogleLogin({
    onSuccess:gresponse,
    onError:gresponse,
    flow:'auth-code'
  })
  return (
    <div>Google</div>
  )
}

export default Google