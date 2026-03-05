import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

export type FlightComments = {
  well: string;
  improve: string;
  notes: string;
};

@Entity({ name: 'flights' })
export class Flight {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 16 })
  dateISO: string;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  startTimeISO: string | null;

  @Index()
  @Column({ type: 'varchar', length: 32, nullable: true })
  endTimeISO: string | null;

  @Index()
  @Column({ type: 'varchar', length: 16 })
  aircraftTail: string;

  @Column({ type: 'varchar', length: 8 })
  from: string;

  @Column({ type: 'varchar', length: 8 })
  to: string;

  @Column({ type: 'int' })
  durationMin: number;

  @Column({ type: 'varchar', length: 280, nullable: true })
  description: string | null;

  @Column({ type: 'json' })
  tags: string[];

  @Column({ type: 'json' })
  comments: FlightComments;
}
