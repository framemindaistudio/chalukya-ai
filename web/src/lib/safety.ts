import { haversineKm } from './geo'

/*
  Safety zones for geofence alerts. Positions are approximate and illustrative for the prototype;
  in deployment the district/ASI would draw the exact polygons.
*/
export type Zone = { id: string; lat: number; lng: number; r: number; en: string; kn: string; hi: string; kind: 'cliff' | 'water' | 'restricted' }
export const ZONES: Zone[] = [
  { id: 'z_caves_edge', lat: 15.9187, lng: 75.6853, r: 70, kind: 'cliff', en: 'Steep rock edges above the upper caves: stay on the marked steps.', kn: 'ಮೇಲಿನ ಗುಹೆಗಳ ಬಳಿ ಕಡಿದಾದ ಬಂಡೆ ಅಂಚು: ಗುರುತಿಸಿದ ಮೆಟ್ಟಿಲುಗಳಲ್ಲೇ ನಡೆಯಿರಿ.', hi: 'ऊपरी गुफाओं के पास खड़ी चट्टान: चिह्नित सीढ़ियों पर ही रहें।' },
  { id: 'z_lake_ghats', lat: 15.9201, lng: 75.6872, r: 120, kind: 'water', en: 'Agastya Lake ghats are slippery; the water is deep. No swimming.', kn: 'ಅಗಸ್ತ್ಯ ತೀರ್ಥದ ಮೆಟ್ಟಿಲುಗಳು ಜಾರುತ್ತವೆ; ನೀರು ಆಳವಾಗಿದೆ. ಈಜಬೇಡಿ.', hi: 'अगस्त्य झील के घाट फिसलन भरे हैं; पानी गहरा है। तैरें नहीं।' },
  { id: 'z_north_fort', lat: 15.9236, lng: 75.6829, r: 100, kind: 'cliff', en: 'North Fort cliffs: keep away from the edges, especially at sunset.', kn: 'ಉತ್ತರ ಕೋಟೆಯ ಬಂಡೆಗಳು: ಅಂಚಿನಿಂದ ದೂರವಿರಿ, ವಿಶೇಷವಾಗಿ ಸೂರ್ಯಾಸ್ತದಲ್ಲಿ.', hi: 'उत्तरी किले की चट्टानें: किनारों से दूर रहें, खासकर सूर्यास्त पर।' },
  { id: 'z_malaprabha_pk', lat: 15.9502, lng: 75.8183, r: 150, kind: 'water', en: 'Malaprabha river bank: strong currents after rain or dam release.', kn: 'ಮಲಪ್ರಭಾ ನದಿ ದಂಡೆ: ಮಳೆ ಅಥವಾ ಅಣೆಕಟ್ಟಿನ ನೀರು ಬಿಟ್ಟಾಗ ರಭಸದ ಪ್ರವಾಹ.', hi: 'मालप्रभा नदी तट: बारिश या बाँध से पानी छोड़ने पर तेज़ बहाव।' },
  { id: 'z_sangama', lat: 16.2036, lng: 76.0604, r: 150, kind: 'water', en: 'Deep water at the Kudalasangama confluence: bathe only at the marked ghat.', kn: 'ಕೂಡಲಸಂಗಮದಲ್ಲಿ ಆಳವಾದ ನೀರು: ಗುರುತಿಸಿದ ಘಾಟ್‌ನಲ್ಲಿ ಮಾತ್ರ ಸ್ನಾನ ಮಾಡಿ.', hi: 'कूडलसंगम में गहरा पानी: केवल चिह्नित घाट पर स्नान करें।' },
]

export function zoneAt(lat: number, lng: number) {
  return ZONES.find((z) => haversineKm({ lat, lng }, z) * 1000 <= z.r) ?? null
}

export function getPosition(): Promise<{ lat: number; lng: number; acc: number } | null> {
  return new Promise((res) => {
    if (!('geolocation' in navigator)) return res(null)
    navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }), () => res(null), { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 })
  })
}
