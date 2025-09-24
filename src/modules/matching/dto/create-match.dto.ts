import { IsString, IsNumber } from 'class-validator';

export class CreateMatchDto {
  @IsString()
  userAId: string;

  @IsString()
  userBId: string;

  @IsNumber()
  distance: number;

  @IsNumber()
  interestScore: number;
}