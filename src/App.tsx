import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppLayout from './layout/AppLayout'
import PdfMergePage from './pages/PdfMergePage'
import ExcelMergePage from './pages/ExcelMergePage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<PdfMergePage />} />
          <Route path="/excel" element={<ExcelMergePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App