export function Skeleton({ width = '100%', height = 20, borderRadius = 8, style = {} }) {
  return (
    <div style={{
      width,
      height,
      borderRadius,
      background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      flexShrink: 0,
      ...style,
    }} />
  )
}

export function MyTeamSkeleton() {
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: '#13131f', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <Skeleton width={80} height={80} borderRadius={40} />
        <Skeleton width={140} height={20} />
        <Skeleton width={100} height={14} />
      </div>
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{ background: '#13131f', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Skeleton width={36} height={36} borderRadius={18} />
          <Skeleton width={120} height={16} />
          <Skeleton width={60} height={14} style={{ marginLeft: 'auto' }} />
        </div>
      ))}
    </div>
  )
}

export function LineupSkeleton() {
  return (
    <div style={{ display: 'flex', height: '100%', gap: 0 }}>
      <div style={{ flex: 1, padding: 16 }}>
        <Skeleton width='100%' height='100%' borderRadius={12} style={{ minHeight: 400, opacity: 0.5 }} />
      </div>
      <div style={{ width: 200, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[1,2,3,4,5,6,7,8].map(i => (
          <div key={i} style={{ background: '#13131f', borderRadius: 10, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Skeleton width={28} height={28} borderRadius={14} />
            <Skeleton width={80} height={12} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function PracticeSkeleton() {
  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ flex: 1, padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignContent: 'start' }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ background: '#13131f', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton width='100%' height={14} />
            <Skeleton width='70%' height={10} />
          </div>
        ))}
      </div>
      <div style={{ width: '40%', padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignContent: 'start', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
        {[1,2,3,4,5,6].map(i => (
          <div key={i} style={{ background: '#13131f', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton width='100%' height={14} />
            <Skeleton width='60%' height={10} />
          </div>
        ))}
      </div>
    </div>
  )
}
