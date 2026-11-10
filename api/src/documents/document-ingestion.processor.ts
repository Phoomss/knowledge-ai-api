import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AiEngineProvider } from '../ai/providers/ai.engine.provider';
import { PrismaService } from '../database/prisma.service';

export interface IngestionJobData {
  documentId: string;
  knowledgeBaseId: string;
  filename: string;
  content?: string;
  pdfBase64?: string;
}

@Processor('document-ingestion')
export class DocumentIngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentIngestionProcessor.name);

  constructor(
    private readonly aiEngine: AiEngineProvider,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<IngestionJobData>): Promise<any> {
    const { documentId, knowledgeBaseId, filename, content, pdfBase64 } =
      job.data;
    this.logger.log(
      `Processing ingestion job ${job.id} for document ${documentId} (${filename})`,
    );

    try {
      if (pdfBase64) {
        const fileBuffer = Buffer.from(pdfBase64, 'base64');
        await this.aiEngine.uploadPdf(
          documentId,
          knowledgeBaseId,
          filename,
          fileBuffer,
          false,
        );
      } else if (content) {
        await this.aiEngine.triggerIngest({
          document_id: documentId,
          knowledge_base_id: knowledgeBaseId,
          filename,
          content,
          background: false,
        });
      }

      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'COMPLETED' },
      });

      this.logger.log(
        `Ingestion job ${job.id} completed successfully for document ${documentId}`,
      );
      return { success: true, documentId };
    } catch (error: any) {
      this.logger.error(
        `Ingestion job ${job.id} attempt ${job.attemptsMade + 1} failed: ${error.message}`,
      );

      const maxAttempts = job.opts.attempts || 3;
      if (job.attemptsMade >= maxAttempts - 1) {
        await this.prisma.document.update({
          where: { id: documentId },
          data: { status: 'FAILED' },
        });
      }

      throw error;
    }
  }
}
