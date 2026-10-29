import { MailService } from '../mail.service.js';
import { MailBuilder } from '../builders/mail.builder.js';

describe('MailService', () => {
  let sendMail: ReturnType<typeof vi.fn>;
  let service: MailService;

  beforeEach(() => {
    sendMail = vi.fn().mockResolvedValue(undefined);
    service = new MailService({ sendMail } as never);
  });

  it('envía un correo armado con cualquier builder', async () => {
    const mail = new MailBuilder()
      .to('uno@centralbv.com')
      .subject('Asunto')
      .html('<p>Hola</p>');

    await service.send(mail);

    expect(sendMail).toHaveBeenCalledWith({
      to: 'uno@centralbv.com',
      subject: 'Asunto',
      html: '<p>Hola</p>',
    });
  });

  it('envía el correo de bienvenida con la contraseña indicada', async () => {
    await service.sendWelcomeEmail('carlos@centralbv.com', 'Carlos', 'Pepita03!');

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'carlos@centralbv.com',
        subject: 'Bienvenido a CentralBV - Credenciales de Acceso',
        html: expect.stringContaining('Pepita03!'),
      }),
    );
  });

  it('no lanza si el transporte de correo falla', async () => {
    sendMail.mockRejectedValue(new Error('SMTP caído'));

    await expect(
      service.sendWelcomeEmail('carlos@centralbv.com', 'Carlos', 'Pepita03!'),
    ).resolves.toBeUndefined();
  });
});
