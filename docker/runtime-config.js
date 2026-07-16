// The container deployment serves the UI and APIs from the same public origin.
window.__RUSTY_ROLEPLAY_CONFIG__ = {
  ...(window.__RUSTY_ROLEPLAY_CONFIG__ || {}),
  rustyCrewBaseUrl: window.location.origin,
  lorekeepBaseUrl: window.location.origin,
};
