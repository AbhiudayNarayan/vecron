import React from 'react'

const AuthLoaderButton = ({
    isLoading = false,
    text,
    className = ''
}) => {

    return (
        <button
            disabled={isLoading}
            className={`flex items-center justify-center gap-2 bg-blue-600 text-white border-none outline-none cursor-pointer transition hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed ${className}`}
        >
            {isLoading && (
                <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
            )}
            <span>{text}</span>
        </button>
    )
}

export default AuthLoaderButton
