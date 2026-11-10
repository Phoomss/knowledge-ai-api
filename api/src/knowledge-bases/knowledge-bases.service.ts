import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';

@Injectable()
export class KnowledgeBasesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateKnowledgeBaseDto, userId?: string) {
    return this.prisma.knowledgeBase.create({
      data: {
        ...dto,
        userId: userId || undefined,
      },
    });
  }

  async findAll(userId?: string) {
    return this.prisma.knowledgeBase.findMany({
      where: userId ? { OR: [{ userId }, { userId: null }] } : undefined,
      include: {
        _count: {
          select: { documents: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const kb = await this.prisma.knowledgeBase.findUnique({
      where: { id },
      include: {
        documents: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!kb) {
      throw new NotFoundException(`Knowledge base with ID ${id} not found`);
    }

    return kb;
  }

  async update(id: string, dto: UpdateKnowledgeBaseDto) {
    await this.findOne(id);

    return this.prisma.knowledgeBase.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.knowledgeBase.delete({
      where: { id },
    });
  }
}
