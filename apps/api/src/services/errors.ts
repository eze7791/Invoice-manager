/** Error de negocio: la petición es válida pero la operación no se permite en el estado actual. */
export class DomainError extends Error {
  readonly status: 400 | 404 | 409 | 429;
  readonly fields: Record<string, string>;

  constructor(message: string, status: 400 | 404 | 409 | 429 = 409, fields: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}
