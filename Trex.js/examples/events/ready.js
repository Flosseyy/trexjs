/**
 * ready event handler
 *
 * Fires once when the bot connects to Discord.
 * This file is auto-discovered from src/events/
 */

/** @type {import('trexjs').TrexEvent} */
const event = {
  name:  'ready',
  event: 'ready',
  once:  true,

  async run({ data: client }) {
    console.log(`✅ Logged in as ${client.user?.tag}`);
    console.log(`   Serving ${client.guilds.cache.size} guild(s)`);
  },
};

export default event;
