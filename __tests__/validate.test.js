'use strict';

const { validateUrl } = require('../lib/validate');

describe('validateUrl', () => {
  test('accepts a valid http URL', () => {
    const result = validateUrl('http://example.com');
    expect(result.valid).toBe(true);
  });

  test('accepts a valid https URL', () => {
    const result = validateUrl('https://example.com/path?q=1');
    expect(result.valid).toBe(true);
  });

  test('rejects an invalid URL string', () => {
    const result = validateUrl('not-a-url');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('INVALID_URL');
  });

  test('rejects ftp:// protocol', () => {
    const result = validateUrl('ftp://example.com');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('INVALID_URL');
  });

  test('rejects localhost', () => {
    const result = validateUrl('http://localhost:3000');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('PRIVATE_URL');
  });

  test('rejects 127.x.x.x addresses', () => {
    const result = validateUrl('http://127.0.0.1');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('PRIVATE_URL');
  });

  test('rejects 192.168.x.x addresses', () => {
    const result = validateUrl('http://192.168.1.1');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('PRIVATE_URL');
  });
});
