/* Alongside homepage — shared sections (desktop + mobile) */

const HPCrisisStrip = ({ mobile }) => mobile ? (
  <div className="hp-crisis" role="region" aria-label="Crisis support">
    <div className="crisis-top">
      <span className="dot" aria-hidden="true"></span>
      <strong>If you're in crisis right now</strong>
    </div>
    <div>Call the Alzheimer's Association 24/7 helpline: <a href="tel:18002723900">800-272-3900</a></div>
  </div>
) : (
  <div className="hp-crisis" role="region" aria-label="Crisis support">
    <span className="dot" aria-hidden="true"></span>
    <div className="crisis-text">
      <strong>If you're in crisis right now,</strong> call the Alzheimer's Association 24/7 helpline: <a href="tel:18002723900">800-272-3900</a>
    </div>
  </div>
);

const HPNav = () => (
  <nav className="hp-nav">
    <div className="wm">Along<em>side</em>.</div>
    <div className="hp-nav-links">
      <a href="#">How it works</a>
      <a href="#">Who reviews</a>
      <a href="#">For clinicians</a>
    </div>
    <a className="hp-nav-signin" href="#">Sign in</a>
  </nav>
);

const HPHero = () => (
  <section className="hp-hero">
    <div className="hp-eyebrow">For family caregivers</div>
    <h1 className="hp-headline">
      Caregiving for someone with dementia is <em>relentless.</em> You shouldn't have to figure it out alone.
    </h1>
    <p className="hp-subhead">
      Guidance tailored to your situation, from trusted sources, whenever you need it.
    </p>
    <div className="hp-cta-row">
      <button className="hp-cta">Get started <span className="arr" aria-hidden="true">→</span></button>
      <a className="hp-data-link" href="#data">How is my data used?</a>
    </div>
    <p className="hp-hero-aside">
      Alongside is free to start. No credit card. You can leave at any time, and take your notes with you.
    </p>
  </section>
);

const HPJobs = () => (
  <section className="hp-section">
    <div className="hp-section-label">What Alongside does</div>
    <h2 className="hp-section-title">
      Three things, done <em>plainly.</em>
    </h2>
    <div className="hp-jtbd">
      <div className="hp-jtbd-item">
        <div className="hp-jtbd-num">01</div>
        <p className="hp-jtbd-lede">Answers the question you actually have, in language that fits your situation.</p>
        <p className="hp-jtbd-detail">You tell us what's happening tonight. We reply with what's known to help — step by step, without jargon.</p>
      </div>
      <div className="hp-jtbd-item">
        <div className="hp-jtbd-num">02</div>
        <p className="hp-jtbd-lede">Keeps a quiet record of what you've tried, so patterns become visible.</p>
        <p className="hp-jtbd-detail">Notes, moods, medications, and what helped. Yours to keep, yours to share with a clinician if you choose.</p>
      </div>
      <div className="hp-jtbd-item">
        <div className="hp-jtbd-num">03</div>
        <p className="hp-jtbd-lede">Connects you with a real person when the moment calls for one.</p>
        <p className="hp-jtbd-detail">A trained caregiver support specialist is reachable within one business day — and a crisis line is always one tap away.</p>
      </div>
    </div>
  </section>
);

const HPReviewers = () => (
  <section className="hp-section">
    <div className="hp-section-label">Who reviews what we write</div>
    <div className="hp-reviewers">
      <p className="hp-reviewer-lede">
        Every piece of guidance on Alongside is reviewed by a clinician with direct experience in dementia care.
      </p>
      <div className="hp-reviewer-list">
        <div className="hp-reviewer">
          <div>
            <p className="hp-reviewer-name">Dr. Helen Moriarty, MD</p>
            <p className="hp-reviewer-role">Geriatric psychiatrist · 22 years in dementia care</p>
          </div>
          <div className="hp-reviewer-inst">Johns Hopkins</div>
        </div>
        <div className="hp-reviewer">
          <div>
            <p className="hp-reviewer-name">Priya Sastry, PhD, LCSW</p>
            <p className="hp-reviewer-role">Clinical social worker · Family caregiver interventions</p>
          </div>
          <div className="hp-reviewer-inst">UCSF</div>
        </div>
        <div className="hp-reviewer">
          <div>
            <p className="hp-reviewer-name">Dr. Samuel Okafor, MD, MPH</p>
            <p className="hp-reviewer-role">Behavioral neurologist · Memory disorders clinic</p>
          </div>
          <div className="hp-reviewer-inst">Cleveland Clinic</div>
        </div>
        <div className="hp-reviewer">
          <div>
            <p className="hp-reviewer-name">Marta Reyes, RN, CDP</p>
            <p className="hp-reviewer-role">Certified dementia practitioner · 14 years in home care</p>
          </div>
          <div className="hp-reviewer-inst">VNS Health</div>
        </div>
      </div>
    </div>
  </section>
);

const HPQuotes = () => (
  <section className="hp-section">
    <div className="hp-section-label">From caregivers using Alongside</div>
    <div className="hp-quotes">
      <figure className="hp-quote">
        <blockquote className="hp-quote-body">
          I used it at 2 a.m. when my father kept trying to leave the house. It didn't tell me to stay calm. It told me what to try, in the order to try it. That was the first night in months I actually slept.
        </blockquote>
        <figcaption className="hp-quote-attr">
          <b>Ellen M.</b> · caring for her father · Portland, OR
        </figcaption>
      </figure>
      <figure className="hp-quote">
        <blockquote className="hp-quote-body">
          What I needed wasn't a forum. I needed someone who had seen this a thousand times to tell me which worry was the one to act on. Alongside does that.
        </blockquote>
        <figcaption className="hp-quote-attr">
          <b>Marcus T.</b> · caring for his wife · Atlanta, GA
        </figcaption>
      </figure>
    </div>
  </section>
);

const HPClose = () => (
  <section className="hp-close">
    <div className="hp-close-inner">
      <h2 className="hp-close-title">
        If tonight is hard, <em>start here.</em>
      </h2>
      <div className="hp-cta-row">
        <button className="hp-cta">Get started <span className="arr" aria-hidden="true">→</span></button>
        <a className="hp-data-link" href="#data">How is my data used?</a>
      </div>
    </div>
  </section>
);

const HPFooter = () => (
  <footer className="hp-footer">
    <div>© 2026 Alongside, PBC</div>
    <div className="hp-footer-links">
      <a href="#">Privacy</a>
      <a href="#">How is my data used?</a>
      <a href="#">Editorial standards</a>
      <a href="#">Contact</a>
    </div>
  </footer>
);

const HPHomepage = ({ mobile }) => (
  <div className={"hp " + (mobile ? "hp-mobile" : "")}>
    <HPCrisisStrip mobile={mobile} />
    <HPNav />
    <HPHero />
    <HPJobs />
    <HPReviewers />
    <HPQuotes />
    <HPClose />
    <HPFooter />
  </div>
);

Object.assign(window, { HPHomepage });
