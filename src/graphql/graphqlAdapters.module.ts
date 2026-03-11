import { Module } from '@nestjs/common';
import { FlightModule } from '../flight/flight.module';
import { FlightService } from '../flight/flight.service';
import { UserModule } from '../user/user.module';
import { UserService } from '../user/user.service';
import { FLIGHT_QUERY, USER_QUERY, type FlightQuery, type UserQuery } from './graphql.tokens';

@Module({
  imports: [UserModule, FlightModule],
  providers: [
    { provide: USER_QUERY, useExisting: UserService } satisfies { provide: string; useExisting: any },
    { provide: FLIGHT_QUERY, useExisting: FlightService } satisfies { provide: string; useExisting: any },
  ],
  exports: [USER_QUERY, FLIGHT_QUERY],
})
export class GraphqlBffAdaptersModule {}

