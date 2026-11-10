import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatQueryDto } from './dto/create-chat.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('query')
  async query(@Body() dto: ChatQueryDto) {
    return this.chatService.sendMessage(dto);
  }

  @Get('conversations')
  async getConversations(@Query('knowledge_base_id') knowledgeBaseId?: string) {
    return this.chatService.getConversations(knowledgeBaseId);
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
