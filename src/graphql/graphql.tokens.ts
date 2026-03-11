export const USER_QUERY = 'GRAPHQL_BFF_USER_QUERY';
export const FLIGHT_QUERY = 'GRAPHQL_BFF_FLIGHT_QUERY';

export type UserQuery = {
  findById(id: string): Promise<{ id: string; email: string } | null>;
};

export type FlightQuery = {
  findAllWithBestTrack(userId: string): Promise<any[]>;
};

