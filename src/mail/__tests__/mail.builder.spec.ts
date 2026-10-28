import { MailBuilder } from '../builders/mail.builder.js';

describe('MailBuilder', () => {
  it('arma un correo con destinatario, asunto y HTML', () => {
    const options = new MailBuilder()
      .to('carlos@centralbv.com')
      .subject('Bienvenido')
      .html('<p>Hola</p>')
      .build();

    expect(options).toEqual({
      to: 'carlos@centralbv.com',
      subject: 'Bienvenido',
      html: '<p>Hola</p>',
    });
  });

  it('recorta espacios en los campos', () => {
    const options = new MailBuilder()
      .to('  carlos@centralbv.com  ')
      .subject('  Asunto  ')
      .html('  <p>Hola</p>  ')
      .build();

    expect(options).toEqual({
      to: 'carlos@centralbv.com',
      subject: 'Asunto',
      html: '<p>Hola</p>',
    });
  });

  it('acepta varios destinatarios y descarta los vacíos', () => {
    const options = new MailBuilder()
      .to(['uno@centralbv.com', ' ', 'dos@centralbv.com'])
      .subject('Asunto')
      .html('<p>Hola</p>')
      .build();

    expect(options.to).toEqual(['uno@centralbv.com', 'dos@centralbv.com']);
  });

  it('lanza error si falta el destinatario', () => {
    expect(() => new MailBuilder().subject('Asunto').html('<p>x</p>').build()).toThrow(
      'destinatario',
    );
  });

  it('lanza error si falta el asunto', () => {
    expect(() =>
      new MailBuilder().to('uno@centralbv.com').html('<p>x</p>').build(),
    ).toThrow('asunto');
  });

  it('lanza error si falta el HTML', () => {
    expect(() =>
      new MailBuilder().to('uno@centralbv.com').subject('Asunto').build(),
    ).toThrow('HTML');
  });

  it('lanza error si el destinatario es una lista vacía', () => {
    expect(() =>
      new MailBuilder()
        .to([' ', ''])
        .subject('Asunto')
        .html('<p>x</p>')
        .build(),
    ).toThrow('destinatario');
  });
});
