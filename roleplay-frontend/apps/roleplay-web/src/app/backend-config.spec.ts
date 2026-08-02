import { describe, expect, it } from 'vitest';

import { resolveBackendConfigFrom, type ServingOrigin } from './backend-config';

function origin(
  hostname: string,
  search = '',
  protocol = 'http:',
): ServingOrigin {
  return { protocol, hostname, search };
}

describe('resolveBackendConfigFrom', () => {
  it('derives URLs from the serving host (remote/LAN case)', () => {
    const config = resolveBackendConfigFrom(origin('den-k8'), undefined);
    expect(config.rustyCrewBaseUrl).toBe('http://den-k8:9347');
    expect(config.lorekeepBaseUrl).toBe('http://den-k8:8790');
    expect(config.bearerToken).toBeUndefined();
    expect(config.runtimeProfileId).toBeUndefined();
    expect(config.coordinationRole).toBe('production');
  });

  it('preserves the serving protocol when deriving', () => {
    const config = resolveBackendConfigFrom(
      origin('host', '', 'https:'),
      undefined,
    );
    expect(config.rustyCrewBaseUrl).toBe('https://host:9347');
  });

  it('prefers ?api= and ?lore= query params over derivation', () => {
    const config = resolveBackendConfigFrom(
      origin('den-k8', '?api=http://other:1111&lore=http://lore:2222'),
      undefined,
    );
    expect(config.rustyCrewBaseUrl).toBe('http://other:1111');
    expect(config.lorekeepBaseUrl).toBe('http://lore:2222');
  });

  it('normalizes host-port query params into full URLs', () => {
    const config = resolveBackendConfigFrom(
      origin('den-k8', '?api=192.168.1.22:9348&lore=192.168.1.22:8790'),
      undefined,
    );
    expect(config.rustyCrewBaseUrl).toBe('http://192.168.1.22:9348');
    expect(config.lorekeepBaseUrl).toBe('http://192.168.1.22:8790');
  });

  it('uses injected window config when no query param is present', () => {
    const config = resolveBackendConfigFrom(origin('den-k8'), {
      rustyCrewBaseUrl: 'http://crew.example:9000',
      bearerToken: 'tok',
    });
    expect(config.rustyCrewBaseUrl).toBe('http://crew.example:9000');
    // lorekeep falls back to derivation when window config omits it.
    expect(config.lorekeepBaseUrl).toBe('http://den-k8:8790');
    expect(config.bearerToken).toBe('tok');
  });

  it('uses an explicit debug coordination role from deployment config', () => {
    const config = resolveBackendConfigFrom(origin('den-k8'), {
      rustyCrewBaseUrl: 'http://den-k8:9350',
      coordinationRole: 'debug',
    });

    expect(config.coordinationRole).toBe('debug');
  });

  it('query param wins over window config', () => {
    const config = resolveBackendConfigFrom(
      origin('den-k8', '?api=http://q:1'),
      {
        rustyCrewBaseUrl: 'http://w:2',
      },
    );
    expect(config.rustyCrewBaseUrl).toBe('http://q:1');
  });

  it('resolves an operator runtime profile without treating it as a user', () => {
    const queryConfig = resolveBackendConfigFrom(
      origin('den-k8', '?profile=roleplay-narrator'),
      { runtimeProfileId: 'window-narrator' },
    );
    const windowConfig = resolveBackendConfigFrom(origin('den-k8'), {
      runtimeProfileId: 'window-narrator',
    });

    expect(queryConfig.runtimeProfileId).toBe('roleplay-narrator');
    expect(windowConfig.runtimeProfileId).toBe('window-narrator');
  });

  it('normalizes host-port window config with the serving protocol', () => {
    const config = resolveBackendConfigFrom(origin('den-k8', '', 'https:'), {
      rustyCrewBaseUrl: 'crew.example:9000',
      lorekeepBaseUrl: '//lore.example:8790',
    });
    expect(config.rustyCrewBaseUrl).toBe('https://crew.example:9000');
    expect(config.lorekeepBaseUrl).toBe('https://lore.example:8790');
  });

  it('ignores a blank query param and falls through', () => {
    const config = resolveBackendConfigFrom(
      origin('den-k8', '?api='),
      undefined,
    );
    expect(config.rustyCrewBaseUrl).toBe('http://den-k8:9347');
  });
});
