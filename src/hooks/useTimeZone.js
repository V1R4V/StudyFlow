import { useSyncExternalStore } from 'react';
import { TIME_ZONE_EVENT, timeZonePreference, deviceTimeZone, saveTimeZonePreference } from '../utils/timeZone';

function subscribe(onChange) {
  window.addEventListener(TIME_ZONE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(TIME_ZONE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function useTimeZone() {
  const preference = useSyncExternalStore(subscribe, timeZonePreference, () => 'automatic');
  return { preference, timeZone: preference === 'automatic' ? deviceTimeZone() : preference, setPreference: saveTimeZonePreference };
}
