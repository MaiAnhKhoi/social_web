import { ConflictException, Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma, User } from '@/generated/prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}
  async create(createUserDto: CreateUserDto): Promise<User> {
    const { provider, providerUserId, ...data } = createUserDto;
    try {
      return await this.prisma.user.create({
        data: {
          ...data,
          providers:
            provider && providerUserId
              ? { create: { provider, providerUserId } }
              : undefined,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const target = Array.isArray(e.meta?.target)
          ? (e.meta.target as string[]).join(', ')
          : 'Thông tin';
        throw new ConflictException(`${target} đã tồn tại`);
      }
      throw e;
    }
  }

  findAll() {
    return `This action returns all users`;
  }

  async findOneByUserEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    return user;
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
