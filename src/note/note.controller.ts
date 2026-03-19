import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import {
  CreateNoteCategoryDto,
  CreateNoteDto,
  PatchNoteDto,
} from './dto/note.dto';
import { NoteService } from './note.service';
import type { NoteContentFormat } from './schemas/note.schema';

function normalizeUuid(value: unknown) {
  const s = String(value ?? '').trim();
  return s || null;
}

@Controller('note')
@UseGuards(AuthGuard)
export class NoteController {
  constructor(private readonly noteService: NoteService) {}

  @Get('categories')
  listCategories(@Req() req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    return this.noteService.listCategories(userId);
  }

  @Delete('categories/:id')
  async deleteCategory(@Req() req: Request, @Param('id') id: string) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    const categoryId = normalizeUuid(id);
    if (!categoryId) throw new BadRequestException('id is required');

    const deleted = await this.noteService.deleteCategoryTree(userId, categoryId);
    if (!deleted) throw new NotFoundException('Category not found');
    return deleted;
  }

  @Post('categories')
  async createCategory(@Req() req: Request, @Body() dto: CreateNoteCategoryDto) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    const name = String(dto?.name ?? '').trim();
    if (!name) throw new BadRequestException('name is required');
    if (name.length > 128) throw new BadRequestException('name is too long');
    const parentId = normalizeUuid(dto?.parentId);
    const sortOrder =
      typeof dto?.sortOrder === 'number' && Number.isFinite(dto.sortOrder)
        ? Math.trunc(dto.sortOrder)
        : 0;
    const created = await this.noteService.createCategory(userId, {
      name,
      parentId,
      sortOrder,
    });
    if (!created) throw new NotFoundException('Parent category not found');
    return created;
  }

  @Get()
  listNotes(
    @Req() req: Request,
    @Query('categoryId') categoryId?: string,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    const raw = String(categoryId ?? '').trim();
    const lowered = raw.toLowerCase();
    if (lowered === 'null' || lowered === 'none' || lowered === 'uncategorized') {
      return this.noteService.listNotes(userId, { categoryId: null });
    }
    const cat = normalizeUuid(raw);
    return this.noteService.listNotes(userId, { categoryId: cat ?? undefined });
  }

  @Post()
  async createNote(@Req() req: Request, @Body() dto: CreateNoteDto) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();

    const categoryId = normalizeUuid(dto?.categoryId);

    const title = String(dto?.title ?? '').trim();
    if (!title) throw new BadRequestException('title is required');
    if (title.length > 280) throw new BadRequestException('title is too long');

    let content = dto?.content as any;
    if (content && typeof content === 'object') {
      try {
        content = JSON.stringify(content);
      } catch {
        content = '';
      }
    }
    content = String(content ?? '');
    if (!content) throw new BadRequestException('content is required');

    const fmt = String(dto?.contentFormat ?? 'LEXICAL_V1').trim();
    const contentFormat = (fmt || 'LEXICAL_V1') as NoteContentFormat;

    const created = await this.noteService.createNote(userId, {
      categoryId,
      title,
      content,
      contentFormat,
    });
    if (!created && categoryId) throw new NotFoundException('Category not found');
    if (!created) throw new NotFoundException('Failed to create note');
    return created;
  }

  @Patch(':id')
  async patchNote(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: PatchNoteDto,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    const noteId = normalizeUuid(id);
    if (!noteId) throw new BadRequestException('id is required');

    const patch: {
      categoryId?: string | null;
      title?: string;
      content?: string;
      contentFormat?: NoteContentFormat;
    } = {};

    if (dto?.categoryId !== undefined) {
      if (dto.categoryId === null) {
        patch.categoryId = null;
      } else {
        const categoryId = normalizeUuid(dto.categoryId);
        if (!categoryId) throw new BadRequestException('categoryId is invalid');
        patch.categoryId = categoryId;
      }
    }
    if (dto?.title !== undefined) {
      const title = String(dto.title ?? '').trim();
      if (!title) throw new BadRequestException('title is invalid');
      if (title.length > 280) throw new BadRequestException('title is too long');
      patch.title = title;
    }
    if (dto?.content !== undefined) {
      let content = dto.content as any;
      if (content && typeof content === 'object') {
        try {
          content = JSON.stringify(content);
        } catch {
          content = '';
        }
      }
      content = String(content ?? '');
      if (!content) throw new BadRequestException('content is invalid');
      patch.content = content;
    }
    if (dto?.contentFormat !== undefined) {
      const fmt = String(dto.contentFormat ?? '').trim();
      if (!fmt) throw new BadRequestException('contentFormat is invalid');
      patch.contentFormat = fmt as NoteContentFormat;
    }

    const saved = await this.noteService.patchNote(userId, noteId, patch);
    if (!saved) throw new NotFoundException('Note not found');
    return saved;
  }

  @Delete(':id')
  async deleteNote(@Req() req: Request, @Param('id') id: string) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException();
    const noteId = normalizeUuid(id);
    if (!noteId) throw new BadRequestException('id is required');

    const deleted = await this.noteService.deleteNote(userId, noteId);
    if (!deleted) throw new NotFoundException('Note not found');
    return deleted;
  }
}
