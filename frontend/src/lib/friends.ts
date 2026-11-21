import { type AuthResult, getAuthenticated, sendAuthenticated } from './auth';

export type Friend = { username: string; friend_id: string };
export type FriendRequest = {
  username: string;
  sender_id: string;
  created_at: string;
};

export type Page<T> = { items: T[]; totalPages: number; currentPage: number };

type ListResult<T> =
  | { ok: true; page: Page<T> }
  | Extract<AuthResult, { ok: false }>;

type ListBody = { total_pages: number; current_page: number };

export async function listFriends(page = 1): Promise<ListResult<Friend>> {
  const result = await getAuthenticated(`/api/friends/list?page=${page}`);
  if (!result.ok) return result;
  const body = result.data as ListBody & { relations: Friend[] };
  return {
    ok: true,
    page: {
      items: body.relations,
      totalPages: body.total_pages,
      currentPage: body.current_page,
    },
  };
}

export async function listFriendRequests(
  page = 1,
): Promise<ListResult<FriendRequest>> {
  const result = await getAuthenticated(
    `/api/friends/requests/list?page=${page}`,
  );
  if (!result.ok) return result;
  const body = result.data as ListBody & { requests: FriendRequest[] };
  return {
    ok: true,
    page: {
      items: body.requests,
      totalPages: body.total_pages,
      currentPage: body.current_page,
    },
  };
}

export const sendFriendRequest = (username: string) =>
  sendAuthenticated('POST', '/api/friends/requests/send', { username });

export const acceptFriendRequest = (senderId: string) =>
  sendAuthenticated('POST', '/api/friends/requests/accept', {
    sender_id: senderId,
  });

export const declineFriendRequest = (senderId: string) =>
  sendAuthenticated('POST', '/api/friends/requests/decline', {
    sender_id: senderId,
  });

export const unfriend = (friendId: string) =>
  sendAuthenticated('POST', '/api/friends/unfriend', { friend_id: friendId });

export type ChatMessage = {
  message: string;
  sender_id: string;
  sent_at: string;
};

type MessagesResult =
  | { ok: true; messages: ChatMessage[] }
  | Extract<AuthResult, { ok: false }>;

// Le backend renvoie les 50 derniers messages, du plus ancien au plus récent.
export async function getMessages(friendId: string): Promise<MessagesResult> {
  const result = await getAuthenticated(
    `/api/friends/chat/get-messages?friend_id=${encodeURIComponent(friendId)}`,
  );
  if (!result.ok) return result;
  return {
    ok: true,
    messages: (result.data as { messages: ChatMessage[] }).messages,
  };
}

export const sendMessage = (friendId: string, message: string) =>
  sendAuthenticated('POST', '/api/friends/chat/send-message', {
    friend_id: friendId,
    message,
  });

// La limite du backend porte sur les octets UTF-8 : un accent compte double.
export const isMessageTooLong = (message: string) =>
  new TextEncoder().encode(message).length > 140;
