// Slash-Commands, Kontextmenü & Buttons des Bots.
import fs from 'node:fs';
import path from 'node:path';
import {
  ActionRowBuilder, ApplicationCommandType, ButtonBuilder, ButtonStyle, ChannelType, ContextMenuCommandBuilder,
  EmbedBuilder, InteractionContextType, MessageFlags, PermissionFlagsBits, RESTJSONErrorCodes, SlashCommandBuilder,
  escapeMarkdown,
} from 'discord.js';
import {
  defaultProfile, slugify, validateSlug, displayNameOf, birthdayLabel, formatMonthYear, defaultLinkLabel,
} from '../shared/profile.js';

export const CONTEXT_MENU_NAME = 'Profil anzeigen';
const EPHEMERAL = MessageFlags.Ephemeral;

export function commandDefinitions() {
  const profil = new SlashCommandBuilder()
    .setName('profil')
    .setDescription('Deine Profilseite auf der Website')
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) => s.setName('bearbeiten').setDescription('Schickt dir (nur für dich sichtbar) einen Login-Link zum Profil-Editor'))
    .addSubcommand((s) => s.setName('link').setDescription('Zeigt deinen Profil-Link für dein Discord-„Über mich“'))
    .addSubcommand((s) =>
      s.setName('anzeigen').setDescription('Zeigt das Profil eines Mitglieds')
        .addUserOption((o) => o.setName('mitglied').setDescription('Wessen Profil? (leer = deins)')));

  const admin = new SlashCommandBuilder()
    .setName('profil-admin')
    .setDescription('Profile verwalten (nur für Mods)')
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s.setName('panel').setDescription('Postet eine Nachricht mit Buttons, über die jeder sein Profil bearbeiten kann')
        .addChannelOption((o) => o.setName('kanal').setDescription('Wohin? (leer = dieser Kanal)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
    .addSubcommand((s) =>
      s.setName('ausblenden').setDescription('Profil sperren – ist dann für niemanden mehr sichtbar')
        .addUserOption((o) => o.setName('mitglied').setDescription('Wessen Profil?').setRequired(true)))
    .addSubcommand((s) =>
      s.setName('einblenden').setDescription('Gesperrtes Profil wieder freigeben')
        .addUserOption((o) => o.setName('mitglied').setDescription('Wessen Profil?').setRequired(true)))
    .addSubcommand((s) =>
      s.setName('entfernen').setDescription('Profil inkl. Bildern endgültig löschen')
        .addUserOption((o) => o.setName('mitglied').setDescription('Wessen Profil?').setRequired(true)));

  const contextMenu = new ContextMenuCommandBuilder()
    .setName(CONTEXT_MENU_NAME)
    .setType(ApplicationCommandType.User)
    .setContexts(InteractionContextType.Guild);

  return [profil.toJSON(), admin.toJSON(), contextMenu.toJSON()];
}

const truncate = (s, n) => {
  const chars = Array.from(String(s ?? ''));
  return chars.length > n ? `${chars.slice(0, n - 1).join('')}…` : chars.join('');
};
const md = (s) => escapeMarkdown(String(s ?? ''));
const mdLinkLabel = (s) => md(s).replace(/[[\]]/g, (c) => `\\${c}`);
const mdLinkUrl = (u) => String(u).replace(/\(/g, '%28').replace(/\)/g, '%29');
const accentInt = (hex) => Number.parseInt(String(hex).slice(1), 16) || 0x8b5cf6;

/** Discord akzeptiert in Buttons/Embeds nur "echte" Adressen – localhost & IPs werden abgelehnt. */
export function isDiscordLinkable(url) {
  try {
    const { protocol, hostname } = new URL(url);
    return /^https?:$/.test(protocol) && hostname.includes('.') && !/^[\d.]+$/.test(hostname) && !hostname.endsWith('.local');
  } catch {
    return false;
  }
}
const httpsOnly = (u) => (typeof u === 'string' && u.startsWith('https://') ? u : undefined);

/**
 * @param {object} ctx
 * @param {ReturnType<import('../config.js').loadConfig>} ctx.config
 * @param {import('../store.js').Store} ctx.store
 * @param {{ get: Function, refresh: Function }} ctx.snapshots
 * @param {() => {name: string}} ctx.site
 * @param {Console} ctx.log
 */
export function createInteractionHandler({ config, store, snapshots, site, log }) {
  const profileUrl = (p) => `${config.publicUrl}/${p.slug}`;
  const linkable = isDiscordLinkable(config.publicUrl);
  if (!linkable) log.warn(`⚠️  PUBLIC_URL (${config.publicUrl}) ist keine öffentliche Adresse – der Bot schickt Links als Text statt als Buttons.`);

  /** Link-Buttons, wenn Discord die Adresse akzeptiert – sonst die Links als Text. */
  function linksPayload(buttons) {
    if (linkable) return { components: [new ActionRowBuilder().addComponents(buttons.map(([label, url, emoji]) => linkButton(label, url, emoji)))] };
    return { components: [], content: buttons.map(([label, url]) => `**${label}:** ${url}`).join('\n') };
  }

  /** Holt das Profil – legt beim ersten Mal automatisch eins an. */
  async function ensureProfile(userId) {
    const snap = await snapshots.refresh(userId);
    let profile = store.getProfile(userId);
    if (profile) return { profile, snap, created: false };

    let base = slugify(snap?.username) || slugify(snap?.globalName) || '';
    if (!base || validateSlug(base)) base = `mitglied-${userId.slice(-6)}`;
    let slug = base;
    for (let n = 2; store.isSlugTaken(slug) || validateSlug(slug); n++) slug = `${base.slice(0, 26)}-${n}`;
    profile = defaultProfile({ userId, slug });
    if (store.getMeta('hiddenUsers')?.[userId]) profile.hidden = true; // Sperre bleibt auch nach Löschen bestehen
    store.putProfile(profile);
    log.info(`✨ Neues Profil: ${snap?.username ?? userId} → /${slug}`);
    return { profile, snap, created: true };
  }

  /** Antwortet mit Buttons; falls Discord die URL ablehnt (z. B. localhost), ohne Buttons. */
  async function send(interaction, payload) {
    const method = interaction.deferred || interaction.replied ? 'editReply' : 'reply';
    try {
      return await interaction[method](payload);
    } catch (err) {
      if (err.code === RESTJSONErrorCodes.InvalidFormBodyOrContentType && payload.components?.length) {
        const urls = payload.components.flatMap((row) => row.components.map((c) => c.data?.url).filter(Boolean));
        return interaction[method]({ ...payload, components: [], content: [payload.content, ...urls].filter(Boolean).join('\n') });
      }
      throw err;
    }
  }

  function linkButton(label, url, emoji) {
    const b = new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(url);
    if (emoji) b.setEmoji(emoji);
    return b;
  }

  async function replyEditLink(interaction) {
    await interaction.deferReply({ flags: EPHEMERAL });
    const { profile, created } = await ensureProfile(interaction.user.id);
    const token = store.createLoginToken(interaction.user.id, config.loginLinkMinutes * 60_000);
    const loginUrl = `${config.publicUrl}/login?token=${encodeURIComponent(token)}`;
    const embed = new EmbedBuilder()
      .setColor(accentInt(profile.theme.accent))
      .setTitle(created ? '🎉 Dein Profil ist angelegt!' : '✏️ Dein Profil-Editor')
      .setDescription([
        'Klick auf **Profil bearbeiten** und gestalte deine Seite im Browser.',
        '',
        `⏳ Der Link ist **${config.loginLinkMinutes} Minuten** gültig und funktioniert **einmal**.`,
        '🔒 Teil ihn mit niemandem – damit kann man dein Profil bearbeiten.',
        '',
        `🔗 Deine Seite: ${profileUrl(profile)}`,
      ].join('\n'));
    await send(interaction, { embeds: [embed], ...linksPayload([['Profil bearbeiten', loginUrl, '✏️'], ['Ansehen', profileUrl(profile), '👀']]) });
  }

  async function replyLink(interaction) {
    await interaction.deferReply({ flags: EPHEMERAL });
    const { profile } = await ensureProfile(interaction.user.id);
    const url = profileUrl(profile);
    const embed = new EmbedBuilder()
      .setColor(accentInt(profile.theme.accent))
      .setTitle('🔗 Dein Profil-Link')
      .setDescription([
        `\`\`\`${url}\`\`\``,
        '**So kommt er in deine Bio:**',
        '🖥️ Am PC: ⚙️ Einstellungen → **Profile** → **Über mich** → Link einfügen → Speichern',
        '📱 Am Handy: Tipp unten rechts auf dein Bild → **Profil bearbeiten** → **Über mich**',
        '',
        'Gestalten kannst du die Seite mit `/profil bearbeiten`.',
      ].join('\n'));
    await send(interaction, { embeds: [embed], ...(linkable ? linksPayload([['Ansehen', url, '👀']]) : {}) });
  }

  function profileEmbed(profile, snap) {
    const url = profileUrl(profile);
    const name = displayNameOf(profile, snap);
    const avatar = httpsOnly(snap?.avatar);
    const embed = new EmbedBuilder()
      .setColor(accentInt(profile.theme.accent))
      .setAuthor({ name: truncate(snap?.username ? `${name} (@${snap.username})` : name, 256), iconURL: avatar, url: linkable ? url : undefined })
      .setTitle(truncate(profile.tagline || `Profil von ${name}`, 256));
    if (linkable) embed.setURL(url);
    if (avatar) embed.setThumbnail(avatar);
    if (profile.bio) embed.setDescription(truncate(md(profile.bio), 700));

    const fields = [];
    if (profile.pronouns) fields.push({ name: 'Pronomen', value: md(profile.pronouns), inline: true });
    if (profile.location) fields.push({ name: 'Ort', value: md(profile.location), inline: true });
    if (profile.birthday) fields.push({ name: 'Geburtstag', value: `🎂 ${birthdayLabel(profile.birthday)}`, inline: true });
    for (const f of profile.fields.slice(0, 6)) fields.push({ name: truncate(f.label, 256), value: md(f.value), inline: true });
    if (profile.tags.length) fields.push({ name: 'Interessen', value: truncate(profile.tags.map(md).join(' · '), 1024) });
    if (profile.links.length) {
      const links = profile.links.map((l) => `[${mdLinkLabel(l.label || defaultLinkLabel(l.url))}](${mdLinkUrl(l.url)})`);
      let value = '';
      for (const l of links) {
        if (value.length + l.length + 3 > 1024) break;
        value += (value ? ' · ' : '') + l;
      }
      if (value) fields.push({ name: 'Links', value });
    }
    if (profile.song) fields.push({ name: 'Lieblingssong', value: `[▶ Anhören](${mdLinkUrl(profile.song)})` });
    embed.addFields(fields.slice(0, 25));

    const footer = [];
    if (profile.show.views) footer.push(`👁 ${new Intl.NumberFormat('de-DE').format(profile.views)} Aufrufe`);
    if (profile.show.joined && snap?.joinedAt) footer.push(`Auf dem Server seit ${formatMonthYear(snap.joinedAt)}`);
    if (footer.length) embed.setFooter({ text: footer.join(' · ') });
    return embed;
  }

  async function replyShow(interaction, targetUser, { ephemeral }) {
    if (targetUser.bot) {
      return interaction.reply({ content: 'Bots haben (noch) keine Profile 🤖', flags: EPHEMERAL });
    }
    const profile = store.getProfile(targetUser.id);
    const visible = profile && profile.published && !profile.hidden;
    if (!visible) {
      const self = targetUser.id === interaction.user.id;
      return interaction.reply({
        content: self
          ? 'Du hast noch kein öffentliches Profil. Leg los mit `/profil bearbeiten` ✨'
          : `**${md(targetUser.displayName ?? targetUser.username)}** hat noch kein öffentliches Profil. Mit \`/profil bearbeiten\` kann sich jeder eins bauen ✨`,
        flags: EPHEMERAL,
        allowedMentions: { parse: [] },
      });
    }
    await interaction.deferReply(ephemeral ? { flags: EPHEMERAL } : {});
    const snap = await snapshots.get(targetUser.id, { wait: true });
    if (snap?.inGuild === false) {
      return send(interaction, { content: 'Diese Person ist nicht mehr auf dem Server.', embeds: [], components: [] });
    }
    await send(interaction, { embeds: [profileEmbed(profile, snap)], ...linksPayload([['Profil öffnen', profileUrl(profile), '🔗']]), allowedMentions: { parse: [] } });
  }

  async function handleAdmin(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: 'Dafür brauchst du die Berechtigung **Server verwalten**.', flags: EPHEMERAL });
    }
    const sub = interaction.options.getSubcommand();

    if (sub === 'panel') {
      const channel = interaction.options.getChannel('kanal') ?? interaction.channel;
      if (!channel?.isTextBased?.() || !('send' in channel)) {
        return interaction.reply({ content: 'In diesen Kanal kann ich nichts posten.', flags: EPHEMERAL });
      }
      const embed = new EmbedBuilder()
        .setColor(0x8b5cf6)
        .setTitle(`✨ Dein Profil auf ${site().name}`)
        .setDescription([
          'Bau dir deine eigene Profilseite – mit Bio, Links, Lieblingssong, Hintergrund und Effekten – und pack den Link in dein Discord-„Über mich“.',
          '',
          '**So geht’s:**',
          '1️⃣ Klick auf **Profil bearbeiten** – du bekommst einen privaten Login-Link',
          '2️⃣ Gestalte dein Profil im Browser (mit Live-Vorschau)',
          '3️⃣ Klick auf **Mein Link** und kopier ihn in deine Bio',
        ].join('\n'));
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('profil:edit').setStyle(ButtonStyle.Primary).setLabel('Profil bearbeiten').setEmoji('✏️'),
        new ButtonBuilder().setCustomId('profil:link').setStyle(ButtonStyle.Secondary).setLabel('Mein Link').setEmoji('🔗'),
      );
      if (linkable) row.addComponents(linkButton('Alle Profile', config.publicUrl, '👥'));
      try {
        await channel.send({ embeds: [embed], components: [row] });
      } catch (err) {
        if (err.code === RESTJSONErrorCodes.InvalidFormBodyOrContentType) {
          await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(row.components.slice(0, 2))] });
        } else if (err.code === RESTJSONErrorCodes.MissingAccess || err.code === RESTJSONErrorCodes.MissingPermissions) {
          return interaction.reply({ content: `Mir fehlen in ${channel} die Rechte **Nachrichten senden** und **Links einbetten**.`, flags: EPHEMERAL });
        } else {
          throw err;
        }
      }
      return interaction.reply({ content: `✅ Panel gepostet in ${channel}.`, flags: EPHEMERAL });
    }

    const target = interaction.options.getUser('mitglied', true);
    const profile = store.getProfile(target.id);
    if (!profile) {
      if (sub === 'einblenden' && store.getMeta('hiddenUsers')?.[target.id]) {
        const hiddenUsers = { ...store.getMeta('hiddenUsers') };
        delete hiddenUsers[target.id];
        store.setMeta('hiddenUsers', hiddenUsers);
        return interaction.reply({ content: `👀 Die Sperre für **${md(target.username)}** ist aufgehoben.`, flags: EPHEMERAL });
      }
      return interaction.reply({ content: `${md(target.username)} hat kein Profil.`, flags: EPHEMERAL });
    }

    if (sub === 'ausblenden' || sub === 'einblenden') {
      const hiddenUsers = { ...(store.getMeta('hiddenUsers') ?? {}) };
      if (sub === 'ausblenden') hiddenUsers[target.id] = true;
      else delete hiddenUsers[target.id];
      store.setMeta('hiddenUsers', hiddenUsers);
      profile.hidden = sub === 'ausblenden';
      profile.updatedAt = Date.now();
      store.putProfile(profile);
      log.info(`🛡️  ${interaction.user.username} hat das Profil von ${target.username} ${sub === 'ausblenden' ? 'ausgeblendet' : 'eingeblendet'}`);
      return interaction.reply({
        content: sub === 'ausblenden'
          ? `🙈 Das Profil von **${md(target.username)}** ist jetzt ausgeblendet. Die Person sieht im Editor einen Hinweis.`
          : `👀 Das Profil von **${md(target.username)}** ist wieder sichtbar.`,
        flags: EPHEMERAL,
      });
    }

    if (sub === 'entfernen') {
      const uploads = store.deleteProfile(target.id);
      for (const name of uploads) fs.rmSync(path.join(store.uploadDir, name), { force: true });
      log.info(`🛡️  ${interaction.user.username} hat das Profil von ${target.username} gelöscht`);
      return interaction.reply({ content: `🗑️ Das Profil von **${md(target.username)}** wurde gelöscht.`, flags: EPHEMERAL });
    }
  }

  async function route(interaction) {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'profil') {
        const sub = interaction.options.getSubcommand();
        if (sub === 'bearbeiten') return replyEditLink(interaction);
        if (sub === 'link') return replyLink(interaction);
        if (sub === 'anzeigen') {
          const user = interaction.options.getUser('mitglied') ?? interaction.user;
          return replyShow(interaction, user, { ephemeral: false });
        }
      }
      if (interaction.commandName === 'profil-admin') return handleAdmin(interaction);
    }
    if (interaction.isUserContextMenuCommand() && interaction.commandName === CONTEXT_MENU_NAME) {
      return replyShow(interaction, interaction.targetUser, { ephemeral: true });
    }
    if (interaction.isButton()) {
      if (interaction.customId === 'profil:edit') return replyEditLink(interaction);
      if (interaction.customId === 'profil:link') return replyLink(interaction);
    }
  }

  return async function handleInteraction(interaction) {
    if (!interaction.inGuild()) return;
    if (interaction.guildId !== config.guildId) {
      if (interaction.isRepliable()) {
        await interaction.reply({ content: 'Dieser Bot ist für einen anderen Server eingerichtet.', flags: EPHEMERAL }).catch(() => {});
      }
      return;
    }
    try {
      await route(interaction);
    } catch (err) {
      log.error(`Fehler bei Interaktion ${interaction.commandName ?? interaction.customId}:`, err);
      const payload = { content: '💥 Da ist was schiefgelaufen. Versuch es gleich nochmal.', embeds: [], components: [] };
      try {
        if (interaction.deferred || interaction.replied) await interaction.editReply(payload);
        else if (interaction.isRepliable()) await interaction.reply({ ...payload, flags: EPHEMERAL });
      } catch {
        /* egal */
      }
    }
  };
}
