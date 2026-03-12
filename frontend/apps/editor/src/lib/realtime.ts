import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from './api';

function getRealtimeBaseUrl(): string {
  return API_BASE_URL.replace(/\/api\/v1\/?$/, '');
}

export function createRealtimeSocket(accessToken: string): Socket {
  return io(getRealtimeBaseUrl(), {
    transports: ['websocket'],
    auth: { token: accessToken }
  });
}
