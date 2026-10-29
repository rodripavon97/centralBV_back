import { MailBuilder } from './mail.builder.js';
import { buildWelcomeEmailHtml } from '../templates/welcome-email.template.js';

export interface WelcomeEmailData {
  to: string;
  nombre: string;
  password: string;
}

/** Builder concreto para el correo de bienvenida. */
export class WelcomeEmailBuilder extends MailBuilder {
  constructor({ to, nombre, password }: WelcomeEmailData) {
    super();
    this.to(to)
      .subject('Bienvenido a CentralBV - Credenciales de Acceso')
      .html(buildWelcomeEmailHtml({ nombre, email: to, password }));
  }
}
