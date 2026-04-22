import { useState } from 'react'

const STEPS = [
  {
    icon: '👥',
    title: 'Create your team',
    description: 'Start by creating your team in the My Team tab. Add your players with their jersey numbers and preferred positions.',
  },
  {
    icon: '📋',
    title: 'Plan your lineup',
    description: 'In the Lineup tab, drag players onto the field and assign them to each quarter. The app tracks playing time so every player gets their fair share.',
  },
  {
    icon: '✏️',
    title: 'Sketch your tactics',
    description: 'Use the Sketch tab to draw up plays. Drag players anywhere on the field and draw movement arrows with your finger.',
  },
  {
    icon: '⚽',
    title: 'Plan your practices',
    description: 'In the Practice tab, drag drills from the library into your plan. Generate a suggested plan by category and duration.',
  },
  {
    icon: '🚀',
    title: "You're ready!",
    description: 'CoachPad Tactix is designed to be used on the sideline. Install it on your home screen for the best experience.',
  },
]

export default function Onboarding({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0)
  const step = STEPS[currentStep]
  const isLast = currentStep === STEPS.length - 1

  function handleNext() {
    if (isLast) {
      localStorage.setItem('onboardingComplete', 'true')
      onComplete()
    } else {
      setCurrentStep(prev => prev + 1)
    }
  }

  function handleSkip() {
    localStorage.setItem('onboardingComplete', 'true')
    onComplete()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9998,
      padding: 24,
    }}>
      <div style={{
        background: '#1a1a2e',
        border: '1px solid rgba(0,200,83,0.2)',
        borderRadius: 20,
        padding: 32,
        width: '100%',
        maxWidth: 380,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        textAlign: 'center',
      }}>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 6 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === currentStep ? 20 : 6,
              height: 6,
              borderRadius: 3,
              background: i === currentStep
                ? '#00c853'
                : i < currentStep
                  ? 'rgba(0,200,83,0.4)'
                  : 'rgba(255,255,255,0.15)',
              transition: 'all 0.3s ease',
            }} />
          ))}
        </div>

        {/* Icon */}
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'rgba(0,200,83,0.1)', border: '2px solid rgba(0,200,83,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36,
        }}>
          {step.icon}
        </div>

        {/* Title */}
        <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, lineHeight: 1.3 }}>
          {step.title}
        </div>

        {/* Description */}
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.7, maxWidth: 300 }}>
          {step.description}
        </div>

        {/* Next button */}
        <button
          onClick={handleNext}
          style={{
            background: '#00c853', color: '#fff', border: 'none',
            borderRadius: 12, padding: '14px 32px', fontSize: 15,
            fontWeight: 700, cursor: 'pointer', width: '100%', marginTop: 4,
          }}
        >
          {isLast ? "Let's go!" : 'Next →'}
        </button>

        {!isLast && (
          <button
            onClick={handleSkip}
            style={{
              background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.3)', fontSize: 13,
              cursor: 'pointer', padding: '4px 0',
            }}
          >
            Skip intro
          </button>
        )}
      </div>
    </div>
  )
}
