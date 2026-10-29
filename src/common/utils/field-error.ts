/**
 * Cuerpo de error asociado a un campo del formulario.
 * El front muestra `message` debajo de `campo` y usa `code` para decidir
 * qué hacer (por ejemplo, pedir confirmación de una patente especial).
 * HttpExceptionFilter copia `campo` y `code` a la respuesta.
 */
export interface FieldErrorBody {
  message: string;
  campo: string;
  code: string;
}

export function fieldError(
  campo: string,
  code: string,
  message: string,
): FieldErrorBody {
  return { message, campo, code };
}
