import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut } from 'lucide-react';
import { useAuth } from '../context/MainContext';
import BrandMark from './BrandMark';

const Navbar = () => {
    const { isLoggedIn, logout } = useAuth();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);

    const handleLogout = () => {
        setOpen(false);
        logout();
        navigate('/login');
    };

    const links = [
        { to: '/', label: 'Home', end: true },
        { to: '/discover', label: 'Browse' },
        { to: '/feed', label: 'Public Feed' },
        ...(isLoggedIn ? [{ to: '/dashboard', label: 'Dashboard' }] : []),
    ];

    const linkClass = ({ isActive }) =>
        [
            'rounded-md px-3 py-2 text-sm font-semibold transition-colors',
            isActive
                ? 'bg-primary-soft text-primary-soft-ink'
                : 'text-muted hover:bg-surface-2 hover:text-ink',
        ].join(' ');

    return (
        <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
            <div className="container-page flex h-16 items-center justify-between gap-4">
                {/* Brand */}
                <Link
                    to="/"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5"
                    aria-label="Kriya home"
                >
                    <BrandMark className="h-9 w-9" />
                    <span className="text-xl font-extrabold tracking-tight text-ink">Kriya</span>
                </Link>

                {/* Desktop nav */}
                <nav className="hidden items-center gap-1 md:flex">
                    {links.map((l) => (
                        <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
                            {l.label}
                        </NavLink>
                    ))}
                </nav>

                {/* Desktop auth actions */}
                <div className="hidden items-center gap-2 md:flex">
                    {isLoggedIn ? (
                        <button onClick={handleLogout} className="btn btn-ghost btn-sm">
                            <LogOut className="h-4 w-4" />
                            Logout
                        </button>
                    ) : (
                        <>
                            <Link to="/login" className="btn btn-ghost btn-sm">
                                Login
                            </Link>
                            <Link to="/register" className="btn btn-primary btn-sm">
                                Get started
                            </Link>
                        </>
                    )}
                </div>

                {/* Mobile toggle */}
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    className="btn btn-ghost btn-sm md:hidden"
                    aria-label={open ? 'Close menu' : 'Open menu'}
                    aria-expanded={open}
                >
                    {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>
            </div>

            {/* Mobile menu */}
            {open && (
                <nav className="border-t border-line bg-surface md:hidden">
                    <div className="container-page flex flex-col gap-1 py-3">
                        {links.map((l) => (
                            <NavLink
                                key={l.to}
                                to={l.to}
                                end={l.end}
                                onClick={() => setOpen(false)}
                                className={linkClass}
                            >
                                {l.label}
                            </NavLink>
                        ))}
                        <div className="mt-2 flex flex-col gap-2 border-t border-line pt-3">
                            {isLoggedIn ? (
                                <button onClick={handleLogout} className="btn btn-secondary btn-block">
                                    <LogOut className="h-4 w-4" />
                                    Logout
                                </button>
                            ) : (
                                <>
                                    <Link
                                        to="/login"
                                        onClick={() => setOpen(false)}
                                        className="btn btn-secondary btn-block"
                                    >
                                        Login
                                    </Link>
                                    <Link
                                        to="/register"
                                        onClick={() => setOpen(false)}
                                        className="btn btn-primary btn-block"
                                    >
                                        Get started
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </nav>
            )}
        </header>
    );
};

export default Navbar;
