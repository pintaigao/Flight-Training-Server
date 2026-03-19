import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { NoteCategory } from './schemas/noteCategory.schema';
import { Note, type NoteContentFormat } from './schemas/note.schema';

@Injectable()
export class NoteService {
  constructor(
    @InjectRepository(NoteCategory)
    private readonly categoryRepo: Repository<NoteCategory>,
    @InjectRepository(Note)
    private readonly noteRepo: Repository<Note>,
  ) {}

  async listCategories(userId: string) {
    return this.categoryRepo.find({
      where: { userId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async createCategory(
    userId: string,
    payload: { name: string; parentId: string | null; sortOrder: number },
  ) {
    if (payload.parentId) {
      const parent = await this.categoryRepo.findOne({
        where: { id: payload.parentId, userId },
      });
      if (!parent) return null;
    }

    const entity = this.categoryRepo.create({
      userId,
      name: payload.name,
      parentId: payload.parentId,
      sortOrder: payload.sortOrder,
    });
    return this.categoryRepo.save(entity);
  }

  async listNotes(userId: string, opts: { categoryId?: string | null }) {
    const where: any = { userId };
    if (opts.categoryId === null) where.categoryId = IsNull();
    else if (opts.categoryId) where.categoryId = opts.categoryId;
    return this.noteRepo.find({
      where,
      order: { updatedAt: 'DESC' },
    });
  }

  private async findOwnedNote(userId: string, id: string) {
    return this.noteRepo.findOne({ where: { id, userId } });
  }

  async createNote(
    userId: string,
    payload: {
      categoryId: string | null;
      title: string;
      content: string;
      contentFormat: NoteContentFormat;
    },
  ) {
    if (payload.categoryId) {
      const category = await this.categoryRepo.findOne({
        where: { id: payload.categoryId, userId },
      });
      if (!category) return null;
    }

    const entity = this.noteRepo.create({
      userId,
      categoryId: payload.categoryId,
      title: payload.title,
      content: payload.content,
      contentFormat: payload.contentFormat,
    });
    return this.noteRepo.save(entity);
  }

  async patchNote(
    userId: string,
    id: string,
    patch: {
      categoryId?: string | null;
      title?: string;
      content?: string;
      contentFormat?: NoteContentFormat;
    },
  ) {
    const note = await this.findOwnedNote(userId, id);
    if (!note) return null;

    if (patch.categoryId !== undefined && patch.categoryId !== note.categoryId) {
      if (patch.categoryId) {
        const category = await this.categoryRepo.findOne({
          where: { id: patch.categoryId, userId },
        });
        if (!category) return null;
      }
      note.categoryId = patch.categoryId ?? null;
    }
    if (typeof patch.title === 'string') note.title = patch.title;
    if (typeof patch.content === 'string') note.content = patch.content;
    if (patch.contentFormat) note.contentFormat = patch.contentFormat;

    return this.noteRepo.save(note);
  }

  async deleteNote(userId: string, id: string) {
    const note = await this.findOwnedNote(userId, id);
    if (!note) return null;

    await this.noteRepo.delete({ id: note.id, userId });
    return {
      id: note.id,
      categoryId: note.categoryId ?? null,
    };
  }

  async deleteCategoryTree(userId: string, id: string) {
    const root = await this.categoryRepo.findOne({ where: { id, userId } });
    if (!root) return null;

    const allCategories = await this.categoryRepo.find({ where: { userId } });
    const childrenByParent = new Map<string | null, string[]>();

    for (const category of allCategories) {
      const key = category.parentId ?? null;
      const siblings = childrenByParent.get(key) ?? [];
      siblings.push(category.id);
      childrenByParent.set(key, siblings);
    }

    const deletedCategoryIds: string[] = [];
    const stack = [root.id];
    const seen = new Set<string>();

    while (stack.length) {
      const currentId = stack.pop()!;
      if (seen.has(currentId)) continue;
      seen.add(currentId);
      deletedCategoryIds.push(currentId);

      const children = childrenByParent.get(currentId) ?? [];
      for (const childId of children) stack.push(childId);
    }

    return this.categoryRepo.manager.transaction(async (manager) => {
      const txCategoryRepo = manager.getRepository(NoteCategory);
      const txNoteRepo = manager.getRepository(Note);
      const notesToDelete = await txNoteRepo.find({
        where: {
          userId,
          categoryId: In(deletedCategoryIds),
        },
      });
      const deletedNoteIds = notesToDelete.map((note) => note.id);

      if (deletedNoteIds.length) {
        await txNoteRepo.delete({
          userId,
          id: In(deletedNoteIds),
        });
      }

      await txCategoryRepo.delete({
        userId,
        id: In(deletedCategoryIds),
      });

      return {
        deletedCategoryIds,
        deletedNoteIds,
        parentId: root.parentId ?? null,
      };
    });
  }
}
