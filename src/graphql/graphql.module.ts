import { type DynamicModule, type Provider } from '@nestjs/common';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import type { Request, Response } from 'express';
import { tmpdir } from 'os';
import { join } from 'path';
import { AuthGuard } from '../auth/auth.guard';
import { JSONScalar } from './scalars/json.scalar';
import { FlightsResolver } from './resolvers/flights.resolver';
import { ProfileResolver } from './resolvers/profile.resolver';
import { GraphqlBffAdaptersModule } from './graphqlAdapters.module';

export class GraphqlBffModule {
  static forRoot(opts?: { withAdapters?: boolean; providers?: Provider[] }): DynamicModule {
    const withAdapters = opts?.withAdapters ?? true;
    return {
      module: GraphqlBffModule,
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          path: '/graphql',
          useGlobalPrefix: true,
          playground: process.env.NODE_ENV !== 'production',
          autoSchemaFile: join(tmpdir(), 'flight-training-server.schema.gql'),
          context: ({ req, res }: { req: Request; res: Response }) => ({ req, res }),
        }),
        ...(withAdapters ? [GraphqlBffAdaptersModule] : []),
      ],
      providers: [JSONScalar, ProfileResolver, FlightsResolver, AuthGuard, ...(opts?.providers ?? [])],
    };
  }
}
