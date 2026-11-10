import { Link } from 'react-router-dom';

import Icon from './Icon';

export default function CardExpand({ to, label = 'Open full view' }) {
  return (
    <Link to={to} className="sf-card-expand" aria-label={label} title={label}>
      <Icon name="expand" size={16} />
    </Link>
  );
}
