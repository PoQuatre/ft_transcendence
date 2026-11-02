type BridgedChannel = 1 | 2 | 3;
type Channels = Partial<Record<BridgedChannel, RTCDataChannel>>;
type NamedChannels = Partial<
  Record<'event' | 'state' | 'sync', RTCDataChannel>
>;
type OutgoingData = [Uint8Array[], Uint8Array[], Uint8Array[]];

const channelNames = ['event', 'state', 'sync'] as const;

const maxPacketSize = 1024;
const incomingLimit = 4 * 1024 * 1024;
const bufferThreshold = 256 * 1024;

export class PacketBridge {
  private incoming: Array<{ channel: BridgedChannel; bytes: Uint8Array }> = [];
  private incomingBytes = 0;
  private outgoing: OutgoingData = [[], [], []];
  private channels: Channels = {};

  constructor(private fail: () => void) {}

  failure() {
    this.fail();
  }

  attach(channels: NamedChannels) {
    this.clear();

    for (const name of channelNames) {
      const channel = channels[name];
      if (!channel) continue;
      const id = (channelNames.indexOf(name) + 1) as BridgedChannel;

      this.channels[id] = channel;

      channel.binaryType = 'arraybuffer';
      channel.bufferedAmountLowThreshold = bufferThreshold;

      // oxlint-disable-next-line unicorn/prefer-add-event-listener
      channel.onmessage = (event) => {
        if (
          this.channels[id] !== channel ||
          !(event.data instanceof ArrayBuffer) ||
          event.data.byteLength > maxPacketSize
        )
          return;

        if (this.incomingBytes + event.data.byteLength + 3 > incomingLimit) {
          this.fail();
          return;
        }

        this.incomingBytes += event.data.byteLength + 3;
        this.incoming.push({ channel: id, bytes: new Uint8Array(event.data) });
      };

      // oxlint-disable-next-line unicorn/prefer-add-event-listener
      channel.onopen = () => this.flush(id, channel);
      // oxlint-disable-next-line unicorn/prefer-add-event-listener
      channel.onbufferedamountlow = () => this.flush(id, channel);
    }
  }

  clear() {
    this.channels = {};
    this.incoming = [];
    this.incomingBytes = 0;
    this.outgoing = [[], [], []];
  }

  drain(dest: Uint8Array): number {
    let offset = 0;
    let i = 0;

    for (const packet of this.incoming) {
      const size = packet.bytes.length + 3;
      if (size > dest.length - offset) break;

      dest[offset] = packet.channel;
      dest[offset + 1] = packet.bytes.length & 0xff;
      dest[offset + 2] = (packet.bytes.length >> 8) & 0xff;
      dest.set(packet.bytes, offset + 3);

      offset += size;
      i++;
    }

    this.incomingBytes -= offset;
    this.incoming.splice(0, i);
    return offset;
  }

  submit(batch: Uint8Array): boolean {
    try {
      for (let offset = 0; offset < batch.length;) {
        if (batch.length - offset < 3) throw new Error('truncated header');
        const channel = batch[offset]!;
        const size = batch[offset + 1]! | (batch[offset + 2]! << 8);
        offset += 3;

        if (
          channel < 1 ||
          channel > 3 ||
          size > maxPacketSize ||
          size > batch.length - offset
        )
          throw new Error('invalid packet');

        this.outgoing[channel - 1]!.push(batch.slice(offset, offset + size));
        offset += size;
      }

      let ok = true;
      for (const id of [1, 2, 3] as const) {
        const channel = this.channels[id];
        if (channel && !this.flush(id, channel)) ok = false;
      }
      return ok;
    } catch {
      this.fail();
      return false;
    }
  }

  private flush(id: BridgedChannel, channel: RTCDataChannel): boolean {
    if (this.channels[id] !== channel) return true;

    try {
      const queue = this.outgoing[id - 1]!;

      let i = 0;
      while (
        i < queue.length &&
        channel.readyState === 'open' &&
        channel.bufferedAmount <= bufferThreshold
      )
        channel.send(queue[i++] as Uint8Array<ArrayBuffer>);

      queue.splice(0, i);
      return true;
    } catch {
      this.fail();
      return false;
    }
  }
}
