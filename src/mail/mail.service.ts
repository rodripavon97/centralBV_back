import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import type { ISendMailOptions } from '@nestjs-modules/mailer';
import { MailBuilder } from './builders/mail.builder.js';
import { WelcomeEmailBuilder } from './builders/welcome-email.builder.js';
import { buildRecoveryEmailHtml } from './templates/welcome-email.template.js';

/** Formats nodemailer `to` for log messages (string | Address | array). */
function formatRecipients(to: ISendMailOptions['to']): string {
  if (to == null) return '';
  if (typeof to === 'string') return to;
  if (Array.isArray(to)) {
    return to
      .map((entry) => (typeof entry === 'string' ? entry : entry.address))
      .join(', ');
  }
  return to.address;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly mailerService: MailerService) {}

  /** Envía cualquier correo armado con un builder. */
  async send(mail: MailBuilder) {
    const options = mail.build();
    const recipients = formatRecipients(options.to);

    try {
      await this.mailerService.sendMail(options);
      this.logger.log(`✅ Correo enviado a ${recipients}`);
    } catch (error) {
      this.logger.error(
        `❌ Error enviando correo a ${recipients}: ${(error as Error).message}`,
      );
    }
  }

  async sendWelcomeEmail(to: string, nombre: string, password: string) {
    await this.send(new WelcomeEmailBuilder({ to, nombre, password }));
  }

  async sendRecoveryEmail(to: string, nombre: string, recoveryLink: string): Promise<void> {
    const html = buildRecoveryEmailHtml({ nombre, recoveryLink });

    try {
      await this.mailerService.sendMail({
        to,
        subject: 'Recuperación de contraseña - CentralBV',
        html,
      });
      this.logger.log(`✅ Correo de recuperación enviado a ${to}`);
    } catch (error) {
      this.logger.error(
        `❌ Error enviando recuperación a ${to}: ${(error as Error).message}`,
      );
    }
  }
}
