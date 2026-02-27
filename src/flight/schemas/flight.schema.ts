import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Flight {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  flightNumber: string;

  @Column({ nullable: true })
  comment: string;
}
