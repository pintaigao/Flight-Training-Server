import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type TrackSource = 'FORE_FLIGHT' | 'FLIGHTAWARE';

@Entity({ name: 'flight_tracks' })
@Index(['flightId', 'source'], { unique: true })
export class FlightTrack {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 128 })
  flightId: string;

  @Column({ type: 'varchar', length: 16 })
  source: TrackSource;

  @Column({ type: 'json' })
  feature: any;

  @Column({ type: 'json', nullable: true })
  meta: any | null;

  @Column({ type: 'longtext', nullable: true, select: false })
  rawText: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  rawFormat: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  rawFilename: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  rawMime: string | null;

  @Column({ type: 'longtext', nullable: true, select: false })
  samplesText: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
