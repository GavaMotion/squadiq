export const APP_VERSION = '1.0.0';
export const SUPPORT_EMAIL = 'support@gavamotion.com';
export const APP_NAME = 'SquadIQ';

export const PLANS = {
  trial: {
    name: 'Free Trial',
    maxTeams: 1,
    durationDays: 30,
  },
  solo: {
    name: 'Solo Coach',
    maxTeams: 1,
    monthlyPrice: 4.99,
    yearlyPrice: 39.99,
  },
  multi: {
    name: 'Multi Coach',
    maxTeams: 4,
    monthlyPrice: 7.99,
    yearlyPrice: 63.99,
  },
  expired: {
    name: 'Expired',
    maxTeams: 0,
  },
};
