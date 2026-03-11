import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('Profile')
export class ProfileType {
  @Field(() => ID)
  id: string;

  @Field()
  email: string;
}

