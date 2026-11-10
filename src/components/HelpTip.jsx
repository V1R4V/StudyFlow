import { useId } from 'react';
import { OverlayTrigger, Popover } from 'react-bootstrap';

// Small "?" affordance that reveals an explanatory popover on hover/focus/tap.
// Used next to widget headers to teach the user what a metric means without
// cluttering the default view. `title` is optional; `children` is the body.
// 'auto' lets Popper pick the side with room, so popovers near the top of the
// viewport open downward instead of clipping off-screen.
export default function HelpTip({ title, children, placement = 'auto' }) {
  const id = useId();
  const popover = (
    <Popover id={id} className="sf-help-popover">
      {title && <Popover.Header as="div">{title}</Popover.Header>}
      <Popover.Body>{children}</Popover.Body>
    </Popover>
  );

  return (
    <OverlayTrigger
      trigger={['hover', 'focus', 'click']}
      placement={placement}
      overlay={popover}
      rootClose
    >
      <button
        type="button"
        className="sf-help-tip"
        aria-label={title ? `Help: ${title}` : 'More information'}
        onClick={e => e.preventDefault()}
      >
        ?
      </button>
    </OverlayTrigger>
  );
}
