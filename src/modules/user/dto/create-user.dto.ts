import { IsString, IsArray, IsIn, IsObject, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ description: '사용자 언어', example: 'ko' })
  @IsString()
  language: string;

  @ApiProperty({ 
    description: '관심사 목록', 
    example: ['음식', '문화', '여행'],
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  interests: string[];

  @ApiProperty({ 
    description: '목적', 
    enum: ['tourist', 'local', 'business', 'study'],
    example: 'tourist'
  })
  @IsIn(['tourist', 'local', 'business', 'study'])
  purpose: 'tourist' | 'local' | 'business' | 'study';

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