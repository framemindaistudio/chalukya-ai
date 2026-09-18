import { useEffect, useState } from 'react'

/*
  Live weather from Open-Meteo (free, no key) when online. Offline, it falls back to typical
  monthly maximum temperatures for Badami, and says it is doing so.
*/
export type Weather = { tempC: number; feelsC: number; rainPct: number | null; live: boolean; hourly?: { h: number; feels: number }[] }
const TYPICAL_MAX = [30, 33, 36, 38, 38, 32, 29, 29, 30, 30, 29, 28] // °C, approximate climate normals

let cache: { at: number; w: Weather } | null = null
export async function getWeather(lat = 15.918, lng = 75.684): Promise<Weather> {
  if (cache && Date.now() - cache.at < 20 * 60_000) return cache.w
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,apparent_temperature,precipitation&hourly=apparent_temperature,precipitation_probability&timezone=Asia%2FKolkata&forecast_days=1`
    const r = await fetch(u, { signal: AbortSignal.timeout(4000) })
    const j = await r.json()
    const hour = new Date().getHours()
    const w: Weather = {
      tempC: Math.round(j.current.temperature_2m), feelsC: Math.round(j.current.apparent_temperature),
      rainPct: j.hourly?.precipitation_probability?.[hour] ?? null, live: true,
      hourly: (j.hourly?.apparent_temperature ?? []).map((v: number, h: number) => ({ h, feels: Math.round(v) })),
    }
    cache = { at: Date.now(), w }
    return w
  } catch {
    const m = new Date().getMonth(), h = new Date().getHours()
    const t = Math.round(TYPICAL_MAX[m] - Math.max(0, Math.abs(h - 15) * 1.1))
    return { tempC: t, feelsC: t + 2, rainPct: null, live: false }
  }
}

export function heatAdvice(feelsC: number): { level: 'ok' | 'warm' | 'hot' | 'extreme'; en: string; kn: string; hi: string } {
  if (feelsC >= 41) return { level: 'extreme', en: 'Extreme heat. Avoid cliff climbs from 11 AM to 4 PM, drink water every 20 minutes.', kn: 'ಅತಿಯಾದ ಬಿಸಿಲು. ಬೆಳಿಗ್ಗೆ 11ರಿಂದ ಸಂಜೆ 4ರವರೆಗೆ ಬಂಡೆ ಹತ್ತಬೇಡಿ; ಪ್ರತಿ 20 ನಿಮಿಷಕ್ಕೆ ನೀರು ಕುಡಿಯಿರಿ.', hi: 'अत्यधिक गर्मी। सुबह 11 से शाम 4 बजे तक चट्टानों पर चढ़ाई न करें, हर 20 मिनट पानी पिएँ।' }
  if (feelsC >= 36) return { level: 'hot', en: 'Hot. Visit the caves early or late, and carry water and a cap.', kn: 'ಬಿಸಿಲು ಜಾಸ್ತಿ. ಗುಹೆಗಳಿಗೆ ಬೆಳಿಗ್ಗೆ ಬೇಗ ಅಥವಾ ಸಂಜೆ ಹೋಗಿ; ನೀರು ಮತ್ತು ಟೋಪಿ ಜೊತೆಗಿರಲಿ.', hi: 'गर्मी है। गुफाओं में सुबह जल्दी या शाम को जाएँ, पानी और टोपी साथ रखें।' }
  if (feelsC >= 31) return { level: 'warm', en: 'Warm. Keep water handy on the steps.', kn: 'ಬೆಚ್ಚಗಿದೆ. ಮೆಟ್ಟಿಲು ಹತ್ತುವಾಗ ನೀರು ಜೊತೆಗಿರಲಿ.', hi: 'गर्मी है। सीढ़ियों पर पानी साथ रखें।' }
  return { level: 'ok', en: 'Pleasant weather for walking.', kn: 'ನಡೆಯಲು ಹಿತಕರ ಹವಾಮಾನ.', hi: 'घूमने के लिए सुहावना मौसम।' }
}

export function useWeather() {
  const [w, setW] = useState<Weather | null>(null)
  useEffect(() => { let alive = true; getWeather().then((x) => alive && setW(x)); return () => { alive = false } }, [])
  return w
}
