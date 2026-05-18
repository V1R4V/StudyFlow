import { Container, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <Container className="py-5 text-center">
      <h1 className="display-1">404</h1>
      <p className="text-muted">Page not found.</p>
      <Button as={Link} to="/" variant="primary">Go Home</Button>
    </Container>
  );
}
