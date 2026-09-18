import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import Shell from './components/Shell'
import Home from './pages/Home'
import { LangProvider } from './lib/i18n'
import Boot from './components/Boot'

const Scan = lazy(() => import('./pages/Scan'))
const Ask = lazy(() => import('./pages/Ask'))
const Plan = lazy(() => import('./pages/Plan'))
const Stay = lazy(() => import('./pages/Stay'))
const Food = lazy(() => import('./pages/Food'))
const Parking = lazy(() => import('./pages/Parking'))
const Safety = lazy(() => import('./pages/Safety'))
const PlaceDetail = lazy(() => import('./pages/PlaceDetail'))
const Local = lazy(() => import('./pages/Local'))
const HowAI = lazy(() => import('./pages/HowAI'))
const Command = lazy(() => import('./pages/Command'))
const Access = lazy(() => import('./pages/Access'))

const Loading = () => <div className="grid min-h-[50vh] place-items-center text-ink-3">…</div>

export default function App() {
  return (
    <LangProvider>
      <Boot />
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/command" element={<Command />} />
            <Route element={<Shell />}>
              <Route index element={<Home />} />
              <Route path="scan" element={<Scan />} />
              <Route path="ask" element={<Ask />} />
              <Route path="plan" element={<Plan />} />
              <Route path="stay" element={<Stay />} />
              <Route path="food" element={<Food />} />
              <Route path="parking" element={<Parking />} />
              <Route path="safety" element={<Safety />} />
              <Route path="local" element={<Local />} />
              <Route path="how" element={<HowAI />} />
              <Route path="access" element={<Access />} />
              <Route path="place/:id" element={<PlaceDetail />} />
              <Route path="*" element={<Home />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </LangProvider>
  )
}
