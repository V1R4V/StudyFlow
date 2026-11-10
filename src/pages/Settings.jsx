import { useState } from 'react';
import { Card, Container } from 'react-bootstrap';
import { Select, SegmentedControl } from '@mantine/core';
import { useTimeZone } from '../hooks/useTimeZone';
import { availableTimeZones, deviceTimeZone } from '../utils/timeZone';
import { useTheme } from '../context/ThemeContext';
import Icon from '../components/Icon';

export default function Settings() {
  const { preference, timeZone, setPreference } = useTimeZone();
  const { theme, toggleTheme } = useTheme();
  const [saveError, setSaveError] = useState('');
  const zones = availableTimeZones();
  function changeTimeZone(value) {
    if (!value) return;
    try { setPreference(value); setSaveError(''); }
    catch { setSaveError('This browser could not save your preference. Please allow site storage and try again.'); }
  }
  return (
    <Container fluid className="py-4 sf-settings-page">
      <h1 className="mb-1">Settings</h1>
      <p className="text-muted mb-4">Make this workspace feel right for you.</p>
      <Card className="mb-4">
        <Card.Header className="d-flex align-items-center gap-2"><Icon name="globe" /> Session times</Card.Header>
        <Card.Body>
          <Select className="sf-library-field" label="Session time zone"
            description="Search a city or region anywhere in the world."
            searchable allowDeselect={false} value={preference} onChange={changeTimeZone}
            data={[{ value: 'automatic', label: `Use device time zone (${deviceTimeZone()})` }, ...zones.map(zone => ({ value: zone, label: zone.replaceAll('_', ' ') }))]}
            nothingFoundMessage="No matching time zone. Try a nearby major city." maxDropdownHeight={240}
            leftSection={<Icon name="globe" size={18} />} />
          {saveError && <p role="alert" className="text-danger small mt-2">{saveError}</p>}
          <p className="small text-muted mt-3 mb-2" role="status">Session times are shown in <strong>{timeZone.replaceAll('_', ' ')}</strong>.</p>
          <p className="small text-muted mb-0">Applies to session review, history and hourly statistics. Your recorded instants and focused time stay the same. Study dates, plans and reminders follow your device time zone.</p>
        </Card.Body>
      </Card>
      <Card>
        <Card.Header className="d-flex align-items-center gap-2"><Icon name="sun" /> Appearance</Card.Header>
        <Card.Body>
          <p id="appearance-label" className="form-label">Color theme</p>
          <SegmentedControl aria-labelledby="appearance-label" value={theme} onChange={value => { if (value !== theme) toggleTheme(); }}
            data={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
        </Card.Body>
      </Card>
      <p className="small text-muted mt-3">Preferences are saved automatically in this browser.</p>
    </Container>
  );
}
