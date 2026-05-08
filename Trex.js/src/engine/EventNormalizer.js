/**
 * EventNormalizer
 * Converts raw Discord.js objects into a clean, consistent Trex event shape.
 * This decouples all rules/conditions/actions from Discord.js internals.
 */

export class EventNormalizer {
  normalize(type, raw) {
    switch (type) {
      case 'messageCreate':
        return {
          type: 'message',
          raw,
          content: raw.content,
          authorId: raw.author.id,
          authorTag: raw.author.tag,
          channelId: raw.channel.id,
          guildId: raw.guild?.id,
          roles: raw.member?.roles.cache.map(r => r.name) ?? [],
          // Convenience: lets actions send replies
          reply: (text) => raw.reply(text),
          send: (text) => raw.channel.send(text),
          delete: () => raw.delete(),
        };

      case 'guildMemberAdd':
        return {
          type: 'memberJoin',
          raw,
          userId: raw.id,
          userTag: raw.user.tag,
          guildId: raw.guild.id,
          // Actions can add/remove roles via this ref
          member: raw,
        };

      case 'reactionAdd':
        return {
          type: 'reaction',
          raw: raw.reaction,
          emoji: raw.reaction.emoji.name,
          userId: raw.user.id,
          messageId: raw.reaction.message.id,
          channelId: raw.reaction.message.channel.id,
          guildId: raw.reaction.message.guild?.id,
        };

      case 'interactionCreate':
        return {
          type: 'interaction',
          raw,
          commandName: raw.commandName,
          userId: raw.user.id,
          guildId: raw.guild?.id,
          reply: (text) => raw.reply(text),
        };

      default:
        return { type, raw };
    }
  }
}
