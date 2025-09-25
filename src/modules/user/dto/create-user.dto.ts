import { IsString, IsArray, IsIn, IsObject, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { LANGUAGES, INTERESTS, PURPOSES, Language, Interest, Purpose } from '../../../constants/app.constants';

export class CreateUserDto {
  @ApiProperty({
    description: '사용자 언어',
    enum: LANGUAGES,
    example: 'Korean'
  })
  @IsIn(LANGUAGES)
  language: Language;

  @ApiProperty({
    description: '관심사 목록',
    enum: INTERESTS,
    example: ['K-FOOD', 'HISTORY', 'LANGUAGE'],
    type: [String]
  })
  @IsArray()
  @IsIn(INTERESTS, { each: true })
  interests: Interest[];

  @ApiProperty({
    description: '목적',
    enum: PURPOSES,
    example: 'Language Exchange'
  })
  @IsIn(PURPOSES)
  purpose: Purpose;

  @ApiProperty({
    description: '위치 정보',
    example: { latitude: 37.5665, longitude: 126.9780 }
  })
  @IsObject()
  location: {
    latitude: number;
    longitude: number;
  };
}