import { RecoveryEmailTemplateData, WelcomeEmailTemplateData } from "./mail.interface.js";

/**
 * Tokens del design system del front (centralBV/src/styles/tokens.css).
 * Los clientes de correo no soportan variables CSS ni hojas externas,
 * así que se copian los valores y se aplican inline. Si cambia tokens.css,
 * actualizar acá también.
 */
const tokens = {
  bgBase: '#1b1a18',
  bgSurface: '#252422',
  bgRaised: '#302e2b',
  borderSubtle: '#302e2b',
  borderStrong: '#4d4944',
  textPrimary: '#ede8e3',
  textSecondary: '#c6beb6',
  textMuted: '#a39a92',
  accentText: '#f0625a',
  accentFill: '#c8281e',
  warn: '#f2b84b',
  warnBg: '#4a3208',
  fontSans:
    "'Inter Variable', Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
  fontMono:
    "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  radiusMd: '6px',
  radiusLg: '10px',
} as const;

/** Equivalente inline de la utilidad `text-eyebrow`. */
const eyebrow = `font-family: ${tokens.fontMono}; font-size: 12px; line-height: 16px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: ${tokens.textMuted};`;

/** Escapa caracteres especiales para evitar HTML inválido o inyección. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function credentialRow(label: string, value: string, mono: boolean): string {
  const valueFont = mono
    ? `font-family: ${tokens.fontMono}; font-size: 14px; line-height: 20px;`
    : `font-family: ${tokens.fontSans}; font-size: 14px; line-height: 20px; font-weight: 500;`;

  return `
                    <tr>
                      <td style="padding: 12px 16px;">
                        <div style="${eyebrow}">${label}</div>
                        <div style="${valueFont} color: ${tokens.textPrimary}; padding-top: 4px; word-break: break-all;">${value}</div>
                      </td>
                    </tr>`;
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
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="dark">
    <meta name="supported-color-schemes" content="dark">
    <title>Bienvenido a CentralBV</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
      :root { color-scheme: dark; supported-color-schemes: dark; }
      body { margin: 0; padding: 0; }
      @media (max-width: 600px) {
        .cbv-card { padding: 24px !important; }
      }
    </style>
  </head>
  <body style="margin: 0; padding: 0; background-color: ${tokens.bgBase}; color: ${tokens.textPrimary}; font-family: ${tokens.fontSans}; -webkit-font-smoothing: antialiased;">
    <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">Tus credenciales de acceso a CentralBV.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${tokens.bgBase};">
      <tr>
        <td align="center" style="padding: 32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px;">
            <tr>
              <td style="padding: 0 0 24px 0;">
                <span style="font-family: ${tokens.fontSans}; font-size: 20px; line-height: 28px; font-weight: 600; color: ${tokens.textPrimary};">Central<span style="color: ${tokens.accentText};">BV</span></span>
              </td>
            </tr>
            <tr>
              <td class="cbv-card" style="background-color: ${tokens.bgSurface}; border: 1px solid ${tokens.borderStrong}; border-radius: ${tokens.radiusLg}; padding: 32px;">
                <div style="${eyebrow}">Alta de cuenta</div>
                <h1 style="margin: 8px 0 0 0; font-family: ${tokens.fontSans}; font-size: 24px; line-height: 32px; font-weight: 600; color: ${tokens.textPrimary};">¡Hola ${safeNombre}!</h1>
                <p style="margin: 8px 0 0 0; font-size: 14px; line-height: 20px; color: ${tokens.textSecondary};">Un administrador creó tu cuenta en el sistema CentralBV. Estas son tus credenciales de acceso:</p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px; background-color: ${tokens.bgRaised}; border: 1px solid ${tokens.borderSubtle}; border-radius: ${tokens.radiusMd};">${credentialRow('Correo', safeEmail, false)}
                    <tr><td style="height: 1px; line-height: 1px; font-size: 0; background-color: ${tokens.borderStrong};">&nbsp;</td></tr>${credentialRow('Contraseña temporal', safePassword, true)}
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 16px; background-color: ${tokens.warnBg}; border: 1px solid ${tokens.warn}; border-radius: ${tokens.radiusMd};">
                  <tr>
                    <td style="padding: 8px 12px; font-size: 14px; line-height: 20px; color: ${tokens.warn};">Por seguridad, cambiá esta contraseña al iniciar sesión por primera vez.</td>
                  </tr>
                </table>

                <p style="margin: 24px 0 0 0; font-size: 14px; line-height: 20px; color: ${tokens.textSecondary};">Saludos,<br>El equipo de CentralBV</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 24px 0 0 0;">
                <div style="${eyebrow}">Acceso exclusivo para personal autorizado</div>
                <p style="margin: 8px 0 0 0; font-size: 12px; line-height: 16px; color: ${tokens.textMuted};">Si no esperabas este correo, avisale a un administrador.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `;
}



//** HTML de recuperacion de contraseña */
export function buildRecoveryEmailHtml({ nombre, recoveryLink }: RecoveryEmailTemplateData): string {
  const safeNombre = escapeHtml(nombre);
  const safeLink = escapeHtml(recoveryLink);

  return `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8">
    <title>Recuperación de contraseña - CentralBV</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: ${tokens.bgBase}; color: ${tokens.textPrimary}; font-family: ${tokens.fontSans};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${tokens.bgBase};">
      <tr>
        <td align="center" style="padding: 32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px;">
            <tr>
              <td style="padding: 0 0 24px 0;">
                <span style="font-family: ${tokens.fontSans}; font-size: 20px; font-weight: 600; color: ${tokens.textPrimary};">Central<span style="color: ${tokens.accentText};">BV</span></span>
              </td>
            </tr>
            <tr>
              <td style="background-color: ${tokens.bgSurface}; border: 1px solid ${tokens.borderStrong}; border-radius: ${tokens.radiusLg}; padding: 32px;">
                <div style="${eyebrow}">Seguridad</div>
                <h1 style="margin: 8px 0 0 0; font-family: ${tokens.fontSans}; font-size: 24px; font-weight: 600; color: ${tokens.textPrimary};">Hola ${safeNombre},</h1>
                <p style="margin: 8px 0 0 0; font-size: 14px; color: ${tokens.textSecondary};">Recibimos una solicitud para restablecer la contraseña de tu cuenta. Hacé clic en el siguiente botón para elegir una nueva:</p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 32px;">
                  <tr>
                    <td align="center">
                      <a href="${safeLink}" style="background-color: ${tokens.accentFill}; color: #ffffff; font-family: ${tokens.fontSans}; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: ${tokens.radiusMd}; display: inline-block;">
                        Restablecer Contraseña
                      </a>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 32px; border-top: 1px solid ${tokens.borderStrong};">
                  <tr>
                    <td style="padding-top: 16px; font-size: 12px; color: ${tokens.textMuted};">
                      Este enlace expirará en 2 horas. Si no solicitaste un cambio de contraseña, podés ignorar este correo de forma segura.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 24px 0 0 0;">
                <div style="${eyebrow}">Acceso exclusivo para personal autorizado</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `;
}