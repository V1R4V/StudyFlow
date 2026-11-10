import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Button } from 'react-bootstrap';
import heroImg from '../assets/hero.png';

/* ------------------------------------------------------------------ *
 * Icons — stroke style matches the rest of the app (Sidebar/Login).  *
 * ------------------------------------------------------------------ */
const IconBrand = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="white" aria-hidden="true">
    <path d="M12 1.5l2.6 8.4L23 12l-8.4 2.1L12 23l-2.1-8.9L1 12l8.9-2.1L12 1.5z" />
  </svg>
);

const IconTimer = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 2" />
    <path d="M9 2h6" />
  </svg>
);

const IconSubjects = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
    <path d="M8 4v16" />
    <path d="M12 9h4" />
    <path d="M12 13h4" />
  </svg>
);

const IconChart = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20V10" />
    <path d="M10 20V4" />
    <path d="M16 20v-7" />
    <path d="M22 20H2" />
  </svg>
);

const IconFlame = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2c1 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1.2.4-2 1-2.8C9 9 9 11 11 11c0-2 1-4-1-7 2 1 3 2.5 3 4" />
    <path d="M7 14a5 5 0 0 0 10 0c0-1.5-.6-2.8-1.5-4" />
  </svg>
);

const IconHistory = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 4v4h4" />
    <path d="M12 8v4l3 2" />
  </svg>
);

const IconExport = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 15V3" />
    <path d="M8 7l4-4 4 4" />
    <path d="M4 14v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />
  </svg>
);

const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 10.5l3.5 3.5L16 5.5" />
  </svg>
);

const FEATURES = [
  {
    icon: <IconTimer />,
    tone: 'blue',
    title: 'Deep Work Timer',
    body: 'A distraction-free focus timer built for long, uninterrupted study blocks. Log a distraction without breaking flow.',
  },
  {
    icon: <IconSubjects />,
    tone: 'violet',
    title: 'Organize by Subject',
    body: 'Group every session under color-coded subjects so you always know where your hours are really going.',
  },
  {
    icon: <IconHistory />,
    tone: 'teal',
    title: 'Session History',
    body: 'Every block is saved automatically. Revisit, filter, and reflect on exactly how each study day unfolded.',
  },
  {
    icon: <IconChart />,
    tone: 'green',
    title: 'Analytics & Insights',
    body: 'Weekly trends, hour-of-day heatmaps, study-debt and what-if planning turn raw minutes into a plan.',
  },
  {
    icon: <IconFlame />,
    tone: 'amber',
    title: 'Streaks & Goals',
    body: 'Keep momentum with daily streaks and goal tracking that reward consistency over cramming.',
  },
  {
    icon: <IconExport />,
    tone: 'rose',
    title: 'Import & Export',
    body: 'Bring history in or take it with you. CSV import and export keep your data portable and yours.',
  },
];

const STEPS = [
  {
    num: '01',
    tone: 'blue',
    title: 'Pick a subject & start',
    body: 'Choose what you’re working on and hit start. The timer keeps you locked into a single deep-work block.',
  },
  {
    num: '02',
    tone: 'violet',
    title: 'Stay in flow',
    body: 'Log distractions in one tap without stopping the clock, so your focus data stays honest and complete.',
  },
  {
    num: '03',
    tone: 'teal',
    title: 'Review & improve',
    body: 'See streaks, trends, and where your time goes, then plan next week with data, not guesswork.',
  },
];

const TESTIMONIALS = [
  {
    quote: 'StudyFlow finally made my study hours visible. Seeing the streak grow is weirdly addictive, in a good way.',
    name: 'Maya R.',
    role: 'Pre-med student',
  },
  {
    quote: 'The analytics caught that I was overspending on one subject and ignoring another. Fixed my whole exam plan.',
    name: 'Daniel K.',
    role: 'CS undergrad',
  },
  {
    quote: 'Clean, fast, and it just tracks what matters. I dropped three other apps after a week with this.',
    name: 'Priya S.',
    role: 'Grad researcher',
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  // SEO: set a descriptive title while on the marketing page, restore on leave.
  useEffect(() => {
    const prev = document.title;
    document.title = 'StudyFlow: Your personal deep work engine for focused study';
    return () => { document.title = prev; };
  }, []);

  // Subtle navbar elevation once the user scrolls past the hero fold.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="sf-landing" data-theme="dark">
      {/* ---------------------------------------------------------------- *
       * Top navigation                                                    *
       * ---------------------------------------------------------------- */}
      <header className={`sf-lnav${scrolled ? ' sf-lnav-scrolled' : ''}`}>
        <Container className="sf-lnav-inner">
          <Link to="/" className="sf-lnav-brand" aria-label="StudyFlow home">
            <span className="sf-lnav-brand-icon" aria-hidden="true"><IconBrand /></span>
            <span className="sf-lnav-brand-name">StudyFlow</span>
          </Link>

          <nav className="sf-lnav-links" aria-label="Primary">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#pricing">Pricing</a>
          </nav>

          <div className="sf-lnav-actions">
            <Link to="/login" className="sf-lnav-signin">Sign in</Link>
            <Button as={Link} to="/login" variant="primary" className="sf-lnav-cta">
              Get started
            </Button>
          </div>
        </Container>
      </header>

      <main id="main-content" tabIndex={-1}>
        {/* -------------------------------------------------------------- *
         * Hero                                                            *
         * -------------------------------------------------------------- */}
        <section className="sf-hero">
          <Container>
            <Row className="align-items-center g-5">
              <Col lg={6}>
                <span className="sf-eyebrow">Deep work, measured.</span>
                <h1 className="sf-hero-title">
                  Turn scattered study time into <span className="sf-grad">focused progress</span>.
                </h1>
                <p className="sf-hero-sub">
                  StudyFlow is a distraction-free focus timer and study tracker. Run deep-work
                  sessions, organize them by subject, and watch streaks and analytics reveal
                  exactly how your hours add up.
                </p>
                <div className="sf-hero-cta">
                  <Button as={Link} to="/login" variant="primary" size="lg" className="sf-btn-lg">
                    Get started free
                  </Button>
                  <Button
                    variant="outline-primary"
                    size="lg"
                    className="sf-btn-lg"
                    onClick={() => navigate('/app')}
                  >
                    Try it as a guest →
                  </Button>
                </div>
                <p className="sf-hero-note">No credit card. Your data stays on your device until you sign in.</p>
              </Col>

              <Col lg={6}>
                <div className="sf-hero-art">
                  <img src={heroImg} alt="" className="sf-hero-img" aria-hidden="true" />

                  {/* Floating stat cards layered over the art */}
                  <div className="sf-float-card sf-float-card-a">
                    <div className="sf-float-label">This week</div>
                    <div className="sf-float-value">18h 42m</div>
                    <div className="sf-float-trend">▲ 12% vs last week</div>
                  </div>
                  <div className="sf-float-card sf-float-card-b">
                    <div className="sf-float-streak"><IconFlame /></div>
                    <div>
                      <div className="sf-float-value sf-float-value-sm">12-day streak</div>
                      <div className="sf-float-label">Keep it going</div>
                    </div>
                  </div>
                </div>
              </Col>
            </Row>

            {/* Social-proof strip (placeholder) */}
            <div className="sf-proof">
              <span>Loved by focused students at</span>
              <div className="sf-proof-logos" aria-hidden="true">
                <span>Wisconsin</span>
                <span>Berkeley</span>
                <span>NYU</span>
                <span>Toronto</span>
                <span>Imperial</span>
              </div>
            </div>
          </Container>
        </section>

        {/* -------------------------------------------------------------- *
         * Features                                                        *
         * -------------------------------------------------------------- */}
        <section className="sf-section" id="features">
          <Container>
            <div className="sf-section-head">
              <span className="sf-eyebrow">Everything in one place</span>
              <h2 className="sf-section-title">A complete deep-work workflow</h2>
              <p className="sf-section-sub">
                From the first focused minute to your end-of-week review, StudyFlow handles the
                whole loop, so you can spend your energy studying, not managing tools.
              </p>
            </div>

            <Row className="g-4">
              {FEATURES.map(f => (
                <Col md={6} lg={4} key={f.title}>
                  <div className="sf-feature-card">
                    <div className={`sf-feature-icon sf-fi-${f.tone}`} aria-hidden="true">{f.icon}</div>
                    <h3 className="sf-feature-title">{f.title}</h3>
                    <p className="sf-feature-body">{f.body}</p>
                  </div>
                </Col>
              ))}
            </Row>
          </Container>
        </section>

        {/* -------------------------------------------------------------- *
         * How it works                                                    *
         * -------------------------------------------------------------- */}
        <section className="sf-section sf-section-alt" id="how">
          <Container>
            <div className="sf-section-head">
              <span className="sf-eyebrow">How it works</span>
              <h2 className="sf-section-title">Three steps to deeper focus</h2>
              <p className="sf-section-sub">
                No setup ceremony. Start a session in seconds and let the data build itself.
              </p>
            </div>

            <Row className="g-4">
              {STEPS.map(s => (
                <Col md={4} key={s.num}>
                  <div className="sf-step">
                    <div className={`sf-step-num sf-fi-${s.tone}`}>{s.num}</div>
                    <h3 className="sf-step-title">{s.title}</h3>
                    <p className="sf-step-body">{s.body}</p>
                  </div>
                </Col>
              ))}
            </Row>
          </Container>
        </section>

        {/* -------------------------------------------------------------- *
         * Analytics / streak preview                                      *
         * -------------------------------------------------------------- */}
        <section className="sf-section" id="analytics">
          <Container>
            <Row className="align-items-center g-5">
              <Col lg={6}>
                <span className="sf-eyebrow">Insights that actually help</span>
                <h2 className="sf-section-title sf-text-start">See your effort, then improve it</h2>
                <p className="sf-section-sub sf-text-start">
                  StudyFlow turns every logged minute into a picture you can act on: when you
                  focus best, which subjects you’re neglecting, and how far you are from your goals.
                </p>
                <ul className="sf-check-list">
                  <li><span aria-hidden="true"><IconCheck /></span>Weekly trends and hour-of-day heatmaps</li>
                  <li><span aria-hidden="true"><IconCheck /></span>Study-debt tracking and what-if planning</li>
                  <li><span aria-hidden="true"><IconCheck /></span>Streaks and goals that reward consistency</li>
                  <li><span aria-hidden="true"><IconCheck /></span>Per-subject breakdowns at a glance</li>
                </ul>
              </Col>

              <Col lg={6}>
                <div className="sf-preview">
                  <div className="sf-preview-row">
                    <div className="sf-preview-kpi">
                      <div className="sf-preview-kpi-label">Focus this week</div>
                      <div className="sf-preview-kpi-value">18h 42m</div>
                    </div>
                    <div className="sf-preview-kpi">
                      <div className="sf-preview-kpi-label">Current streak</div>
                      <div className="sf-preview-kpi-value">12 days</div>
                    </div>
                  </div>
                  <div className="sf-preview-bars" aria-hidden="true">
                    {[42, 68, 30, 84, 56, 92, 48].map((h, i) => (
                      <div className="sf-preview-bar-wrap" key={i}>
                        <div className="sf-preview-bar" style={{ height: `${h}%` }} />
                        <span className="sf-preview-bar-day">{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Col>
            </Row>
          </Container>
        </section>

        {/* -------------------------------------------------------------- *
         * Testimonials                                                    *
         * -------------------------------------------------------------- */}
        <section className="sf-section sf-section-alt" id="testimonials">
          <Container>
            <div className="sf-section-head">
              <span className="sf-eyebrow">Social proof</span>
              <h2 className="sf-section-title">Students get more done with StudyFlow</h2>
            </div>
            <Row className="g-4">
              {TESTIMONIALS.map(t => (
                <Col md={4} key={t.name}>
                  <figure className="sf-quote">
                    <blockquote className="sf-quote-body">“{t.quote}”</blockquote>
                    <figcaption className="sf-quote-author">
                      <span className="sf-quote-avatar" aria-hidden="true">{t.name[0]}</span>
                      <span>
                        <span className="sf-quote-name">{t.name}</span>
                        <span className="sf-quote-role">{t.role}</span>
                      </span>
                    </figcaption>
                  </figure>
                </Col>
              ))}
            </Row>
          </Container>
        </section>

        {/* -------------------------------------------------------------- *
         * Pricing (placeholder for future premium)                        *
         * -------------------------------------------------------------- */}
        <section className="sf-section" id="pricing">
          <Container>
            <div className="sf-section-head">
              <span className="sf-eyebrow">Pricing</span>
              <h2 className="sf-section-title">Start free, upgrade when you’re ready</h2>
              <p className="sf-section-sub">
                Everything you need to build a focused study habit is free today. Premium is on the way.
              </p>
            </div>

            <Row className="g-4 justify-content-center">
              <Col md={6} lg={5}>
                <div className="sf-price-card">
                  <div className="sf-price-name">Free</div>
                  <div className="sf-price-amount">$0<span>/forever</span></div>
                  <p className="sf-price-desc">For students who want to track focus and build a streak.</p>
                  <ul className="sf-check-list">
                    <li><span aria-hidden="true"><IconCheck /></span>Unlimited focus sessions</li>
                    <li><span aria-hidden="true"><IconCheck /></span>Subjects, streaks & goals</li>
                    <li><span aria-hidden="true"><IconCheck /></span>Full analytics dashboard</li>
                    <li><span aria-hidden="true"><IconCheck /></span>CSV import & export</li>
                  </ul>
                  <Button as={Link} to="/login" variant="primary" className="w-100 sf-btn-lg">
                    Get started free
                  </Button>
                </div>
              </Col>

              <Col md={6} lg={5}>
                <div className="sf-price-card sf-price-card-soon">
                  <div className="sf-price-badge">Coming soon</div>
                  <div className="sf-price-name">Premium</div>
                  <div className="sf-price-amount sf-price-amount-muted">Later<span>/stay tuned</span></div>
                  <p className="sf-price-desc">For power users who want more automation and depth.</p>
                  <ul className="sf-check-list sf-check-list-muted">
                    <li><span aria-hidden="true"><IconCheck /></span>Everything in Free</li>
                    <li><span aria-hidden="true"><IconCheck /></span>Advanced reports & exports</li>
                    <li><span aria-hidden="true"><IconCheck /></span>Calendar & integrations</li>
                    <li><span aria-hidden="true"><IconCheck /></span>Smart focus recommendations</li>
                  </ul>
                  <Button variant="outline-primary" className="w-100 sf-btn-lg" disabled>
                    Join the waitlist
                  </Button>
                </div>
              </Col>
            </Row>
          </Container>
        </section>

        {/* -------------------------------------------------------------- *
         * Final CTA band                                                  *
         * -------------------------------------------------------------- */}
        <section className="sf-cta-band">
          <Container>
            <h2 className="sf-cta-title">Ready to do your deepest work?</h2>
            <p className="sf-cta-sub">Join StudyFlow and make every study hour count.</p>
            <div className="sf-hero-cta sf-cta-buttons">
              <Button as={Link} to="/login" variant="light" size="lg" className="sf-btn-lg sf-cta-primary">
                Get started free
              </Button>
              <Button
                variant="outline-light"
                size="lg"
                className="sf-btn-lg"
                onClick={() => navigate('/app')}
              >
                Try it as a guest →
              </Button>
            </div>
          </Container>
        </section>
      </main>

      {/* ---------------------------------------------------------------- *
       * Footer                                                            *
       * ---------------------------------------------------------------- */}
      <footer className="sf-lfooter">
        <Container>
          <Row className="g-4">
            <Col md={4}>
              <Link to="/" className="sf-lnav-brand" aria-label="StudyFlow home">
                <span className="sf-lnav-brand-icon" aria-hidden="true"><IconBrand /></span>
                <span className="sf-lnav-brand-name">StudyFlow</span>
              </Link>
              <p className="sf-lfooter-tag">Your personal deep work engine.</p>
            </Col>
            <Col md={4} sm={6}>
              <div className="sf-lfooter-col-title">Product</div>
              <a href="#features">Features</a>
              <a href="#how">How it works</a>
              <a href="#pricing">Pricing</a>
            </Col>
            <Col md={4} sm={6}>
              <div className="sf-lfooter-col-title">Get started</div>
              <Link to="/login">Create account</Link>
              <Link to="/login">Sign in</Link>
              <button className="sf-lfooter-linkbtn" onClick={() => navigate('/app')}>
                Continue as guest
              </button>
            </Col>
          </Row>
          <div className="sf-lfooter-bottom">
            <span>© {new Date().getFullYear()} StudyFlow. All rights reserved.</span>
          </div>
        </Container>
      </footer>
    </div>
  );
}
