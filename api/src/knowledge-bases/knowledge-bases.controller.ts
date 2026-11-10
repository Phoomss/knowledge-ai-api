import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { KnowledgeBasesService } from './knowledge-bases.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';

@Controller('knowledge-bases')
export class KnowledgeBasesController {
  constructor(private readonly kbService: KnowledgeBasesService) {}

  @Post()
  create(@Body() dto: CreateKnowledgeBaseDto) {
    return this.kbService.create(dto);
  }

  @Get()
  findAll() {
    return this.kbService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.kbService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateKnowledgeBaseDto) {
    return this.kbService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.kbService.remove(id);
  }
}
