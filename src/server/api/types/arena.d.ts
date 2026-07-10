declare module 'are.na' {
  interface ArenaBlock {
    id: number;
    title: string;
    class: string;
    image?: {
      thumb: { url: string };
      square: { url: string };
      display: { url: string };
      large: { url: string };
      original: { url: string };
    };
    source?: {
      url: string;
    };
    created_at: string;
  }

  interface ArenaChannel {
    title: string;
    slug: string;
    contents(options?: { page?: number; per?: number }): Promise<ArenaBlock[] & { attrs: any }>;
  }

  class Arena {
    constructor();
    channel(slug: string): ArenaChannel;
  }

  export = Arena;
}