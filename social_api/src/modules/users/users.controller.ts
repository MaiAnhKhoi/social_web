import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { User } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import type { AuthUser } from '@/shared/types/auth-user';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@User() user: AuthUser) {
    return this.usersService.getMe(user.userId);
  }

  @Patch('me')
  updateMe(@User() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.userId, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Patch('me/password')
  changePassword(@User() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(user.userId, dto);
  }

  @Delete('me')
  deactivate(@User() user: AuthUser) {
    return this.usersService.deactivate(user.userId);
  }

  @Public()
  @Get(':username')
  getByUsername(@Param('username') username: string) {
    return this.usersService.getByUsername(username);
  }
}
