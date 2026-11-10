import { Injectable, NotFoundException } from '@nestjs/common';
import { AiOrchestratorService } from '../ai/orchestrator/ai-orchestrator.service';
import { PrismaService } from '../database/prisma.service';
import { ChatQueryDto } from './dto/create-chat.dto';

@Injectable()
export class ChatService {
  constructor(
    private readonly orchestrator: AiOrchestratorService,
    private readonly prisma: PrismaService,
  ) {}

  async sendMessage(dto: ChatQueryDto, userId?: string) {
    let conversationId = dto.conversation_id;

    // 1. If conversation_id is provided, verify it exists or create it
    if (conversationId) {
      const existing = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
      });
      if (!existing) {
        const created = await this.prisma.conversation.create({
          data: {
            id: conversationId,
            userId: userId || undefined,
            knowledgeBaseId: dto.knowledge_base_id,
            title: dto.question.slice(0, 50),
          },
        });
        conversationId = created.id;
      }
    } else {
      // Create new conversation
      const created = await this.prisma.conversation.create({
        data: {
          userId: userId || undefined,
          knowledgeBaseId: dto.knowledge_base_id,
          title: dto.question.slice(0, 50),
        },
      });
      conversationId = created.id;
    }

    // 2. Call AI Orchestrator
    const result = await this.orchestrator.execute({
      question: dto.question,
      knowledge_base_id: dto.knowledge_base_id,
      conversation_id: conversationId,
      options: {
        top_k: 5,
        use_reranker: true,
      },
    });

    return {
      conversation_id: conversationId,
      ...result,
    };
  }

  async streamMessage(dto: ChatQueryDto, userId?: string) {
    let conversationId = dto.conversation_id;

    if (conversationId) {
      const existing = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
      });
      if (!existing) {
        const created = await this.prisma.conversation.create({
          data: {
            id: conversationId,
            userId: userId || undefined,
            knowledgeBaseId: dto.knowledge_base_id,
            title: dto.question.slice(0, 50),
          },
        });
        conversationId = created.id;
      }
    } else {
      const created = await this.prisma.conversation.create({
        data: {
          userId: userId || undefined,
          knowledgeBaseId: dto.knowledge_base_id,
          title: dto.question.slice(0, 50),
        },
      });
      conversationId = created.id;
    }

    const stream = await this.orchestrator.executeStream({
      question: dto.question,
      knowledge_base_id: dto.knowledge_base_id,
      conversation_id: conversationId,
      options: {
        top_k: 5,
        use_reranker: true,
      },
    });

    return {
      stream,
      conversationId,
    };
  }

  async getConversations(knowledgeBaseId?: string, userId?: string) {
    return this.prisma.conversation.findMany({
      where: {
        ...(knowledgeBaseId ? { knowledgeBaseId } : {}),
        ...(userId ? { OR: [{ userId }, { userId: null }] } : {}),
      },
      include: {
        _count: {
          select: { messages: true },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  async getConversationMessages(conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException(
        `Conversation with ID ${conversationId} not found`,
      );
    }

    return conversation;
  }

  async deleteConversation(conversationId: string) {
    await this.getConversationMessages(conversationId);

    return this.prisma.conversation.delete({
      where: { id: conversationId },
    });
  }
}
