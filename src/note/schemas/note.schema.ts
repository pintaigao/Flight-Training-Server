import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type NoteContentFormat = 'LEXICAL_V1';

@Entity({ name: 'notes' })
@Index(['userId', 'categoryId', 'updatedAt'])
@Index(['userId', 'createdAt'])
export class Note {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  userId: string;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  categoryId: string | null;

  @Column({ type: 'varchar', length: 280 })
  title: string;

  // Richtext payload (Lexical editorState JSON string).
  @Column({ type: 'longtext' })
  content: string;

  @Column({ type: 'varchar', length: 32, default: 'LEXICAL_V1' })
  contentFormat: NoteContentFormat;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
