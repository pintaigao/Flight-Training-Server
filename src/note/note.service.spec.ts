import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { NoteCategory } from './schemas/noteCategory.schema';
import { Note } from './schemas/note.schema';
import { NoteService } from './note.service';

describe('NoteService', () => {
  let categoryRepo: jest.Mocked<Repository<NoteCategory>>;
  let noteRepo: jest.Mocked<Repository<Note>>;
  let svc: NoteService;
  let transaction: jest.Mock;
  let txCategoryRepo: { delete: jest.Mock };
  let txNoteRepo: { find: jest.Mock; delete: jest.Mock };

  beforeEach(async () => {
    txCategoryRepo = { delete: jest.fn() };
    txNoteRepo = { find: jest.fn(), delete: jest.fn() };
    transaction = jest.fn(async (cb: any) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === NoteCategory) return txCategoryRepo;
          if (entity === Note) return txNoteRepo;
          throw new Error('Unexpected repository');
        },
      }),
    );

    categoryRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      manager: { transaction },
    } as any;
    noteRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    } as any;

    const moduleRef = await Test.createTestingModule({
      providers: [
        NoteService,
        { provide: getRepositoryToken(NoteCategory), useValue: categoryRepo },
        { provide: getRepositoryToken(Note), useValue: noteRepo },
      ],
    }).compile();

    svc = moduleRef.get(NoteService);
  });

  it('returns null when creating a category under a missing parent', async () => {
    categoryRepo.findOne.mockResolvedValue(null);

    const res = await svc.createCategory('u1', {
      name: 'Child',
      parentId: 'missing-parent',
      sortOrder: 0,
    });
    expect(res).toBeNull();
    expect(categoryRepo.save).not.toHaveBeenCalled();
  });

  it('creates a category with userId', async () => {
    categoryRepo.findOne.mockResolvedValue({ id: 'p1', userId: 'u1' } as any);
    categoryRepo.create.mockImplementation((x: any) => x);
    categoryRepo.save.mockImplementation(async (x: any) => ({ id: 'c1', ...x }));

    const res = await svc.createCategory('u1', {
      name: 'My Notebook',
      parentId: 'p1',
      sortOrder: 2,
    });
    expect(res?.userId).toBe('u1');
    expect(res?.parentId).toBe('p1');
    expect(res?.name).toBe('My Notebook');
  });

  it('returns null when creating a note for a missing category', async () => {
    categoryRepo.findOne.mockResolvedValue(null);

    const res = await svc.createNote('u1', {
      categoryId: 'c1',
      title: 'T',
      content: '{"root":{}}',
      contentFormat: 'LEXICAL_V1',
    });
    expect(res).toBeNull();
    expect(noteRepo.save).not.toHaveBeenCalled();
  });

  it('creates a note without a category when categoryId is null', async () => {
    noteRepo.create.mockImplementation((x: any) => x);
    noteRepo.save.mockImplementation(async (x: any) => ({ id: 'n1', ...x }));

    const res = await svc.createNote('u1', {
      categoryId: null,
      title: 'Quick note',
      content: '{"root":{}}',
      contentFormat: 'LEXICAL_V1',
    });
    expect(res?.userId).toBe('u1');
    expect(res?.categoryId).toBeNull();
    expect(categoryRepo.findOne).not.toHaveBeenCalled();
  });

  it('prevents patching a note not owned by the user', async () => {
    noteRepo.findOne.mockResolvedValue(null);

    const res = await svc.patchNote('u1', 'n1', { title: 'New' });
    expect(res).toBeNull();
    expect(noteRepo.save).not.toHaveBeenCalled();
  });

  it('rejects moving a note to a category not owned by the user', async () => {
    noteRepo.findOne.mockResolvedValue({
      id: 'n1',
      userId: 'u1',
      categoryId: 'c1',
      title: 'Old',
      content: '{}',
      contentFormat: 'LEXICAL_V1',
    } as any);
    categoryRepo.findOne.mockResolvedValue(null);

    const res = await svc.patchNote('u1', 'n1', { categoryId: 'c2' });
    expect(res).toBeNull();
    expect(noteRepo.save).not.toHaveBeenCalled();
  });

  it('updates note fields when owned by the user', async () => {
    noteRepo.findOne.mockResolvedValue({
      id: 'n1',
      userId: 'u1',
      categoryId: 'c1',
      title: 'Old',
      content: '{}',
      contentFormat: 'LEXICAL_V1',
    } as any);
    noteRepo.save.mockImplementation(async (x: any) => x);

    const res = await svc.patchNote('u1', 'n1', {
      title: 'New title',
      content: '{"root":{}}',
    });
    expect(res?.title).toBe('New title');
    expect(res?.content).toBe('{"root":{}}');
  });

  it('deletes an owned note', async () => {
    noteRepo.findOne.mockResolvedValue({
      id: 'n1',
      userId: 'u1',
      categoryId: 'c1',
      title: 'T',
      content: '{}',
      contentFormat: 'LEXICAL_V1',
    } as any);
    noteRepo.delete.mockResolvedValue({ affected: 1 } as any);

    const res = await (svc as any).deleteNote('u1', 'n1');

    expect(res).toEqual({ id: 'n1', categoryId: 'c1' });
    expect(noteRepo.delete).toHaveBeenCalledWith({ id: 'n1', userId: 'u1' });
  });

  it('returns null when deleting a missing note', async () => {
    noteRepo.findOne.mockResolvedValue(null);

    const res = await (svc as any).deleteNote('u1', 'missing');

    expect(res).toBeNull();
    expect(noteRepo.delete).not.toHaveBeenCalled();
  });

  it('recursively deletes a category tree and its notes', async () => {
    categoryRepo.findOne.mockResolvedValue({
      id: 'root',
      userId: 'u1',
      parentId: 'parent',
      name: 'Root',
    } as any);
    categoryRepo.find.mockResolvedValue([
      { id: 'root', userId: 'u1', parentId: 'parent' },
      { id: 'child', userId: 'u1', parentId: 'root' },
      { id: 'grandchild', userId: 'u1', parentId: 'child' },
      { id: 'sibling', userId: 'u1', parentId: 'parent' },
    ] as any);
    txNoteRepo.find.mockResolvedValue([
      { id: 'n1', categoryId: 'root' },
      { id: 'n2', categoryId: 'grandchild' },
    ]);
    txNoteRepo.delete.mockResolvedValue({ affected: 2 } as any);
    txCategoryRepo.delete.mockResolvedValue({ affected: 3 } as any);

    const res = await (svc as any).deleteCategoryTree('u1', 'root');

    expect(res).toEqual({
      deletedCategoryIds: ['root', 'child', 'grandchild'],
      deletedNoteIds: ['n1', 'n2'],
      parentId: 'parent',
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(txNoteRepo.delete).toHaveBeenCalled();
    expect(txCategoryRepo.delete).toHaveBeenCalled();
  });
});
