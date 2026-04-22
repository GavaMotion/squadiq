export default function PrivacyPolicy({ onBack }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0d0d1a',
      overflowY: 'auto',
      zIndex: 9999,
      padding: '24px 20px',
      fontFamily: 'sans-serif',
    }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: 24, cursor: 'pointer', padding: 0 }}
          >
            ←
          </button>
          <div>
            <div style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>Privacy Policy</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Last updated: {new Date().toLocaleDateString()}</div>
          </div>
        </div>

        {[
          {
            title: '1. Information we collect',
            body: 'When you create an account we collect your email address and password (encrypted). When you use the app we store your team names, player names and jersey numbers, game plans, and practice plans. We do not collect any personal information about your players beyond their names and jersey numbers.',
          },
          {
            title: '2. How we use your information',
            body: 'We use your information solely to provide the SquadIQ service — storing your teams, rosters, game plans and practice plans so you can access them across devices. We do not sell, share, or rent your information to any third party.',
          },
          {
            title: '3. Data storage',
            body: 'Your data is stored securely using Supabase, a cloud database provider. Data is encrypted in transit and at rest. We retain your data for as long as your account is active. You can request deletion of your account and all associated data at any time.',
          },
          {
            title: "4. Children's privacy",
            body: 'SquadIQ is designed for coaches who are adults. We do not knowingly collect personal information from children under 13. Player names and jersey numbers entered by coaches are used solely for team management within the app.',
          },
          {
            title: '5. Cookies',
            body: 'We use essential cookies only — specifically for authentication (keeping you logged in). We do not use tracking cookies or advertising cookies.',
          },
          {
            title: '6. Third-party services',
            body: 'We use Supabase for data storage and authentication, and Stripe for payment processing (when applicable). These services have their own privacy policies. We do not share your data with any other third parties.',
          },
          {
            title: '7. Your rights',
            body: 'You have the right to access, correct, or delete your personal data at any time. To request account deletion or a copy of your data, contact us at support@gavamotion.com.',
          },
          {
            title: '8. Changes to this policy',
            body: 'We may update this Privacy Policy from time to time. We will notify you of any significant changes by email or via an in-app notification.',
          },
          {
            title: '9. Contact',
            body: 'If you have any questions about this Privacy Policy, please contact us at support@gavamotion.com.',
          },
        ].map((section, i) => (
          <div key={i} style={{ marginBottom: 24 }}>
            <div style={{ color: '#00c853', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
              {section.title}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 1.8 }}>
              {section.body}
            </div>
          </div>
        ))}

        <div style={{
          marginTop: 40, paddingTop: 20,
          borderTop: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.55)', fontSize: 11, textAlign: 'center',
        }}>
          SquadIQ — by Gava Motion
        </div>
      </div>
    </div>
  )
}
