import { createHash, randomBytes } from 'node:crypto';
import { safeRequest, VideoError, meetingUrl } from './http';
export type MeetingInput = {
  bookingId: string;
  start: Date;
  end: Date;
  recoverOnly?: boolean;
};
export type MeetingResult = { externalId: string; joinUrl: string };
export interface VideoMeetingProvider {
  readonly name: string;
  create(input: MeetingInput): Promise<MeetingResult>;
  update(id: string, input: MeetingInput): Promise<MeetingResult>;
  cancel(id: string): Promise<void>;
}
export class MockVideoProvider implements VideoMeetingProvider {
  readonly name = 'mock';
  async create(i: MeetingInput) {
    return {
      externalId: createHash('sha256')
        .update(i.bookingId)
        .digest('hex')
        .slice(0, 32),
      joinUrl: `https://video.example.invalid/${i.bookingId}`,
    };
  }
  async update(id: string, i: MeetingInput) {
    return { ...(await this.create(i)), externalId: id };
  }
  async cancel(id:string) {void id;}
}
class OfficialProvider {
  constructor(protected token: (force?: boolean) => Promise<string>) {}
  protected async request(url: string, method = 'GET', body?: unknown) {
    const run = async (force = false) =>
      safeRequest(url, {
        method,
        headers: {
          Authorization: `Bearer ${await this.token(force)}`,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    try {
      return await run();
    } catch (e) {
      if (e instanceof VideoError && e.code === 'HTTP_401') return run(true);
      throw e;
    }
  }
}
export class GoogleMeetProvider
  extends OfficialProvider
  implements VideoMeetingProvider
{
  readonly name = 'google';
  private base =
    'https://www.googleapis.com/calendar/v3/calendars/primary/events';
  private payload(i: MeetingInput) {
    return {
      summary: 'TaxSolutions consultation',
      start: { dateTime: i.start.toISOString(), timeZone: 'Europe/Riga' },
      end: { dateTime: i.end.toISOString(), timeZone: 'Europe/Riga' },
      reminders: { useDefault: false },
    };
  }
  private result(body: Record<string, unknown>) {
    if (typeof body.id !== 'string') throw new VideoError('INVALID_RESPONSE');
    return {
      externalId: body.id,
      joinUrl: meetingUrl(body.hangoutLink, 'google'),
    };
  }
  async create(i: MeetingInput) {
    const id = createHash('sha256')
      .update(`taxsolutions:${i.bookingId}`)
      .digest('hex');
    try {
      return this.result(
        await this.request(
          `${this.base}?conferenceDataVersion=1&sendUpdates=none`,
          'POST',
          {
            ...this.payload(i),
            id,
            conferenceData: {
              createRequest: {
                requestId: id,
                conferenceSolutionKey: { type: 'hangoutsMeet' },
              },
            },
          },
        ),
      );
    } catch (e) {
      if (e instanceof VideoError && e.code === 'HTTP_409')
        return this.update(id, i);
      throw e;
    }
  }
  async update(id: string, i: MeetingInput) {
    return this.result(
      await this.request(
        `${this.base}/${encodeURIComponent(id)}?conferenceDataVersion=1&sendUpdates=none`,
        'PATCH',
        this.payload(i),
      ),
    );
  }
  async cancel(id: string) {
    try {
      await this.request(
        `${this.base}/${encodeURIComponent(id)}?sendUpdates=none`,
        'DELETE',
      );
    } catch (e) {
      if (!(
        e instanceof VideoError && ['HTTP_404', 'HTTP_410'].includes(e.code)
      ))
        throw e;
    }
  }
}
export class TeamsProvider
  extends OfficialProvider
  implements VideoMeetingProvider
{
  readonly name = 'microsoft';
  private base = 'https://graph.microsoft.com/v1.0/me/onlineMeetings';
  private payload(i: MeetingInput) {
    return {
      subject: 'TaxSolutions consultation',
      startDateTime: i.start.toISOString(),
      endDateTime: i.end.toISOString(),
      recordAutomatically: false,
    };
  }
  private result(b: Record<string, unknown>) {
    if (typeof b.id !== 'string') throw new VideoError('INVALID_RESPONSE');
    return { externalId: b.id, joinUrl: meetingUrl(b.joinWebUrl, 'microsoft') };
  }
  async create(i: MeetingInput) {
    const b = await this.request(`${this.base}/createOrGet`, 'POST', {
      ...this.payload(i),
      externalId: i.bookingId,
    });
    if (
      typeof b.id === 'string' &&
      new Date(String(b.startDateTime)).getTime() !== i.start.getTime()
    )
      return this.update(b.id, i);
    return this.result(b);
  }
  async update(id: string, i: MeetingInput) {
    const b = await this.request(
      `${this.base}/${encodeURIComponent(id)}`,
      'PATCH',
      this.payload(i),
    );
    return this.result(b);
  }
  async cancel(id: string) {
    try {
      await this.request(`${this.base}/${encodeURIComponent(id)}`, 'DELETE');
    } catch (e) {
      if (!(e instanceof VideoError && e.code === 'HTTP_404')) throw e;
    }
  }
}
export class ZoomProvider
  extends OfficialProvider
  implements VideoMeetingProvider
{
  readonly name = 'zoom';
  private base = 'https://api.zoom.us/v2';
  private topic(i: MeetingInput) {
    return `TaxSolutions [${createHash('sha256').update(i.bookingId).digest('hex').slice(0, 24)}]`;
  }
  private payload(i: MeetingInput) {
    return {
      topic: this.topic(i),
      type: 2,
      start_time: i.start.toISOString(),
      duration: Math.ceil((i.end.getTime() - i.start.getTime()) / 60000),
      timezone: 'Europe/Riga',
      settings: {
        auto_recording: 'none',
        waiting_room: true,
        join_before_host: false,
        mute_upon_entry: true,
      },
    };
  }
  private result(b: Record<string, unknown>) {
    if (typeof b.id !== 'string' && typeof b.id !== 'number')
      throw new VideoError('INVALID_RESPONSE');
    return {
      externalId: String(b.id),
      joinUrl: meetingUrl(b.join_url, 'zoom'),
    };
  }
  async create(i: MeetingInput) {
    let next = '';
    for (let n = 0; n < 10; n++) {
      const q = new URLSearchParams({
        type: 'scheduled',
        page_size: '100',
        ...(next ? { next_page_token: next } : {}),
      });
      const list = await this.request(`${this.base}/users/me/meetings?${q}`);
      const rows = list.meetings;
      if (!Array.isArray(rows)) throw new VideoError('INVALID_RESPONSE');
      const found = rows.find(
        (r: Record<string, unknown>) => r.topic === this.topic(i),
      );
      if (found) return this.update(String(found.id), i);
      next = String(list.next_page_token ?? '');
      if (!next) break;
      if (n === 9) throw new VideoError('RECONCILIATION_REQUIRED', false, true);
    }
    if (i.recoverOnly)
      throw new VideoError('RECONCILIATION_REQUIRED', false, true);
    try {
      return this.result(
        await this.request(`${this.base}/users/me/meetings`, 'POST', {
          ...this.payload(i),
          password: randomBytes(6).toString('base64url'),
        }),
      );
    } catch (e) {
      if (e instanceof VideoError && e.uncertain)
        throw new VideoError('ZOOM_CREATE_UNCERTAIN', false, true);
      throw e;
    }
  }
  async update(id: string, i: MeetingInput) {
    await this.request(
      `${this.base}/meetings/${encodeURIComponent(id)}`,
      'PATCH',
      this.payload(i),
    );
    return this.result(
      await this.request(`${this.base}/meetings/${encodeURIComponent(id)}`),
    );
  }
  async cancel(id: string) {
    try {
      await this.request(
        `${this.base}/meetings/${encodeURIComponent(id)}`,
        'DELETE',
      );
    } catch (e) {
      if (!(e instanceof VideoError && e.code === 'HTTP_404')) throw e;
    }
  }
}
export function provider(
  name: string,
  token: (force?: boolean) => Promise<string>,
): VideoMeetingProvider {
  if (name === 'mock') {
    if (
      process.env.APP_ENV !== 'test' ||
      process.env.ENABLE_MOCK_VIDEO !== 'true'
    )
      throw new VideoError('MOCK_DISABLED');
    return new MockVideoProvider();
  }
  if (!(process.env.VIDEO_ENABLED_PROVIDERS ?? '').split(',').includes(name))
    throw new VideoError('PROVIDER_DISABLED');
  if (name === 'google') return new GoogleMeetProvider(token);
  if (name === 'microsoft') return new TeamsProvider(token);
  if (name === 'zoom') return new ZoomProvider(token);
  throw new VideoError('INVALID_PROVIDER');
}
