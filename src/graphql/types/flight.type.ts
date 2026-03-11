import { Field, Int, ObjectType } from '@nestjs/graphql';
import { JSONScalar } from '../scalars/json.scalar';

@ObjectType('FlightListItem')
export class FlightListItemType {
  @Field()
  id: string;

  @Field()
  dateISO: string;

  @Field(() => String, { nullable: true })
  startTimeISO: string | null;

  @Field(() => String, { nullable: true })
  endTimeISO: string | null;

  @Field()
  aircraftTail: string;

  @Field()
  from: string;

  @Field()
  to: string;

  @Field(() => Int)
  durationMin: number;

  @Field(() => String, { nullable: true })
  description: string | null;

  @Field(() => [String])
  tags: string[];

  @Field()
  comments: string;

  @Field(() => JSONScalar, { nullable: true })
  track: any | null;

  @Field(() => String, { nullable: true })
  trackSource: string | null;

  @Field(() => JSONScalar, { nullable: true })
  trackMeta: any | null;
}

