import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { DocumentIngestionProcessor } from './document-ingestion.processor';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    AiModule,
    BullModule.registerQueue({
      name: 'document-ingestion',
    }),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentIngestionProcessor],
  exports: [DocumentsService],
})
export class DocumentsModule {}
