import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppLayout from './layout/AppLayout'
import PdfMergePage from './pages/PdfMergePage'
import ExcelMergePage from './pages/ExcelMergePage'
import PdfToWordPage from './pages/PdfToWordPage'
import WordToPdfPage from './pages/WordToPdfPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<PdfMergePage />} />
          <Route path="/excel" element={<ExcelMergePage />} />
          <Route path="/pdf-to-word" element={<PdfToWordPage />} />
          <Route path="/word-to-pdf" element={<WordToPdfPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App