import { Controller, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatQueryDto } from './dto/create-chat.dto';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('query')
  async query(@Body() dto: ChatQueryDto) {
    return this.chatService.sendMessage(dto);
  }
}
