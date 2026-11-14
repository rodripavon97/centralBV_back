import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GenerateCompartmentsDto } from '../dtos/generate-compartments.dto.js';
import { CreateCompartmentDto } from '../dtos/create-compartment.dto.js';
import { UpdateCompartmentDto } from '../dtos/update-compartment.dto.js';
import { UpdateCompartmentStatusDto } from '../dtos/update-compartment-status.dto.js';

const errorsOf = async <T extends object>(cls: new () => T, body: object) =>
  (await validate(plainToInstance(cls, body))).flatMap((e) =>
    Object.values(e.constraints ?? {}),
  );

describe('compartment DTOs', () => {
  const ok = {
    ladoConductor: 5,
    ladoAcompanante: 2,
    trasero: 1,
    techo: true,
    cabina: false,
  };

  it('generar acepta los límites decididos', async () => {
    expect(await errorsOf(GenerateCompartmentsDto, ok)).toEqual([]);
    expect(
      await errorsOf(GenerateCompartmentsDto, {
        ...ok,
        ladoConductor: 10,
        trasero: 3,
      }),
    ).toEqual([]);
  });

  it('generar rechaza más de 10 por lado, más de 3 traseros y no enteros', async () => {
    expect(
      await errorsOf(GenerateCompartmentsDto, { ...ok, ladoConductor: 11 }),
    ).toEqual(['Lado conductor: entre 0 y 10']);
    expect(
      await errorsOf(GenerateCompartmentsDto, { ...ok, trasero: 4 }),
    ).toEqual(['Trasero: entre 0 y 3']);
    expect(
      await errorsOf(GenerateCompartmentsDto, { ...ok, ladoAcompanante: 1.5 }),
    ).toHaveLength(1);
    expect(
      await errorsOf(GenerateCompartmentsDto, { ...ok, techo: 'si' }),
    ).toEqual(['Techo: indicá sí o no']);
  });

  it('crear pide nombre (hasta 20) y una zona válida', async () => {
    expect(
      await errorsOf(CreateCompartmentDto, {
        nombre: 'LC-6',
        zona: 'LADO_CONDUCTOR',
      }),
    ).toEqual([]);
    expect(
      await errorsOf(CreateCompartmentDto, {
        nombre: '   ',
        zona: 'LADO_CONDUCTOR',
      }),
    ).toEqual(['El nombre es obligatorio']);
    expect(
      await errorsOf(CreateCompartmentDto, {
        nombre: 'x'.repeat(21),
        zona: 'TECHO',
      }),
    ).toEqual(['El nombre puede tener hasta 20 caracteres']);
    expect(
      await errorsOf(CreateCompartmentDto, { nombre: 'A', zona: 'MOTOR' }),
    ).toEqual(['Elegí una zona']);
  });

  it('editar acepta campos sueltos', async () => {
    expect(await errorsOf(UpdateCompartmentDto, {})).toEqual([]);
    expect(await errorsOf(UpdateCompartmentDto, { zona: 'CABINA' })).toEqual(
      [],
    );
    expect(await errorsOf(UpdateCompartmentDto, { nombre: '' })).toEqual([
      'El nombre es obligatorio',
    ]);
  });

  it('estado acepta solo los cuatro valores', async () => {
    for (const estado of [
      'OPERATIVO',
      'OBSERVACIONES',
      'DANADO',
      'FUERA_DE_USO',
    ]) {
      expect(await errorsOf(UpdateCompartmentStatusDto, { estado })).toEqual(
        [],
      );
    }
    expect(
      await errorsOf(UpdateCompartmentStatusDto, { estado: 'ROTO' }),
    ).toEqual(['Elegí un estado válido']);
  });
});
