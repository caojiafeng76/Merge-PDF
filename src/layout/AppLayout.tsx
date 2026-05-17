import { NavLink, Outlet } from 'react-router-dom'
import './AppLayout.css'

export default function AppLayout() {
  return (
    <>
      <nav className="app-nav">
        <div className="nav-inner">
          <NavLink
            to="/"
            className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
            end
          >
            PDF 合并
          </NavLink>
          <NavLink
            to="/excel"
            className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          >
            Excel 合并
          </NavLink>
        </div>
      </nav>
      <Outlet />
    </>
  )
}