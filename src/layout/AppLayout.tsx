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
          <NavLink
            to="/pdf-to-word"
            className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          >
            PDF 转 Word
          </NavLink>
        </div>
      </nav>
      <Outlet />
    </>
  )
}