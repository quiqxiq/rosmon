import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'
import { getAPIErrorCode, getAPIErrorDetails, parseAPIError } from './errors'

function makeAxiosError(payload: unknown, status = 400): AxiosError {
  return new AxiosError(
    'Request failed',
    'ERR_BAD_REQUEST',
    undefined,
    null,
    {
      data: payload,
      status,
      statusText: 'Bad Request',
      headers: {},
      config: {
        headers: new AxiosHeaders(),
      },
    },
  )
}

describe('parseAPIError', () => {
  it('extracts message from a backend envelope error', () => {
    const err = makeAxiosError({
      data: null,
      error: { code: 'invalid_input', message: 'username is required' },
    })
    expect(parseAPIError(err)).toBe('username is required')
  })

  it('falls back to AxiosError.message when no envelope is present', () => {
    const err = makeAxiosError(undefined)
    expect(parseAPIError(err)).toBe('Request failed')
  })

  it('returns Error.message for native errors', () => {
    expect(parseAPIError(new Error('boom'))).toBe('boom')
  })

  it('returns a fallback for unknown thrown values', () => {
    expect(parseAPIError('a string')).toBe('Unknown error')
    expect(parseAPIError(undefined)).toBe('Unknown error')
    expect(parseAPIError({ totally: 'unrelated' })).toBe('Unknown error')
  })
})

describe('getAPIErrorCode', () => {
  it('reads the stable code from a backend envelope error', () => {
    const err = makeAxiosError({
      data: null,
      error: { code: 'tenant_suspended', message: 'tenant is suspended' },
    })
    expect(getAPIErrorCode(err)).toBe('tenant_suspended')
  })

  it('returns undefined when the envelope has no error', () => {
    const err = makeAxiosError({ data: { ok: true }, error: null })
    expect(getAPIErrorCode(err)).toBeUndefined()
  })

  it('returns undefined for non-axios errors', () => {
    expect(getAPIErrorCode(new Error('x'))).toBeUndefined()
    expect(getAPIErrorCode('plain string')).toBeUndefined()
  })
})

describe('getAPIErrorDetails', () => {
  it('returns the structured details payload when present', () => {
    const details = { fields: { username: 'required' } }
    const err = makeAxiosError({
      data: null,
      error: { code: 'invalid_input', message: 'bad', details },
    })
    expect(getAPIErrorDetails(err)).toEqual(details)
  })

  it('returns undefined when details are absent', () => {
    const err = makeAxiosError({
      data: null,
      error: { code: 'unauthorized', message: 'no token' },
    })
    expect(getAPIErrorDetails(err)).toBeUndefined()
  })
})
