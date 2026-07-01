import { PrismaService } from '@/database/prisma/prisma.service';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule/dist/decorators/cron.decorator';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 0 * * *')
  async deleteExpiredRefreshTokens() {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    this.logger.log(`Deleted ${result.count} expired refresh token(s).`);
  }
}
