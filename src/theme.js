// THEME CONFIG — edit any value here to change it app-wide
// Field zone colors: fieldZoneFwd, fieldZoneMid, fieldZoneDef, fieldZoneGk
// Keep zone opacity between 0.08-0.15 for a subtle tactical feel

const theme = {

  // ─── App-wide backgrounds ───────────────────────────────
  bgPrimary:        '#0d0d1a',   // main app background
  bgSecondary:      '#13131f',   // nav bar, bottom bar
  bgPanel:          '#1a1a2e',   // cards, panels, forms

  // ─── Brand colors ───────────────────────────────────────
  brandGreen:       '#00c853',   // primary action green
  brandGreenDark:   '#007a30',   // darker green for gradients
  brandGreenGlow:   'rgba(0,200,83,0.15)',

  // ─── Game Day — field base ───────────────────────────────
  fieldBg:          '#0a0f0c',   // overall field background
  fieldLines:       'rgba(255,255,255,0.12)',  // field markings
  fieldLabel:       'rgba(255,255,255,0.15)',  // OUR GOAL / OPPONENT text

  // ─── Game Day — field tactical zones ────────────────────
  fieldZoneFwd:     'linear-gradient(135deg, rgba(30, 21, 30, 0.1) 0%, rgba(11, 9, 10, 0.4) 100%)',    // attacking zone — subtle red tint
  fieldZoneMid:     'linear-gradient(135deg, rgba(51, 39, 54, 0.1) 0%, rgba(56, 45, 59, 0.4) 100%)',   // midfield zone — subtle blue tint
  fieldZoneDef:     'linear-gradient(135deg, rgba(118, 105, 117, 0.1) 0%, rgba(99, 83, 100, 0.4) 100%)',   // defensive zone — subtle amber tint
  fieldZoneGk:      'linear-gradient(135deg, rgba(208, 191, 210, 0.1) 0%, rgba(132, 126, 154, 0.4) 100%)',    // goalkeeper zone — subtle purple tint

  // Zone label text (shown faintly in each zone strip)
  fieldZoneLabelFwd:  'rgba(220,50,50,0.25)',
  fieldZoneLabelMid:  'rgba(50,100,220,0.25)',
  fieldZoneLabelDef:  'rgba(220,150,50,0.25)',
  fieldZoneLabelGk:   'rgba(80,50,180,0.25)',

  // ─── Game Day — empty position slots ────────────────────
  slotBorderFwd:    'rgba(230, 27, 0, 0.8)',
  slotBorderMid:    'rgba(50,100,220,0.8)',
  slotBorderDef:    'rgba(220,150,50,0.8)',
  slotBorderGk:     'rgba(80,50,180,0.9)',
  slotFill:         'rgba(0,0,0,0.3)',
  slotText:         'rgba(255,255,255,0.6)',

  // ─── Game Day — filled position slot ────────────────────
  slotFilledFwd:    '#f80e0e',
  slotFilledMid:    '#3264dc',
  slotFilledDef:    '#dc9632',
  slotFilledGk:     '#c50e9d',
  slotFilledBorder: 'rgba(255,255,255,0.6)',
  slotFilledShadow: '3px 4px 8px rgba(0,0,0,0.6), inset 0 2px 3px rgba(255,255,255,0.35)',

  // ─── Game Day — player panel ─────────────────────────────
  playerPanelGradient: 'linear-gradient(180deg, #1a1d21 0%, #121116 30%, #090c10 60%, #080a0b 100%)',
  playerRowBg:         'transparent',
  playerRowHover:      'rgba(255,255,255,0.08)',
  playerRowBorder:     'rgba(255,255,255,0.06)',
  playerNumberBadge:   'rgba(255,255,255,0.15)',
  playerNameColor:     '#ffffff',
  quarterCircleEmpty:  'rgba(255,255,255,0.35)',
  quarterCircleFilled: '#00c853',
  quarterCountText:    'rgba(255,255,255,0.65)',
  panelHeaderBg:       'rgba(0,0,0,0.2)',
  panelHeaderText:     'rgba(255,255,255,0.6)',

  // ─── Game Day — assigned player row ─────────────────────
  assignedRowGradient: 'linear-gradient(90deg, #0a5228 0%, #06a746 100%)',
  assignedRowText:     '#ffffff',
  assignedRowBadge:    'rgba(0,0,0,0.2)',
  assignedRowCircle:   'rgba(0,0,0,0.2)',

  // ─── Game Day — at risk row ──────────────────────────────
  atRiskRowBg:        'linear-gradient(90deg, #200939 0%, #4e1e78 100%)',
  atRiskRowText:       '#ffffff',

  // ─── Free Subs mode — cyan chrome ────────────────────────
  // One accent owns the whole mode so it reads as a different place in the
  // app without leaving the dark shell. Green stays "assigned", amber/red
  // stay the three-quarter-rule scale; cyan means "clock is tracking this".
  freeAccent:        '#00b8d4',
  freeAccentBright:  '#22d3ee',
  freeAccentDim:     'rgba(0,184,212,0.14)',
  freeAccentGlow:    'rgba(0,184,212,0.32)',
  freeBarTrack:      'rgba(255,255,255,0.07)',
  freeBarFill:       'linear-gradient(90deg, #0891b2 0%, #22d3ee 100%)',
  freePanelBg:       '#0b1418',

  // ─── Game Day — absent row ───────────────────────────────
  absentRowBg:         'transparent',
  absentRowText:       'rgba(255,255,255,0.5)',

  // ─── Practice screen ─────────────────────────────────────
  drillCardBg:         '#1a1a2e',
  drillCardBorder:     'rgba(255,255,255,0.08)',
  drillCardText:       '#ffffff',
  drillCardSubtext:    'rgba(255,255,255,0.7)',

  // ─── Category pill colors ────────────────────────────────
  catWarmup:           '#854F0B',
  catDribbling:        '#4A9FE0',
  catPassing:          '#2DC49A',
  catShooting:         '#E24B4A',
  catDefending:        '#8B7FE8',
  catTeamwork:         '#7BC142',
  catCooldown:         '#A0A09A',

  // ─── Navigation ──────────────────────────────────────────
  navBg:               '#13131f',
  navActiveColor:      '#00c853',
  navInactiveColor:    'rgba(255,255,255,0.55)',
  navBorderTop:        'rgba(255,255,255,0.08)',
  navColorMyTeam:      '#D4537E',
  navColorGameDay:     '#00c853',
  navColorSketch:      '#FF6B2B',
  navColorPractice:    '#00BCD4',

  // ─── Forms and inputs ────────────────────────────────────
  inputBg:             '#1a1a2e',
  inputBorder:         'rgba(255,255,255,0.12)',
  inputFocusBorder:    '#00c853',
  inputText:           '#ffffff',
  buttonPrimaryBg:     '#00c853',
  buttonPrimaryText:   '#ffffff',
  buttonSecondaryBg:   'transparent',
  buttonSecondaryBorder: 'rgba(255,255,255,0.2)',
  buttonSecondaryText: '#ffffff',

};

export default theme;
