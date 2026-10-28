import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly mailerService: MailerService) {}

  async sendWelcomeEmail(to: string, nombre: string, passwordTemporal: string) {
    try {
      await this.mailerService.sendMail({
        to,
        subject: 'Bienvenido a CentralBV - Credenciales de Acceso',
        html: `
          <div style="font-family: Arial, sans-serif; color: #333;">
            <h2>¡Hola ${nombre}!</h2>
            <p>Un administrador ha creado tu cuenta en el sistema <strong>CentralBV</strong>.</p>
            <p>Tus credenciales de acceso son:</p>
            <ul>
              <li><strong>Correo:</strong> ${to}</li>
                 <li><strong>Contraseña temporal:</strong> <code>${passwordTemporal}</code></li>
            </ul>
            <p style="color: #d9534f;">Por seguridad, te recomendamos cambiar esta contraseña al iniciar sesión por primera vez.</p>
            <br>
            <p>Saludos,<br>El equipo de CentralBV</p>
          </div>
        `,
      });
      this.logger.log(`✅ Correo enviado a ${to}`);
    } catch (error) {
      this.logger.error(`❌ Error enviando correo a ${to}: ${(error as Error).message}`);
    }
  }
}