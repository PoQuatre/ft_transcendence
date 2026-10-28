import { Builder, ByteBuffer } from 'flatbuffers';
import { expect, test } from 'vitest';

import { ClientHello } from './generated/game/protocol/client-hello';
import { ControlPacketId } from './generated/game/protocol/control-packet-id';

test('generated control bindings serialize and deserialize a client hello', () => {
  const builder = new Builder();
  builder.finish(ClientHello.createClientHello(builder, 42));

  const message = ClientHello.getRootAsClientHello(
    new ByteBuffer(builder.asUint8Array()),
  );
  expect(message.protocolVersion()).toBe(42);
  expect(ControlPacketId.ClientHello).toBe(1);
});
