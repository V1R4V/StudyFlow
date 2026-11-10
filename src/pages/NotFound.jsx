import { Container, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <Container as="main" id="main-content" className="sf-not-found text-center" tabIndex={-1}>
      <h1 className="display-1">404</h1>
      <h2 className="h4">Page not found</h2><p className="text-muted">Return to your dashboard to pick up where you left off.</p>
      <Button as={Link} to="/app" variant="primary">Back to dashboard</Button>
    </Container>
  );
}
