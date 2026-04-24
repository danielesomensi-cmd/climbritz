export default function PrivacyPolicy() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #000 100%)',
        paddingTop: 'max(env(safe-area-inset-top), 48px)',
        paddingLeft: '24px',
        paddingRight: '24px',
        paddingBottom: '48px',
        color: '#cbd5e1',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <h1 style={{ color: '#FF6B35', fontSize: '32px', fontWeight: 800, marginBottom: '8px' }}>
          Privacy Policy
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '32px' }}>
          Last updated: April 2026
        </p>

        <section style={{ marginBottom: '28px' }}>
          <h2 style={{ color: '#e2e8f0', fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
            What we collect
          </h2>
          <ul style={{ paddingLeft: '20px', lineHeight: 1.8 }}>
            <li>
              <strong>Email address</strong> — used only for account login.
            </li>
            <li>
              <strong>Climbing videos</strong> — uploaded voluntarily for AI form analysis. Videos
              are processed by Google Gemini and stored on our servers.
            </li>
            <li>
              <strong>Usage data</strong> — basic analytics (pages visited, feature usage) to
              improve the app.
            </li>
          </ul>
        </section>

        <section style={{ marginBottom: '28px' }}>
          <h2 style={{ color: '#e2e8f0', fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
            What we do NOT do
          </h2>
          <ul style={{ paddingLeft: '20px', lineHeight: 1.8 }}>
            <li>We do not sell your data to third parties.</li>
            <li>We do not use your videos for advertising.</li>
            <li>We do not share personal information with other users.</li>
          </ul>
        </section>

        <section style={{ marginBottom: '28px' }}>
          <h2 style={{ color: '#e2e8f0', fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
            Data storage
          </h2>
          <p style={{ lineHeight: 1.8 }}>
            Your data is stored on Railway servers in the European Union. We use
            industry-standard encryption for data in transit (HTTPS/TLS).
          </p>
        </section>

        <section style={{ marginBottom: '28px' }}>
          <h2 style={{ color: '#e2e8f0', fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
            Data deletion
          </h2>
          <p style={{ lineHeight: 1.8 }}>
            You may request deletion of your account and all associated data at any time by
            contacting us. We will process deletion requests within 30 days.
          </p>
        </section>

        <section style={{ marginBottom: '28px' }}>
          <h2 style={{ color: '#e2e8f0', fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
            Contact
          </h2>
          <p style={{ lineHeight: 1.8 }}>
            For privacy-related inquiries, contact us at{' '}
            <a href="mailto:daniele@kilterup.com" style={{ color: '#FF6B35' }}>
              daniele@kilterup.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
