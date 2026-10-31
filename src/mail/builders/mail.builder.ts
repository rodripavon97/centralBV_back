import type { ISendMailOptions } from '@nestjs-modules/mailer';

/**
 * Builder genérico para armar un correo paso a paso.
 *
 * ```ts
 * const mail = new MailBuilder()
 *   .to('usuario@centralbv.com')
 *   .subject('Asunto')
 *   .html('<p>Contenido</p>');
 *
 * await mailService.send(mail);
 * ```
 */
export class MailBuilder {
  private recipients?: string | string[];
  private mailSubject?: string;
  private mailHtml?: string;

  to(recipients: string | string[]): this {
    this.recipients = recipients;
    return this;
  }

  subject(subject: string): this {
    this.mailSubject = subject;
    return this;
  }

  html(html: string): this {
    this.mailHtml = html;
    return this;
  }

  build(): ISendMailOptions {
    const to = this.normalizeRecipients();
    const subject = this.mailSubject?.trim();
    const html = this.mailHtml?.trim();

    if (!to) throw new Error('El correo necesita al menos un destinatario');
    if (!subject) throw new Error('El correo necesita un asunto');
    if (!html) throw new Error('El correo necesita un cuerpo HTML');

    return { to, subject, html };
  }

  private normalizeRecipients(): string | string[] | undefined {
    if (Array.isArray(this.recipients)) {
      const recipients = this.recipients
        .map((recipient) => recipient.trim())
        .filter(Boolean);

      return recipients.length > 0 ? recipients : undefined;
    }

    const recipient = this.recipients?.trim();
    return recipient || undefined;
  }
}
