package dev.frameboost;

import com.mojang.brigadier.arguments.IntegerArgumentType;
import com.mojang.brigadier.context.CommandContext;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandManager;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import net.fabricmc.fabric.api.client.command.v2.FabricClientCommandSource;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.network.chat.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.function.BiConsumer;

public class FrameBoost implements ClientModInitializer {
	public static final Logger LOGGER = LoggerFactory.getLogger("FrameBoost");

	public static FrameBoostConfig config = new FrameBoostConfig();
	public static boolean vulkanModLoaded;

	@Override
	public void onInitializeClient() {
		config = FrameBoostConfig.load();
		vulkanModLoaded = FabricLoader.getInstance().isModLoaded("vulkanmod");
		LOGGER.info("FrameBoost loaded ({})", vulkanModLoaded
				? "VulkanMod detected: VulkanMod renders, FrameBoost trims what gets submitted"
				: "VulkanMod not installed: running on the vanilla OpenGL renderer");

		ClientTickEvents.END_CLIENT_TICK.register(client -> CullingStats.endTick());
		ClientCommandRegistrationCallback.EVENT.register((dispatcher, registryAccess) -> dispatcher.register(
				ClientCommandManager.literal("frameboost")
						.executes(FrameBoost::status)
						.then(ClientCommandManager.literal("status").executes(FrameBoost::status))
						.then(ClientCommandManager.literal("on").executes(ctx -> setEnabled(ctx, true)))
						.then(ClientCommandManager.literal("off").executes(ctx -> setEnabled(ctx, false)))
						.then(ClientCommandManager.literal("reload").executes(ctx -> {
							config = FrameBoostConfig.load();
							return status(ctx);
						}))
						.then(setting("entities", (c, v) -> c.entityRenderDistance = v, 0, 512))
						.then(setting("items", (c, v) -> c.itemRenderDistance = v, 0, 512))
						.then(setting("blockentities", (c, v) -> c.blockEntityRenderDistance = v, 0, 512))
						.then(setting("particles", (c, v) -> c.maxParticlesPerTick = v, 0, 100000))));
	}

	private static com.mojang.brigadier.builder.LiteralArgumentBuilder<FabricClientCommandSource> setting(
			String name, BiConsumer<FrameBoostConfig, Integer> setter, int min, int max) {
		return ClientCommandManager.literal(name).then(ClientCommandManager.argument("value", IntegerArgumentType.integer(min, max))
				.executes(ctx -> {
					setter.accept(config, IntegerArgumentType.getInteger(ctx, "value"));
					config.save();
					return status(ctx);
				}));
	}

	private static int setEnabled(CommandContext<FabricClientCommandSource> ctx, boolean enabled) {
		config.enabled = enabled;
		config.save();
		return status(ctx);
	}

	private static int status(CommandContext<FabricClientCommandSource> ctx) {
		FabricClientCommandSource source = ctx.getSource();
		source.sendFeedback(Component.literal("FrameBoost: " + (config.enabled ? "ON" : "OFF")
				+ (vulkanModLoaded ? " | VulkanMod: yes" : " | VulkanMod: no")));
		source.sendFeedback(Component.literal(String.format(
				"entities %d | items %d | blockentities %d | particles/tick %d  (0 = no limit)",
				config.entityRenderDistance, config.itemRenderDistance,
				config.blockEntityRenderDistance, config.maxParticlesPerTick)));
		source.sendFeedback(Component.literal(String.format(
				"Skipped last second: %d entities, %d block entities, %d particles",
				CullingStats.entitiesPerSecond, CullingStats.blockEntitiesPerSecond, CullingStats.particlesPerSecond)));
		return 1;
	}
}
