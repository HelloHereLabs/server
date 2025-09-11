import { IsString, IsArray, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRoomDto {
  @ApiProperty({ 
    description: '채팅 상대방 사용자 ID', 
    example: '4d811d8e-c20a-4035-be63-4aae2ba9a8e4' 
  })
  @IsString()
  targetUserId: string;

  @ApiProperty({ 
    description: '채팅방 제목 (옵션)', 
    example: '레무링님과의 대화',
    required: false 
  })
  @IsOptional()
  @IsString()
  title?: string;
}