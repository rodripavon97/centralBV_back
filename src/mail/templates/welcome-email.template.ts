export interface WelcomeEmailTemplateData {
  nombre: string;
  email: string;
  password: string;
}

/** Escapa caracteres especiales para evitar HTML inválido o inyección. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** HTML del correo de bienvenida con las credenciales del usuario. */
export function buildWelcomeEmailHtml({
  nombre,
  email,
  password,
}: WelcomeEmailTemplateData): string {
  const safeNombre = escapeHtml(nombre);
  const safeEmail = escapeHtml(email);
  const safePassword = escapeHtml(password);

  return `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2>¡Hola ${safeNombre}!</h2>
      <p>Un administrador ha creado tu cuenta en el sistema <strong>CentralBV</strong>.</p>
      <p>Tus credenciales de acceso son:</p>
      <ul>
        <li><strong>Correo:</strong> ${safeEmail}</li>
        <li><strong>Contraseña temporal:</strong> <code>${safePassword}</code></li>
      </ul>
      <p style="color: #d9534f;">Por seguridad, te recomendamos cambiar esta contraseña al iniciar sesión por primera vez.</p>
      <br>
      <p>Saludos,<br>El equipo de CentralBV</p>
    </div>
  `;
}
