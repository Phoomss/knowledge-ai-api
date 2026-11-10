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

  async sendMessage(dto: ChatQueryDto) {
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

  async getConversations(knowledgeBaseId?: string) {
    return this.prisma.conversation.findMany({
      where: knowledgeBaseId ? { knowledgeBaseId } : undefined,
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
