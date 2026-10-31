export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly nombre: string,
    public readonly apellido: string,
    public readonly activo: boolean,
    public readonly googleSub?: string, 
    public readonly roles?: string[], 
  ) {}
}