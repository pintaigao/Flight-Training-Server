export class CreateNoteCategoryDto {
  name: string;
  parentId?: string | null;
  sortOrder?: number;
}

export class CreateNoteDto {
  categoryId?: string | null;
  title: string;
  content: string;
  contentFormat?: string;
}

export class PatchNoteDto {
  categoryId?: string | null;
  title?: string;
  content?: string;
  contentFormat?: string;
}
