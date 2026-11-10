import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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

    // 3. Trigger Ingestion in ai-service asynchronously
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
