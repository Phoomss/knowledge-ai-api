import type { Response } from 'express';
import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatQueryDto } from './dto/create-chat.dto';
import { OptionalJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, UserPayload } from '../auth/decorators/current-user.decorator';

@Controller('chat')
@UseGuards(OptionalJwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('query')
  async query(@Body() dto: ChatQueryDto, @CurrentUser() user?: UserPayload) {
    return this.chatService.sendMessage(dto, user?.id);
  }

  @Post('stream')
  async stream(
    @Body() dto: ChatQueryDto,
    @Res() res: Response,
    @CurrentUser() user?: UserPayload,
  ) {
    const { stream, conversationId } = await this.chatService.streamMessage(
      dto,
      user?.id,
    );

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('X-Conversation-Id', conversationId);

    stream.pipe(res);
  }

  @Get('conversations')
  async getConversations(
    @Query('knowledge_base_id') knowledgeBaseId?: string,
    @CurrentUser() user?: UserPayload,
  ) {
    return this.chatService.getConversations(knowledgeBaseId, user?.id);
  }

  @Get('conversations/:id')
  async getConversationMessages(@Param('id') id: string) {
    return this.chatService.getConversationMessages(id);
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConversation(@Param('id') id: string) {
    return this.chatService.deleteConversation(id);
  }
}
