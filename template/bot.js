import { createTrex } from 'trexjs';

const trex = createTrex();

// Add plugins here:
// import { moderationPlugin } from 'trexjs/plugins/moderation';
// trex.use(moderationPlugin);

await trex.start();
