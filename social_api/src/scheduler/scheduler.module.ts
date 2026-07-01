import { Module } from '@nestjs/common';
import { PrismaModule } from '@/database/prisma/prisma.module';
import { SchedulerService } from './scheduler.service';

@Module({})
export class SchedulerModule {
  imports = [PrismaModule];
  Providers = [SchedulerService];
}
