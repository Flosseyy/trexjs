/**
 * EventLoader
 * Binds discovered event handlers to the Discord client.
 */

export class EventLoader {
  constructor(client) {
    this.client = client;
  }

  bind(evt, t) {
    const method = evt.once ? 'once' : 'on';
    this.client[method](evt.event, async (...args) => {
      const data = args.length === 1 ? args[0] : args;
      await evt.run({ data, client: this.client, t });
    });
  }
}
