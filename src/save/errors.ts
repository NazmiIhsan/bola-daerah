export class SaveError extends Error {
  constructor(public code: 'invalid_json' | 'wrong_shape' | 'unsupported_version') {
    super(`Save error: ${code}`)
    this.name = 'SaveError'
  }
}
