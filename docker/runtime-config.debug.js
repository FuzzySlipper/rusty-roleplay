// The isolated test deployment serves the UI and APIs from the same origin.
// It deliberately uses Crew's debug coordination routes.
window.__RUSTY_ROLEPLAY_CONFIG__ = {
  ...(window.__RUSTY_ROLEPLAY_CONFIG__ || {}),
  rustyCrewBaseUrl: window.location.origin,
  lorekeepBaseUrl: window.location.origin,
  coordinationRole: "debug",
};
