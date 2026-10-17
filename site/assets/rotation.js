/* SquadIQ — fair rotation planner shared by the free coach tools
   (ayso-playing-time.html and soccer-rotation-template.html).

   Plain ES5, no dependencies. Exposes window.SquadRotation.

   The model: a game is split into P sub periods (quarters, or halves, or
   halves with a mid-half sub break). F players are on the field each period.
   Playing time is handed out as evenly as the maths allows — never more than
   one period apart between any two kids — and the sits are spread so nobody
   sits twice before a teammate who still owes a sit. */
(function () {
  'use strict';

  var FORMATS = {
    '4v4':   { onField: 4,  gk: false, label: '4v4 (no goalkeeper)' },
    '7v7':   { onField: 7,  gk: true,  label: '7v7 (incl. goalkeeper)' },
    '9v9':   { onField: 9,  gk: true,  label: '9v9 (incl. goalkeeper)' },
    '11v11': { onField: 11, gk: true,  label: '11v11 (incl. goalkeeper)' }
  };

  var PERIODS = {
    quarters: { count: 4, labels: ['Q1', 'Q2', 'Q3', 'Q4'], name: '4 quarters' },
    halves:   { count: 2, labels: ['Half 1', 'Half 2'], name: '2 halves (subs at halftime only)' },
    halvesMid: {
      count: 4,
      labels: ['H1 · A', 'H1 · B', 'H2 · A', 'H2 · B'],
      name: '2 halves with a mid-half sub break'
    }
  };

  /* Periods each player must play to reach `share` (0.5 or 0.75) of P. */
  function required(periods, share) {
    return Math.ceil(share * periods - 1e-9);
  }

  /* Build a rotation.
     opts: { names: [string], onField: n, periods: n, gk: bool }
     returns {
       grid: [[ 'on' | 'gk' | 'off' ]]   // grid[player][period]
       plays: [n], gkTurns: [n], sitters: [[playerIndex]] per period,
       onField: n (actual, = min(roster, onField)), periods: n
     } */
  function build(opts) {
    var names = opts.names || [];
    var R = names.length;
    var P = opts.periods;
    var F = Math.min(opts.onField, R);
    var k = R - F;                       // kids sitting each period
    var total = F * P;                   // player-periods available
    var base = R ? Math.floor(total / R) : 0;
    var extra = R ? total % R : 0;

    var plays = [], rem = [], lastSat = [], grid = [], gkTurns = [], i, p;
    for (i = 0; i < R; i++) {
      plays[i] = base + (i < extra ? 1 : 0);
      rem[i] = P - plays[i];
      lastSat[i] = -1;
      gkTurns[i] = 0;
      grid[i] = [];
    }

    var sitters = [];
    for (p = 0; p < P; p++) {
      var pool = [];
      for (i = 0; i < R; i++) if (rem[i] > 0) pool.push(i);
      // Most sits still owed first (keeps the greedy feasible), then whoever
      // sat longest ago, then a rotating roster order so ties move around.
      pool.sort(function (a, b) {
        if (rem[b] !== rem[a]) return rem[b] - rem[a];
        if (lastSat[a] !== lastSat[b]) return lastSat[a] - lastSat[b];
        return ((a - p * k) % R + R) % R - ((b - p * k) % R + R) % R;
      });
      var out = pool.slice(0, k);
      sitters.push(out);
      for (i = 0; i < R; i++) grid[i][p] = 'on';
      out.forEach(function (j) { grid[j][p] = 'off'; rem[j]--; lastSat[j] = p; });

      if (opts.gk && F > 0) {
        var keeper = -1;
        for (var n = 0; n < R; n++) {
          var c = (p + n) % R;
          if (grid[c][p] !== 'on') continue;
          if (keeper === -1 || gkTurns[c] < gkTurns[keeper]) keeper = c;
        }
        if (keeper > -1) { grid[keeper][p] = 'gk'; gkTurns[keeper]++; }
      }
    }

    return { grid: grid, plays: plays, gkTurns: gkTurns, sitters: sitters, onField: F, periods: P };
  }

  /* Largest roster where every kid can reach `need` periods. */
  function maxRoster(onField, periods, need) {
    return need > 0 ? Math.floor(onField * periods / need) : Infinity;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  window.SquadRotation = {
    FORMATS: FORMATS,
    PERIODS: PERIODS,
    required: required,
    build: build,
    maxRoster: maxRoster,
    esc: esc
  };
})();
