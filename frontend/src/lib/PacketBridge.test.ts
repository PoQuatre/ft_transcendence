import { vi, expect, test } from 'vitest';

import { PacketBridge } from './PacketBridge';

function channel() {
  return {
    readyState: 'open',
    bufferedAmount: 0,
    send: vi.fn<(data: ArrayBufferView<ArrayBuffer>) => void>(),
  } as unknown as RTCDataChannel;
}

test('drains mixed messages in order without splitting entries', () => {
  const bridge = new PacketBridge(vi.fn<() => void>());
  const event = channel();
  const state = channel();
  bridge.attach({ event, state });
  event.onmessage!({ data: new Uint8Array([4, 5]).buffer } as MessageEvent);
  state.onmessage!({ data: new Uint8Array([6]).buffer } as MessageEvent);
  event.onmessage!({ data: 'ignored' } as MessageEvent);
  event.onmessage!({ data: new ArrayBuffer(8193) } as MessageEvent);
  const buffer = new Uint8Array(5);
  expect(bridge.drain(buffer)).toBe(5);
  expect(buffer).toEqual(new Uint8Array([1, 2, 0, 4, 5]));
  expect(bridge.drain(buffer)).toBe(4);
  expect(buffer.slice(0, 4)).toEqual(new Uint8Array([2, 1, 0, 6]));
});

test('copies packets and flushes channels independently without framing', () => {
  const bridge = new PacketBridge(vi.fn<() => void>());
  const event = channel();
  const state = channel();
  Object.defineProperty(event, 'bufferedAmount', {
    value: 300000,
    writable: true,
  });
  bridge.attach({ event, state });
  const batch = new Uint8Array([1, 2, 0, 7, 8, 2, 1, 0, 9]);
  expect(bridge.submit(batch)).toBe(true);
  batch.fill(0);
  expect(state.send).toHaveBeenCalledWith(new Uint8Array([9]));
  expect(event.send).not.toHaveBeenCalled();
  Object.defineProperty(event, 'bufferedAmount', { value: 0 });
  event.onbufferedamountlow!(new Event('bufferedamountlow'));
  expect(event.send).toHaveBeenCalledWith(new Uint8Array([7, 8]));
});

test('accepts a full-size world state', () => {
  const bridge = new PacketBridge(vi.fn<() => void>());
  const state = channel();
  bridge.attach({ state });
  state.onmessage!({ data: new ArrayBuffer(8192) } as MessageEvent);
  const buffer = new Uint8Array(8195);
  expect(bridge.drain(buffer)).toBe(8195);
  expect(buffer.slice(0, 3)).toEqual(new Uint8Array([2, 0, 32]));
});

test('rejects malformed batches and handles send failures', () => {
  const fail = vi.fn<() => void>();
  const bridge = new PacketBridge(fail);
  const event = channel();
  bridge.attach({ event });
  expect(bridge.submit(new Uint8Array([1, 2, 0, 4]))).toBe(false);
  expect(event.send).not.toHaveBeenCalled();
  vi.mocked(event.send).mockImplementation(() => {
    throw Error();
  });
  expect(bridge.submit(new Uint8Array([1, 1, 0, 4]))).toBe(false);
  expect(fail).toHaveBeenCalledTimes(2);
});

test('overflow fails and clearing prevents replay after replacement', () => {
  const fail = vi.fn<() => void>();
  const bridge = new PacketBridge(fail);
  const event = channel();
  bridge.attach({ event });
  const message = new ArrayBuffer(1024);
  for (let i = 0; i < 4085; i++)
    event.onmessage!({ data: message } as MessageEvent);
  expect(fail).toHaveBeenCalled();
  bridge.clear();
  const replacement = channel();
  bridge.attach({ event: replacement });
  expect(bridge.drain(new Uint8Array(1027))).toBe(0);
  expect(replacement.send).not.toHaveBeenCalled();
});
