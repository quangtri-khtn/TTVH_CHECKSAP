import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import FlowPage from './pages/FlowPage'
import OriginPage from './pages/OriginPage'
import GrpoOverPoPage from './pages/GrpoOverPoPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/"             element={<FlowPage type="sales" />} />
        <Route path="/sales-item"   element={<FlowPage type="sales_item" />} />
        <Route path="/returns"      element={<FlowPage type="returns" />} />
        <Route path="/returns-item" element={<FlowPage type="returns_item" />} />
        <Route path="/origin"       element={<OriginPage />} />
        <Route path="/grpo-over-po" element={<GrpoOverPoPage />} />
        <Route path="/settings"     element={<SettingsPage />} />
      </Routes>
    </Layout>
  )
}
