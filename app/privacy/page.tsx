export default function PrivacyPolicy() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #000 100%)',
        paddingTop: 'max(var(--safe-top), 48px)',
        paddingLeft: '24px',
        paddingRight: '24px',
        paddingBottom: '48px',
        color: '#cbd5e1',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <h1 style={{ color: 'var(--brand-orange)', fontSize: '32px', fontWeight: 800, marginBottom: '8px' }}>
          Privacy Policy
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '32px' }}>
          Last updated: July 2026
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
            You can delete your account from inside the app at any time:{' '}
            <strong style={{ color: '#e2e8f0' }}>Settings → Delete account</strong>.
            No request or waiting period is involved — the deletion happens
            immediately.
          </p>
          <p style={{ lineHeight: 1.8, marginTop: '12px' }}>Deleting your account permanently removes:</p>
          <ul style={{ paddingLeft: '20px', lineHeight: 1.8 }}>
            <li>your logged climbs and attempt history</li>
            <li>your projects and saved climb states</li>
            <li>your hold classifications</li>
            <li>your saved generated problems</li>
            <li>your uploaded videos and their AI analyses</li>
            <li>your login credentials, held by our authentication provider</li>
          </ul>
          <p style={{ lineHeight: 1.8, marginTop: '12px' }}>
            This is permanent. Deleted data cannot be recovered, and we keep no
            backup copy of it. If you would rather have us do it for you, you
            can still email the address below and we will process the deletion
            within 30 days.
          </p>
        </section>

        <section style={{ marginBottom: '28px' }}>
          <h2 style={{ color: '#e2e8f0', fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
            Contact
          </h2>
          <p style={{ lineHeight: 1.8 }}>
            For privacy-related inquiries, contact us at{' '}
            <a href="mailto:daniele.somensi@gmail.com" style={{ color: 'var(--brand-orange)' }}>
              daniele.somensi@gmail.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
