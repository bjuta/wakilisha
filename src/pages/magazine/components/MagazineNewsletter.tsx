import { useState } from "react";

export function MagazineNewsletter() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <section className="mag-newsletter-v2">
        <div className="mag-newsletter-v2-success">
          <div className="mag-newsletter-v2-success-icon">
            <i className="ri-check-line" />
          </div>
          <h3 className="mag-newsletter-v2-success-title">
            You&apos;re on the list
          </h3>
          <p className="mag-newsletter-v2-success-text">
            Expect WAKILISHA stories, charts, and cultural dispatches — no noise.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mag-newsletter-v2">
      <div className="mag-newsletter-v2-inner">
        <div className="mag-newsletter-v2-content">
          <div className="mag-newsletter-v2-eyebrow">
            <i className="ri-newspaper-line" />
            WAKILISHA Editorial
          </div>
          <h2 className="mag-newsletter-v2-heading">Read with us</h2>
          <p className="mag-newsletter-v2-body">
            Get weekly analysis, chart commentary, and industry signals
            delivered to your inbox.
          </p>
        </div>

        <form className="mag-newsletter-v2-form" onSubmit={handleSubmit}>
          <div className="mag-newsletter-v2-input-wrap">
            <i className="ri-mail-line mag-newsletter-v2-input-icon" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="mag-newsletter-v2-input"
            />
          </div>
          <button type="submit" className="mag-newsletter-v2-submit">
            Subscribe
          </button>
        </form>

        <p className="mag-newsletter-v2-footer">
          No spam. Unsubscribe anytime.
        </p>
      </div>
    </section>
  );
}