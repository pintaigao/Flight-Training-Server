import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { NoteController } from './note.controller';
import { NoteService } from './note.service';
import { NoteCategory } from './schemas/noteCategory.schema';
import { Note } from './schemas/note.schema';

@Module({
  imports: [TypeOrmModule.forFeature([NoteCategory, Note]), AuthModule],
  providers: [NoteService],
  controllers: [NoteController],
  exports: [NoteService],
})
export class NoteModule {}

