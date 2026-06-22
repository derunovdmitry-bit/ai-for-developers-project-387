import { describe, expect, it } from 'vitest'

import { readConfig } from '../src/config.js'

describe('readConfig', () => {
  it('uses default server settings when ADMIN_PASSWORD is missing', () => {
    expect(readConfig({})).toEqual({
      host: '127.0.0.1',
      port: 3000,
    })
  })

  it('reads ADMIN_PASSWORD and default server settings', () => {
    expect(readConfig({ ADMIN_PASSWORD: 'secret' })).toEqual({
      adminPassword: 'secret',
      host: '127.0.0.1',
      port: 3000,
    })
  })
})
