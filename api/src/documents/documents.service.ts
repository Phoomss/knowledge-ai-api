import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { PrismaService } from '../database/prisma.service';
import { AiEngineProvider } from '../ai/providers/ai.engine.provider';
import { DocumentStatus } from '@prisma/client';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiEngine: AiEngineProvider,
    @Optional()
    @InjectQueue('document-ingestion')
    private readonly ingestionQueue?: Queue,
  ) {}

  async create(dto: CreateDocumentDto) {
    // 1. Verify that the knowledge base exists
    const kb = await this.prisma.knowledgeBase.findUnique({
      where: { id: dto.knowledge_base_id },
    });

    if (!kb) {
      throw new NotFoundException(
        `Knowledge Base with ID ${dto.knowledge_base_id} not found`,
      );
    }

    // 2. Persist Document record in PostgreSQL
    const document = await this.prisma.document.create({
      data: {
        knowledgeBaseId: dto.knowledge_base_id,
        title: dto.title,
        filename: dto.filename || dto.title,
        description: dto.description,
        content: dto.content,
        status: DocumentStatus.PROCESSING,
      },
    });

    // 3. Dispatch to BullMQ Queue (or fallback to async trigger)
    if (this.ingestionQueue) {
      await this.ingestionQueue.add(
        'ingest-text',
        {
          documentId: document.id,
          knowledgeBaseId: document.knowledgeBaseId!,
          filename: document.filename || document.title,
          content: document.content,
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true,
        },
      );
      this.logger.log(`Document ${document.id} enqueued to BullMQ document-ingestion`);
    } else {
      this.aiEngine
        .triggerIngest({
          document_id: document.id,
          knowledge_base_id: document.knowledgeBaseId!,
          filename: document.filename || document.title,
          content: document.content,
          background: true,
        })
        .catch((error) => {
          this.logger.error(
            `Failed to trigger ai-service ingestion for document ${document.id}: ${error.message}`,
          );
        });
    }

    return document;
  }

  async uploadPdf(
    knowledgeBaseId: string,
    file: Express.Multer.File,
    title?: string,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file uploaded or file buffer is empty');
    }

    if (!file.originalname.toLowerCase().endsWith('.pdf') && !file.mimetype.includes('pdf')) {
      throw new BadRequestException('Only PDF files are supported');
    }

    const kb = await this.prisma.knowledgeBase.findUnique({
      where: { id: knowledgeBaseId },
    });

    if (!kb) {
      throw new NotFoundException(
        `Knowledge Base with ID ${knowledgeBaseId} not found`,
      );
    }

    const docTitle = title || file.originalname;

    // 1. Create document record in database
    const document = await this.prisma.document.create({
      data: {
        knowledgeBaseId,
        title: docTitle,
        filename: file.originalname,
        content: `[Binary PDF File: ${file.originalname}]`,
        status: DocumentStatus.PROCESSING,
      },
    });

    // 2. Dispatch to BullMQ Queue (or fallback)
    if (this.ingestionQueue) {
      await this.ingestionQueue.add(
        'ingest-pdf',
        {
          documentId: document.id,
          knowledgeBaseId,
          filename: file.originalname,
          pdfBase64: file.buffer.toString('base64'),
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true,
        },
      );
      this.logger.log(`PDF Document ${document.id} enqueued to BullMQ document-ingestion`);
    } else {
      this.aiEngine
        .uploadPdf(
          document.id,
          knowledgeBaseId,
          file.originalname,
          file.buffer,
          true,
        )
        .catch((error) => {
          this.logger.error(
            `Failed to trigger PDF ingestion for doc ${document.id}: ${error.message}`,
          );
        });
    }

    return document;
  }

  async findAll(knowledgeBaseId?: string) {
    return this.prisma.document.findMany({
      where: knowledgeBaseId ? { knowledgeBaseId } : undefined,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: {
        knowledgeBase: true,
      },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID ${id} not found`);
    }

    return document;
  }

  async update(id: string, dto: UpdateDocumentDto) {
    await this.findOne(id);

    return this.prisma.document.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.document.delete({
      where: { id },
    });
  }
}
