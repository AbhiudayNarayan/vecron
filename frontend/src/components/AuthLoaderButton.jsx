import React from 'react'

const AuthLoaderButton = ({
    isLoading =false,
    text ,
    className=''
}) => {
  
    return (
    <button disabled={isLoading ==true} className = 'flex items-centre justify-centre bg-blue-600 disabled: bg-blue cursor-pointer border-none text-white outline-none disabled:cursor-no-drop'>
        <span>
            {text}
        </span>
        <CgSpinner className ='animate-spin text-xl text-white'/>
    </button>
  )
}

export default AuthLoaderButton
