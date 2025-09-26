import { Controller, Post, Get, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from '../../entities/user.entity';
import { LANGUAGES, INTERESTS, PURPOSES } from '../../constants/app.constants';

@ApiTags('사용자')
@ApiBearerAuth('access-token')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiOperation({ summary: '사용자 생성', description: '새로운 사용자를 생성합니다' })
  @ApiResponse({ status: 201, description: '사용자 생성 성공' })
  async createUser(@Body() createUserDto: CreateUserDto): Promise<User> {
    return this.userService.createUser(createUserDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '사용자 정보 업데이트', description: '사용자 ID로 사용자 정보를 업데이트합니다' })
  @ApiParam({ name: 'id', description: '사용자 ID' })
  @ApiResponse({ status: 200, description: '사용자 정보 업데이트 성공' })
  @ApiResponse({ status: 404, description: '사용자를 찾을 수 없음' })
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto
  ): Promise<User> {
    return this.userService.updateUser(id, updateUserDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '사용자 삭제', description: '사용자 ID로 사용자를 삭제합니다' })
  @ApiParam({ name: 'id', description: '사용자 ID' })
  @ApiResponse({
    status: 200,
    description: '사용자 삭제 성공',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: '삭제 성공 메시지' }
      }
    }
  })
  @ApiResponse({ status: 404, description: '사용자를 찾을 수 없음' })
  async deleteUser(@Param('id') id: string): Promise<{ message: string }> {
    return this.userService.deleteUser(id);
  }

  @Get(':id')
  @ApiOperation({ summary: '사용자 조회', description: 'ID로 사용자를 조회합니다' })
  @ApiParam({ name: 'id', description: '사용자 ID' })
  @ApiResponse({ status: 200, description: '사용자 조회 성공' })
  @ApiResponse({ status: 404, description: '사용자를 찾을 수 없음' })
  async getUser(@Param('id') id: string): Promise<User> {
    return this.userService.findUserById(id);
  }

  @Get('nearby/:latitude/:longitude')
  @ApiOperation({ summary: '근처 사용자 조회', description: '특정 위치 근처의 사용자들을 조회합니다' })
  @ApiParam({ name: 'latitude', description: '위도', example: 37.5665 })
  @ApiParam({ name: 'longitude', description: '경도', example: 126.9780 })
  @ApiQuery({ name: 'radius', description: '검색 반경(km)', required: false, example: 10 })
  @ApiResponse({ status: 200, description: '근처 사용자 조회 성공' })
  async getNearbyUsers(
    @Param('latitude') latitude: number,
    @Param('longitude') longitude: number,
    @Query('radius') radius?: number
  ): Promise<User[]> {
    return this.userService.findUsersNearby(latitude, longitude, radius);
  }

  @Patch(':id/location')
  @ApiOperation({ summary: '사용자 위치 업데이트', description: '사용자의 위치 정보를 업데이트합니다' })
  @ApiParam({ name: 'id', description: '사용자 ID' })
  @ApiResponse({ status: 200, description: '위치 업데이트 성공' })
  async updateUserLocation(
    @Param('id') id: string,
    @Body() locationDto: { latitude: number; longitude: number }
  ): Promise<User> {
    return this.userService.updateUserLocation(id, locationDto.latitude, locationDto.longitude);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: '사용자 비활성화', description: '사용자를 비활성화합니다' })
  @ApiParam({ name: 'id', description: '사용자 ID' })
  @ApiResponse({ status: 200, description: '사용자 비활성화 성공' })
  async deactivateUser(@Param('id') id: string): Promise<User> {
    return this.userService.deactivateUser(id);
  }

}