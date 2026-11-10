import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';

@Injectable()
export class KnowledgeBasesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateKnowledgeBaseDto) {
    return this.prisma.knowledgeBase.create({
      data: dto,
    });
  }

  async findAll() {
    return this.prisma.knowledgeBase.findMany({
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
