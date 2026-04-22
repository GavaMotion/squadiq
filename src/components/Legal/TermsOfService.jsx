export default function TermsOfService({ onBack }) {
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
            <div style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>Terms of Service</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Last updated: {new Date().toLocaleDateString()}</div>
          </div>
        </div>

        {[
          {
            title: '1. Acceptance of terms',
            body: 'By creating an account and using SquadIQ you agree to these Terms of Service. If you do not agree, please do not use the app.',
          },
          {
            title: '2. Description of service',
            body: 'SquadIQ is a coaching management tool for youth soccer coaches. It provides team roster management, game day lineup planning, practice planning, and tactical sketching tools.',
          },
          {
            title: '3. Account responsibility',
            body: 'You are responsible for maintaining the security of your account and password. You are responsible for all activity that occurs under your account. Please notify us immediately at support@gavamotion.com if you suspect unauthorized access.',
          },
          {
            title: '4. Free trial and subscriptions',
            body: 'New accounts receive a free trial period. After the trial, continued use requires a paid subscription. Subscription fees are billed in advance on a monthly or annual basis. You may cancel at any time and your access will continue until the end of the billing period.',
          },
          {
            title: '5. Refunds',
            body: 'We offer a 7-day refund policy on new subscriptions. If you are not satisfied, contact us within 7 days of your first charge at support@gavamotion.com and we will issue a full refund.',
          },
          {
            title: '6. Acceptable use',
            body: 'You agree to use SquadIQ only for lawful purposes and in accordance with these terms. You may not use the app to store or transmit any unlawful, harmful, or offensive content.',
          },
          {
            title: '7. Player data',
            body: 'You are responsible for ensuring you have appropriate permission to enter player information into the app. Player names and jersey numbers should be used only for legitimate team management purposes.',
          },
          {
            title: '8. Intellectual property',
            body: 'SquadIQ and all its content, features, and functionality are owned by Gava Motion and are protected by copyright and other intellectual property laws.',
          },
          {
            title: '9. Limitation of liability',
            body: 'SquadIQ is provided "as is" without warranties of any kind. Gava Motion is not liable for any indirect, incidental, or consequential damages arising from your use of the app.',
          },
          {
            title: '10. Changes to terms',
            body: 'We reserve the right to modify these terms at any time. Continued use of the app after changes constitutes acceptance of the new terms.',
          },
          {
            title: '11. Contact',
            body: 'For questions about these Terms of Service contact us at support@gavamotion.com.',
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
