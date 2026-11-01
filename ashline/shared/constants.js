// Shared constants for server, client and practice simulation. Pure data, no dependencies.

export const GAME_NAME = 'ASHLINE';
export const PROTOCOL_VERSION = 2;

export const TICK_RATE = 30;            // simulation ticks per second (server + prediction)
export const DT = 1 / TICK_RATE;
export const INTERP_TICKS = 3;          // remote entities are rendered ~100 ms in the past
export const LAG_COMP_TICKS = 8;        // max rewind for hit validation (~266 ms)

export const MAP_SIZE = 1024;           // metres, centred on the origin
export const MAP_HALF = MAP_SIZE / 2;
export const HM_CELLS = 256;            // heightmap cells per side (4 m each)
export const HM_N = HM_CELLS + 1;       // heightmap vertices per side
export const HM_CELL = MAP_SIZE / HM_CELLS;
export const WATER_LEVEL = 2.0;
export const DEFAULT_MAP_SEED = 7331;

export const GRAVITY = 17;

export const PLAYER = {
  halfWidth: 0.34,
  height: 1.8,
  crouchHeight: 1.22,
  knockedHeight: 0.72,
  eye: 1.62,
  crouchEye: 1.04,
  knockedEye: 0.48,
  stepUp: 0.46,
  walk: 4.7,
  sprint: 6.6,
  crouch: 2.3,
  ads: 2.7,
  knocked: 1.0,
  jump: 5.4,
  maxHp: 100,
};

// Movement modes (also used on the wire).
export const MODE = { GROUND: 0, FREEFALL: 1, CHUTE: 2, KNOCKED: 3, PLANE: 4, DEAD: 5, WAITING: 6, VEHICLE: 7 };

// Input button bits.
export const BTN = {
  FIRE: 1, ADS: 2, JUMP: 4, CROUCH: 8, SPRINT: 16, RELOAD: 32, USE: 64, WALK: 128,
};

export const MODES = {
  solo: { squad: 1, label: 'Solo' },
  duo: { squad: 2, label: 'Duo' },
  trio: { squad: 3, label: 'Trio' },
};
export const MATCH_PLAYERS = 30;

export const PLANE = { alt: 430, speed: 74, edge: 700 };
export const CHUTE_AUTO = 130;          // auto-deploy height above ground (m)
export const RELEVANCE = 720;           // players further than this are not sent

export const REVIVE_TIME = 6;
export const HACK_TIME = 8;
export const PICKUP_RANGE = 2.7;
export const REVIVE_RANGE = 1.9;
