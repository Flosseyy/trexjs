/**
 * paginate()
 * Sends an embed with ← → navigation buttons.
 * Works with both regular replies and deferred replies.
 *
 * Usage:
 *   import { paginate } from 'trexjs/pagination';
 *
 *   await paginate({
 *     interaction,
 *     pages: [embed1, embed2, embed3],
 *     timeout: 60_000,
 *   });
 */

import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

const PREV_ID = 'trex_page_prev';
const NEXT_ID = 'trex_page_next';

export async function paginate({ interaction, pages, timeout = 60_000, deleteOnTimeout = false }) {
  if (!pages.length) throw new Error('paginate() requires at least one page');

  let current = 0;

  const row = () => new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(PREV_ID)
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(current === 0),
    new ButtonBuilder()
      .setCustomId(NEXT_ID)
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(current === pages.length - 1),
  );

  const payload = () => ({
    embeds: [pages[current]],
    components: pages.length > 1 ? [row()] : [],
  });

  // Send initial reply
  let reply;
  if (interaction.deferred || interaction.replied) {
    reply = await interaction.editReply(payload());
  } else {
    reply = await interaction.reply({ ...payload(), fetchReply: true });
  }

  if (pages.length <= 1) return;

  // Collect button clicks
  const collector = reply.createMessageComponentCollector({
    filter: (i) => [PREV_ID, NEXT_ID].includes(i.customId) && i.user.id === interaction.user.id,
    time: timeout,
  });

  collector.on('collect', async (btn) => {
    if (btn.customId === PREV_ID && current > 0) current--;
    if (btn.customId === NEXT_ID && current < pages.length - 1) current++;
    await btn.update(payload());
  });

  collector.on('end', async () => {
    if (deleteOnTimeout) {
      await reply.delete().catch(() => {});
    } else {
      // Disable buttons
      const disabled = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(PREV_ID).setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId(NEXT_ID).setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(true),
      );
      await reply.edit({ components: [disabled] }).catch(() => {});
    }
  });
}
