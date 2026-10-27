import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AssignRoleDto } from '../dtos/assing-roles.dtos.js';

describe('AssignRoleDto', () => {
  const uuid = '7b0f1c2e-4a5d-4e6f-8a9b-0c1d2e3f4a5b';

  const validateDto = async (data: Record<string, unknown>) => {
    const dto = plainToInstance(AssignRoleDto, data);
    return validate(dto);
  };

  it('acepta UUIDs válidos', async () => {
    expect(
      await validateDto({ usuario_id: uuid, rol_id: uuid }),
    ).toHaveLength(0);
  });

  it('rechaza IDs que no son UUID', async () => {
    const errors = await validateDto({
      usuario_id: 'not-a-uuid',
      rol_id: 'also-bad',
    });
    expect(errors.map((e) => e.property).sort()).toEqual([
      'rol_id',
      'usuario_id',
    ]);
  });
});
