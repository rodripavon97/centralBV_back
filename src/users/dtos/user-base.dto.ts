// user-base.dto.ts
import { OmitType } from "@nestjs/swagger";
import { CreateUserDto } from "./create-user.dto.js";

export class UserBaseDto extends OmitType(CreateUserDto, ['password'] as const) {}