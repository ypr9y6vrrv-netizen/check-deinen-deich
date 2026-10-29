package dev.frameboost;

import net.minecraft.client.Minecraft;
import net.minecraft.core.BlockPos;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.ExperienceOrb;
import net.minecraft.world.entity.boss.enderdragon.EnderDragon;
import net.minecraft.world.entity.boss.wither.WitherBoss;
import net.minecraft.world.entity.item.ItemEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.block.entity.BeaconBlockEntity;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.entity.TheEndGatewayBlockEntity;
import net.minecraft.world.phys.Vec3;

public final class Culling {
	private Culling() {
	}

	public static boolean shouldSkipEntity(Entity entity, double camX, double camY, double camZ) {
		FrameBoostConfig config = FrameBoost.config;
		// Bosses are huge and meant to be seen from far away.
		if (!config.enabled || entity instanceof Player || entity instanceof EnderDragon || entity instanceof WitherBoss
				|| entity.isCurrentlyGlowing()) {
			return false;
		}
		Minecraft minecraft = Minecraft.getInstance();
		if (entity == minecraft.getCameraEntity() || (minecraft.player != null && entity.hasPassenger(minecraft.player))) {
			return false;
		}

		int limit = entity instanceof ItemEntity || entity instanceof ExperienceOrb
				? config.itemRenderDistance
				: config.entityRenderDistance;
		if (limit <= 0) {
			return false;
		}
		if (entity.distanceToSqr(camX, camY, camZ) > (double) limit * limit) {
			CullingStats.entitySkipped();
			return true;
		}
		return false;
	}

	public static boolean shouldSkipBlockEntity(BlockEntity blockEntity) {
		FrameBoostConfig config = FrameBoost.config;
		int limit = config.blockEntityRenderDistance;
		// Beacon beams and gateway beams are meant to be seen from far away.
		if (!config.enabled || limit <= 0
				|| blockEntity instanceof BeaconBlockEntity || blockEntity instanceof TheEndGatewayBlockEntity) {
			return false;
		}
		Vec3 camera = Minecraft.getInstance().gameRenderer.mainCamera().position();
		BlockPos pos = blockEntity.getBlockPos();
		if (camera.distanceToSqr(pos.getX() + 0.5, pos.getY() + 0.5, pos.getZ() + 0.5) > (double) limit * limit) {
			CullingStats.blockEntitySkipped();
			return true;
		}
		return false;
	}
}
