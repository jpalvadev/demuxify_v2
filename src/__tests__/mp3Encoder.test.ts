import { describe, it, expect, vi } from 'vitest';
import {
  encodeMp3Buffer,
  encodeMp3,
  VALID_MP3_BITRATES,
  Mp3Bitrate,
} from '../lib/mp3Encoder';
import { handleMp3WorkerMessage } from '../workers/mp3Encoder.worker';

describe('mp3Encoder', () => {
  describe('bitrate validation', () => {
    it('validates supported bitrates', () => {
      expect(VALID_MP3_BITRATES).toEqual([128, 192, 256, 320]);
    });

    it('rejects invalid bitrate in encodeMp3Buffer', () => {
      const left = new Float32Array(1152);
      expect(() =>
        encodeMp3Buffer([left], 44100, 64 as unknown as Mp3Bitrate)
      ).toThrow(/bitrate/i);
    });
  });

  describe('MP3 frame stream emission', () => {
    it('encodes stereo PCM audio into valid MP3 byte stream with MPEG sync header', () => {
      const length = 1152 * 4;
      const left = new Float32Array(length);
      const right = new Float32Array(length);
      // Fill with simple sine tone
      for (let i = 0; i < length; i++) {
        left[i] = Math.sin((i * 440 * 2 * Math.PI) / 44100);
        right[i] = Math.cos((i * 440 * 2 * Math.PI) / 44100);
      }

      const progressSpy = vi.fn();
      const mp3Bytes = encodeMp3Buffer([left, right], 44100, 192, progressSpy);

      expect(mp3Bytes.length).toBeGreaterThan(0);
      // MPEG Audio sync word: 0xFF followed by 0xFB (MPEG-1 Layer 3, no CRC) or 0xFA (with CRC)
      expect(mp3Bytes[0]).toBe(0xff);
      expect((mp3Bytes[1] & 0xfe)).toBe(0xfa);

      // Verify progress callback was invoked
      expect(progressSpy).toHaveBeenCalled();
      expect(progressSpy).toHaveBeenLastCalledWith(1);
    });

    it('encodes mono PCM audio correctly', () => {
      const length = 1152 * 2;
      const mono = new Float32Array(length).fill(0.1);
      const mp3Bytes = encodeMp3Buffer([mono], 44100, 128);

      expect(mp3Bytes.length).toBeGreaterThan(0);
      expect(mp3Bytes[0]).toBe(0xff);
    });
  });

  describe('worker message protocol', () => {
    it('handles worker encode request and posts progress and success messages', async () => {
      const length = 1152 * 2;
      const left = new Float32Array(length).fill(0.2);
      const right = new Float32Array(length).fill(-0.2);

      const postedMessages: any[] = [];
      const mockPostMessage = (msg: any) => postedMessages.push(msg);

      await handleMp3WorkerMessage(
        {
          id: 'req-1',
          type: 'encode',
          channels: [left, right],
          sampleRate: 44100,
          bitrate: 320,
        },
        mockPostMessage
      );

      const successMsg = postedMessages.find((m) => m.type === 'success');
      expect(successMsg).toBeDefined();
      expect(successMsg.id).toBe('req-1');
      expect(successMsg.mp3Data).toBeInstanceOf(ArrayBuffer);
      expect(successMsg.mp3Data.byteLength).toBeGreaterThan(0);

      const progressMsgs = postedMessages.filter((m) => m.type === 'progress');
      expect(progressMsgs.length).toBeGreaterThan(0);
    });

    it('posts error message if worker receives invalid request', async () => {
      const postedMessages: any[] = [];
      const mockPostMessage = (msg: any) => postedMessages.push(msg);

      await handleMp3WorkerMessage(
        {
          id: 'req-err',
          type: 'encode',
          channels: [],
          sampleRate: 44100,
          bitrate: 192,
        },
        mockPostMessage
      );

      const errorMsg = postedMessages.find((m) => m.type === 'error');
      expect(errorMsg).toBeDefined();
      expect(errorMsg.id).toBe('req-err');
      expect(errorMsg.error).toBeDefined();
    });
  });

  describe('client encodeMp3 function', () => {
    it('encodes AudioBuffer or channels using direct execution fallback', async () => {
      const length = 1152 * 2;
      const left = new Float32Array(length).fill(0.1);
      const right = new Float32Array(length).fill(-0.1);

      const onProgress = vi.fn();
      const mp3Bytes = await encodeMp3([left, right], {
        sampleRate: 44100,
        bitrate: 256,
        onProgress,
      });

      expect(mp3Bytes).toBeInstanceOf(Uint8Array);
      expect(mp3Bytes.byteLength).toBeGreaterThan(0);
      expect(mp3Bytes[0]).toBe(0xff);
      expect(onProgress).toHaveBeenCalled();
    });

    it('relays messages through a provided Worker instance', async () => {
      let savedReqId = '';
      const mockWorker: any = {
        postMessage: vi.fn((req) => {
          savedReqId = req.id;
          setTimeout(() => {
            mockWorker.onmessage?.({
              data: {
                id: savedReqId,
                type: 'progress',
                progress: 0.5,
              },
            });
            mockWorker.onmessage?.({
              data: {
                id: savedReqId,
                type: 'success',
                mp3Data: new Uint8Array([0xff, 0xfb, 0x90, 0x00]).buffer,
              },
            });
          }, 10);
        }),
        terminate: vi.fn(),
        onmessage: null,
      };

      const onProgress = vi.fn();
      const left = new Float32Array(1152);
      const res = await encodeMp3([left], {
        worker: mockWorker,
        onProgress,
      });

      expect(mockWorker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'encode',
          sampleRate: 44100,
          bitrate: 192,
        })
      );
      expect(res[0]).toBe(0xff);
      expect(onProgress).toHaveBeenCalledWith(0.5);
    });
  });
});
