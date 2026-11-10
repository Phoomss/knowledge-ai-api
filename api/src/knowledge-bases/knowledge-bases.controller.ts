import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { KnowledgeBasesService } from './knowledge-bases.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';
import { OptionalJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, UserPayload } from '../auth/decorators/current-user.decorator';

@Controller('knowledge-bases')
@UseGuards(OptionalJwtAuthGuard)
export class KnowledgeBasesController {
  constructor(private readonly kbService: KnowledgeBasesService) {}

  @Post()
  create(
    @Body() dto: CreateKnowledgeBaseDto,
    @CurrentUser() user?: UserPayload,
  ) {
    return this.kbService.create(dto, user?.id);
  }

  @Get()
  findAll(@CurrentUser() user?: UserPayload) {
    return this.kbService.findAll(user?.id);
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
