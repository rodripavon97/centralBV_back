import { WelcomeEmailBuilder } from '../builders/welcome-email.builder.js';

describe('WelcomeEmailBuilder', () => {
  it('arma el correo de bienvenida con el asunto y las credenciales', () => {
    const options = new WelcomeEmailBuilder({
      to: 'carlos@centralbv.com',
      nombre: 'Carlos',
      password: 'Pepita03!',
    }).build();

    expect(options.to).toBe('carlos@centralbv.com');
    expect(options.subject).toBe(
      'Bienvenido a CentralBV - Credenciales de Acceso',
    );
    expect(options.html).toContain('¡Hola Carlos!');
    expect(options.html).toContain('carlos@centralbv.com');
    expect(options.html).toContain('Pepita03!');
  });

  it('escapa caracteres especiales del nombre y la contraseña', () => {
    const options = new WelcomeEmailBuilder({
      to: 'carlos@centralbv.com',
      nombre: 'Carlos <b>',
      password: '<script>alert(1)</script>',
    }).build();

    expect(options.html).not.toContain('<b>');
    expect(options.html).not.toContain('<script>');
    expect(options.html).toContain('&lt;b&gt;');
    expect(options.html).toContain('&lt;script&gt;');
  });
});
