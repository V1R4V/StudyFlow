import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import '@mantine/core/styles/default-css-variables.css'
import '@mantine/core/styles/global.css'
import '@mantine/core/styles/UnstyledButton.css'
import '@mantine/core/styles/VisuallyHidden.css'
import '@mantine/core/styles/Card.css'
import '@mantine/core/styles/Paper.css'
import '@mantine/core/styles/Popover.css'
import '@mantine/core/styles/CloseButton.css'
import '@mantine/core/styles/Group.css'
import '@mantine/core/styles/Loader.css'
import '@mantine/core/styles/Input.css'
import '@mantine/core/styles/InlineInput.css'
import '@mantine/core/styles/Flex.css'
import '@mantine/core/styles/FloatingIndicator.css'
import '@mantine/core/styles/ActionIcon.css'
import '@mantine/core/styles/ScrollArea.css'
import '@mantine/core/styles/Combobox.css'
import '@mantine/core/styles/SegmentedControl.css'
import '@mantine/core/styles/PasswordInput.css'
import '@mantine/core/styles/Button.css'
import '@mantine/core/styles/Divider.css'
import '@mantine/core/styles/Stack.css'
import '@mantine/dates/styles.css'
import 'bootstrap/dist/css/bootstrap.min.css'
import './styles/variables.css'
import './App.css'
import './styles/polish.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    {import.meta.env.PROD && <Analytics />}
  </StrictMode>,
)
