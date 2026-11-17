// Wandelt discord.js-Objekte in einfache, speicherbare Daten um.
import { ActivityType } from 'discord.js';

const toHex = (n) => (typeof n === 'number' && n > 0 ? `#${n.toString(16).padStart(6, '0')}` : null);

/** Alles, was die Profilseite von Discord braucht. */
export function buildSnapshot(member) {
  const { user, guild } = member;
  const roles = [...member.roles.cache.values()]
    .filter((r) => r.id !== guild.id && !r.managed)
    .sort((a, b) => b.position - a.position)
    .slice(0, 40)
    .map((r) => ({
      id: r.id,
      name: r.name,
      color: toHex(r.colors?.primaryColor ?? r.color),
      color2: toHex(r.colors?.secondaryColor),
      icon: r.iconURL?.({ size: 64, extension: 'webp' }) ?? null,
      emoji: r.unicodeEmoji ?? null,
    }));

  const primaryGuild = user.primaryGuild;
  return {
    id: user.id,
    username: user.username,
    globalName: user.globalName ?? null,
    displayName: member.displayName,
    avatar: member.displayAvatarURL({ size: 256 }),
    decoration: member.displayAvatarDecorationURL?.() ?? null,
    banner: member.displayBannerURL?.({ size: 1024 }) ?? null,
    accentColor: user.hexAccentColor ?? null,
    roles,
    joinedAt: member.joinedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    boostingSince: member.premiumSince?.toISOString() ?? null,
    guildTag: primaryGuild?.identityEnabled && primaryGuild.tag
      ? { tag: primaryGuild.tag, badge: user.guildTagBadgeURL?.({ size: 32 }) ?? null }
      : null,
    bot: Boolean(user.bot),
    inGuild: true,
    syncedAt: Date.now(),
  };
}

const ACTIVITY_TYPES = {
  [ActivityType.Playing]: 'playing',
  [ActivityType.Streaming]: 'streaming',
  [ActivityType.Listening]: 'listening',
  [ActivityType.Watching]: 'watching',
  [ActivityType.Competing]: 'competing',
};

/** Online-Status, Custom-Status und die wichtigste Aktivität. */
export function buildPresence(presence) {
  if (!presence) return null;
  const activities = presence.activities ?? [];
  const custom = activities.find((a) => a.type === ActivityType.Custom);
  const main = activities.find((a) => ACTIVITY_TYPES[a.type]);

  let emoji = null;
  if (custom?.emoji) {
    emoji = custom.emoji.id
      ? { name: custom.emoji.name ?? '', url: `https://cdn.discordapp.com/emojis/${custom.emoji.id}.${custom.emoji.animated ? 'gif' : 'webp'}?size=48` }
      : { name: custom.emoji.name ?? '', url: null };
  }

  let image = null;
  try {
    image = main?.assets?.largeImageURL?.({ size: 128 }) ?? null;
  } catch {
    image = null;
  }

  return {
    status: presence.status ?? 'offline',
    custom: custom && (custom.state || emoji) ? { text: custom.state ?? '', emoji } : null,
    activity: main
      ? {
          type: ACTIVITY_TYPES[main.type],
          name: main.name,
          details: main.details ?? null,
          state: main.state ?? null,
          image,
          startedAt: main.timestamps?.start ? new Date(main.timestamps.start).getTime() : null,
        }
      : null,
  };
}
