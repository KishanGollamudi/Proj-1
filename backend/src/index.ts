import cors from 'cors';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';

const app = express();
const port = Number(process.env.BACKEND_PORT ?? 4000);
const frontendOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:3000';

app.use(cors({ origin: frontendOrigin, credentials: true }));
app.use(express.json());

type UserRole = 'customer' | 'creator' | 'editor' | 'admin';
type BookingStatus = 'REQUESTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELED';

interface Creator {
  id: string;
  fullName: string;
  avatarUrl: string;
  creatorProfile: {
    city: string;
    country: string;
    hourlyRate: string;
    ratingAverage: string;
    bio: string;
    portfolioUrl?: string;
  };
}

interface Booking {
  id: string;
  title: string;
  status: BookingStatus;
  eventDate: string;
  location: string;
  creatorId: string;
  customerId: string;
  cancellationReason?: string;
  mediaAssets: Array<{
    id: string;
    fileName: string;
    originalUrl: string;
    mimeType: string;
    status: string;
  }>;
  reviews: Array<{
    id: string;
    rating: number;
    comment: string;
    createdAt: string;
    reviewer: { fullName: string };
  }>;
}

interface EditorTask {
  id: string;
  bookingId: string;
  statusLabel: string;
  stylePreference?: string;
  description?: string;
  revisionNotes?: string;
  submittedMediaUrls: string[];
  estimatedPrice: string;
  editor?: { fullName?: string | null; email?: string | null } | null;
  suggestedEditors: Array<{
    id: string;
    fullName: string;
    hourlyRate: number;
    score: number;
    reasons: string[];
  }>;
}

const creators: Creator[] = [
  {
    id: 'creator-1',
    fullName: 'Ava Reynolds',
    avatarUrl: 'https://placehold.co/240x240?text=Ava',
    creatorProfile: {
      city: 'Mumbai',
      country: 'India',
      hourlyRate: '150',
      ratingAverage: '4.9',
      bio: 'Wedding and portrait photographer with a documentary style.'
    }
  },
  {
    id: 'creator-2',
    fullName: 'Noah Bennett',
    avatarUrl: 'https://placehold.co/240x240?text=Noah',
    creatorProfile: {
      city: 'Delhi',
      country: 'India',
      hourlyRate: '120',
      ratingAverage: '4.8',
      bio: 'Event videographer focused on cinematic edits and live coverage.'
    }
  },
  {
    id: 'creator-3',
    fullName: 'Mia Torres',
    avatarUrl: 'https://placehold.co/240x240?text=Mia',
    creatorProfile: {
      city: 'Bengaluru',
      country: 'India',
      hourlyRate: '175',
      ratingAverage: '5.0',
      bio: 'Luxury event photography with polished retouching and fast delivery.'
    }
  }
];

const subscriptions = {
  plans: [
    { id: 'basic', name: 'Basic', plan: 'BASIC', priceMonthly: '49', includedHours: '2', bonusHours: '0' },
    { id: 'pro', name: 'Pro', plan: 'PRO', priceMonthly: '99', includedHours: '5', bonusHours: '1' },
    { id: 'unlimited', name: 'Unlimited', plan: 'UNLIMITED', priceMonthly: '199', includedHours: '12', bonusHours: '4' }
  ],
  current: {
    plan: 'PRO',
    status: 'ACTIVE',
    includedHours: '5',
    usedHours: '1.5',
    bonusHours: '1'
  }
};

const bookings: Booking[] = [
  {
    id: 'booking-1',
    title: 'Engagement Shoot',
    status: 'CONFIRMED',
    eventDate: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(),
    location: 'Bandra, Mumbai',
    creatorId: 'creator-1',
    customerId: 'demo-customer',
    mediaAssets: [
      {
        id: 'media-1',
        fileName: 'engagement-cover.jpg',
        originalUrl: 'https://placehold.co/640x420?text=Engagement+1',
        mimeType: 'image/jpeg',
        status: 'READY'
      },
      {
        id: 'media-2',
        fileName: 'engagement-closeup.jpg',
        originalUrl: 'https://placehold.co/640x420?text=Engagement+2',
        mimeType: 'image/jpeg',
        status: 'READY'
      }
    ],
    reviews: []
  },
  {
    id: 'booking-2',
    title: 'Birthday Event Coverage',
    status: 'COMPLETED',
    eventDate: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    location: 'Indiranagar, Bengaluru',
    creatorId: 'creator-3',
    customerId: 'demo-customer',
    mediaAssets: [
      {
        id: 'media-3',
        fileName: 'birthday-stage.jpg',
        originalUrl: 'https://placehold.co/640x420?text=Birthday+1',
        mimeType: 'image/jpeg',
        status: 'READY'
      }
    ],
    reviews: [
      {
        id: 'review-1',
        rating: 5,
        comment: 'Excellent communication and delivery.',
        createdAt: new Date().toISOString(),
        reviewer: { fullName: 'Demo Customer' }
      }
    ]
  }
];

const editorTasks: EditorTask[] = [
  {
    id: 'task-1',
    bookingId: 'booking-2',
    statusLabel: 'submitted',
    stylePreference: 'Cinematic',
    description: 'Warm tones and subtle retouching.',
    submittedMediaUrls: ['https://placehold.co/640x420?text=Edited+Asset'],
    estimatedPrice: '80',
    editor: { fullName: 'Liam Carter', email: 'liam@example.com' },
    suggestedEditors: [
      {
        id: 'editor-1',
        fullName: 'Liam Carter',
        hourlyRate: 35,
        score: 0.94,
        reasons: ['Strong turnaround history', 'Matches cinematic style']
      }
    ]
  }
];

const chatRooms = new Map<string, Array<{ id: string; content: string; senderId: string }>>();
const taskChats = new Map<string, Array<{ id: string; taskId: string; message: string; senderRole: string; createdAt: string }>>();

function getAccessToken(authHeader?: string): string | undefined {
  if (!authHeader?.startsWith('Bearer ')) {
    return undefined;
  }
  return authHeader.slice('Bearer '.length);
}

function getRoleFromToken(token?: string): UserRole {
  if (!token) {
    return 'customer';
  }
  if (token.includes('admin')) {
    return 'admin';
  }
  if (token.includes('creator')) {
    return 'creator';
  }
  if (token.includes('editor')) {
    return 'editor';
  }
  return 'customer';
}

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'snapmatch-backend' });
});

app.get('/api/v1/creators', (req, res) => {
  const limit = Number(req.query.limit ?? creators.length);
  const q = String(req.query.q ?? '').toLowerCase();
  const location = String(req.query.location ?? '').toLowerCase();

  const filtered = creators.filter((creator) => {
    const matchesQuery =
      q.length === 0 ||
      creator.fullName.toLowerCase().includes(q) ||
      creator.creatorProfile.bio.toLowerCase().includes(q);
    const matchesLocation =
      location.length === 0 ||
      creator.creatorProfile.city.toLowerCase().includes(location) ||
      creator.creatorProfile.country.toLowerCase().includes(location);

    return matchesQuery && matchesLocation;
  });

  res.json(filtered.slice(0, limit).map((creator, index) => ({ ...creator, aiRelevance: 0.95 - index * 0.07 })));
});

app.get('/api/v1/creators/:id', (req, res) => {
  const creator = creators.find((item) => item.id === req.params.id);
  if (!creator) {
    res.status(404).json({ message: 'Creator not found' });
    return;
  }
  res.json(creator);
});

app.get('/api/v1/creators/:id/reviews', (req, res) => {
  const creatorBookings = bookings.filter((booking) => booking.creatorId === req.params.id);
  const reviews = creatorBookings.flatMap((booking) => booking.reviews);
  res.json(reviews);
});

app.get('/api/v1/creators/:id/availability', (_req, res) => {
  const slots = Array.from({ length: 9 }).map((_, index) => ({
    startAt: new Date(Date.now() + index * 1000 * 60 * 60).toISOString(),
    available: index % 3 !== 1
  }));
  res.json({ slots });
});

app.get('/api/v1/recommendations', (_req, res) => {
  res.json(creators.slice(0, 3));
});

app.get('/api/v1/bookings', (req, res) => {
  const role = String(req.query.role ?? 'customer');
  if (role === 'customer') {
    res.json(bookings.map((booking) => ({ id: booking.id, status: booking.status, eventDate: booking.eventDate, title: booking.title })));
    return;
  }
  res.json(bookings);
});

app.get('/api/v1/bookings/:id', (req, res) => {
  const booking = bookings.find((item) => item.id === req.params.id);
  if (!booking) {
    res.status(404).json({ message: 'Booking not found' });
    return;
  }
  const creator = creators.find((item) => item.id === booking.creatorId);
  res.json({
    ...booking,
    creator: creator ? { fullName: creator.fullName } : undefined
  });
});

app.post('/api/v1/bookings', (req, res) => {
  const id = `booking-${bookings.length + 1}`;
  const creatorId = String(req.body.creatorId ?? creators[0]?.id ?? 'creator-1');
  const eventDate = req.body.eventDate ? String(req.body.eventDate) : new Date().toISOString();
  const booking: Booking = {
    id,
    title: `New Booking with ${creators.find((item) => item.id === creatorId)?.fullName ?? 'Creator'}`,
    status: 'REQUESTED',
    eventDate,
    location: String(req.body.location ?? 'Location TBD'),
    creatorId,
    customerId: 'demo-customer',
    mediaAssets: [],
    reviews: []
  };

  bookings.unshift(booking);
  res.status(201).json({ id });
});

app.put('/api/v1/bookings/:id/cancel', (req, res) => {
  const booking = bookings.find((item) => item.id === req.params.id);
  if (!booking) {
    res.status(404).json({ message: 'Booking not found' });
    return;
  }
  booking.status = 'CANCELED';
  booking.cancellationReason = String(req.body.reason ?? 'Canceled by customer');
  res.json(booking);
});

app.get('/api/v1/editor-tasks', (_req, res) => {
  res.json(editorTasks);
});

app.get('/api/v1/editor-tasks/:id', (req, res) => {
  const task = editorTasks.find((item) => item.id === req.params.id);
  if (!task) {
    res.status(404).json({ message: 'Task not found' });
    return;
  }
  res.json(task);
});

app.post('/api/v1/editor-tasks', (req, res) => {
  const id = `task-${editorTasks.length + 1}`;
  const task: EditorTask = {
    id,
    bookingId: String(req.body.bookingId ?? ''),
    statusLabel: 'pending_editor_selection',
    stylePreference: String(req.body.stylePreference ?? 'Natural'),
    description: String(req.body.description ?? ''),
    submittedMediaUrls: [],
    estimatedPrice: '95',
    editor: null,
    suggestedEditors: [
      {
        id: 'editor-1',
        fullName: 'Liam Carter',
        hourlyRate: 35,
        score: 0.92,
        reasons: ['Available this week', 'Matches requested style']
      },
      {
        id: 'editor-2',
        fullName: 'Sophia Brooks',
        hourlyRate: 42,
        score: 0.89,
        reasons: ['High ratings', 'Portrait retouch specialist']
      }
    ]
  };

  editorTasks.unshift(task);
  res.status(201).json(task);
});

app.post('/api/v1/editor-tasks/:id/approve', (req, res) => {
  const task = editorTasks.find((item) => item.id === req.params.id);
  if (!task) {
    res.status(404).json({ message: 'Task not found' });
    return;
  }
  task.statusLabel = 'approved';
  res.json(task);
});

app.post('/api/v1/editor-tasks/:id/reject', (req, res) => {
  const task = editorTasks.find((item) => item.id === req.params.id);
  if (!task) {
    res.status(404).json({ message: 'Task not found' });
    return;
  }
  task.statusLabel = 'revision_requested';
  task.revisionNotes = String(req.body.revisionNotes ?? '');
  res.json(task);
});

app.get('/api/v1/subscriptions/plans', (_req, res) => {
  res.json(subscriptions.plans);
});

app.get('/api/v1/subscriptions/my', (_req, res) => {
  res.json(subscriptions.current);
});

app.post('/api/v1/subscriptions/subscribe', (req, res) => {
  subscriptions.current.plan = String(req.body.plan ?? 'PRO');
  subscriptions.current.status = 'ACTIVE';
  res.status(201).json(subscriptions.current);
});

app.put('/api/v1/subscriptions/cancel', (_req, res) => {
  subscriptions.current.status = 'CANCELED';
  res.json(subscriptions.current);
});

app.post('/api/v1/subscriptions/top-up', (req, res) => {
  const hours = Number(req.body.hours ?? 0);
  subscriptions.current.bonusHours = String(Number(subscriptions.current.bonusHours) + hours);
  res.status(201).json(subscriptions.current);
});

app.get('/api/v1/users/profile', (req, res) => {
  const role = getRoleFromToken(getAccessToken(req.header('authorization')));
  res.json({
    id: `demo-${role}`,
    email: `${role}@snapmatch.local`,
    fullName: role === 'customer' ? 'Demo Customer' : `Demo ${role[0].toUpperCase()}${role.slice(1)}`,
    phone: '+91 99999 99999',
    avatarUrl: 'https://placehold.co/120x120?text=User'
  });
});

app.put('/api/v1/users/profile', (req, res) => {
  res.json({
    id: 'demo-customer',
    email: 'customer@snapmatch.local',
    fullName: String(req.body.name ?? 'Demo Customer'),
    phone: String(req.body.phone ?? '+91 99999 99999'),
    avatarUrl: String(req.body.profileImage ?? 'https://placehold.co/120x120?text=User')
  });
});

app.post('/api/v1/auth/forgot-password', (_req, res) => {
  res.json({ message: 'If the email exists, a reset link has been sent' });
});

app.post('/api/v1/disputes', (req, res) => {
  res.status(201).json({
    id: `dispute-${Date.now()}`,
    bookingId: String(req.body.bookingId ?? ''),
    reason: String(req.body.reason ?? ''),
    details: String(req.body.details ?? ''),
    status: 'OPEN'
  });
});

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: frontendOrigin
  }
});

io.on('connection', (socket) => {
  const role = getRoleFromToken(String(socket.handshake.auth.token ?? 'customer-token'));

  socket.on('chat:join', ({ roomType, roomId }) => {
    const roomKey = `${roomType}:${roomId}`;
    socket.join(roomKey);
    socket.emit('chat:history', {
      roomType,
      roomId,
      messages: chatRooms.get(roomKey) ?? []
    });
  });

  socket.on('chat:typing', ({ roomType, roomId, typing }) => {
    const roomKey = `${roomType}:${roomId}`;
    socket.to(roomKey).emit('chat:typing', {
      roomType,
      roomId,
      userId: `demo-${role}`,
      typing: Boolean(typing)
    });
  });

  socket.on('chat:send', ({ roomType, roomId, message }, ack) => {
    const roomKey = `${roomType}:${roomId}`;
    const entry = {
      id: `msg-${Date.now()}`,
      content: String(message),
      senderId: `demo-${role}`
    };
    const existing = chatRooms.get(roomKey) ?? [];
    existing.push(entry);
    chatRooms.set(roomKey, existing);
    io.to(roomKey).emit('chat:new', { roomType, roomId, message: entry });
    ack?.({ ok: true });
  });

  socket.on('task:join', ({ taskId }) => {
    const roomKey = `task:${taskId}`;
    socket.join(roomKey);
    socket.emit('task:chat:history', {
      taskId,
      messages: taskChats.get(roomKey) ?? []
    });
  });

  socket.on('task:chat:send', ({ taskId, message }, ack) => {
    const roomKey = `task:${taskId}`;
    const entry = {
      id: `task-msg-${Date.now()}`,
      taskId,
      message: String(message),
      senderRole: role,
      createdAt: new Date().toISOString()
    };
    const existing = taskChats.get(roomKey) ?? [];
    existing.push(entry);
    taskChats.set(roomKey, existing);
    io.to(roomKey).emit('task:chat:new', entry);
    ack?.({ ok: true });
  });
});

server.listen(port, () => {
  console.log(`SnapMatch backend listening on http://localhost:${port}`);
});
