import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlightModule } from './flight/flight.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { GraphqlBffModule } from './graphql/graphql.module';
import { LiveAircraftModule } from './liveAircraft/liveAircraft.module';
import { NoteModule } from './note/note.module';
import { TrackScheduleModule } from './trackSchedule/trackSchedule.module';
import { buildDatabaseConfig } from './config/runtime';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => buildDatabaseConfig(),
    }),
    AuthModule,
    FlightModule,
    TrackScheduleModule,
    UserModule,
    NoteModule,
    LiveAircraftModule,
    GraphqlBffModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
