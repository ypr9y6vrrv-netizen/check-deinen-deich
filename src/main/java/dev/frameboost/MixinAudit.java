package dev.frameboost;

import net.fabricmc.loader.api.entrypoint.PreLaunchEntrypoint;
import net.minecraft.client.particle.ParticleEngine;
import net.minecraft.client.renderer.blockentity.BlockEntityRenderDispatcher;
import net.minecraft.client.renderer.entity.EntityRenderer;
import org.spongepowered.asm.mixin.MixinEnvironment;

/**
 * Only active with -Dframeboost.audit=true (the mixinAudit Gradle run, used by CI).
 * Loads every class FrameBoost mixes into, so a missing or conflicting injection point fails the run, then exits.
 */
public class MixinAudit implements PreLaunchEntrypoint {
	@Override
	public void onPreLaunch() {
		if (!Boolean.getBoolean("frameboost.audit")) {
			return;
		}
		try {
			Class<?>[] targets = {EntityRenderer.class, BlockEntityRenderDispatcher.class, ParticleEngine.class};
			for (Class<?> target : targets) {
				Class.forName(target.getName(), false, MixinAudit.class.getClassLoader());
			}
			MixinEnvironment.getCurrentEnvironment().audit();
			FrameBoost.LOGGER.info("FrameBoost mixin audit passed");
			System.exit(0);
		} catch (Throwable t) {
			FrameBoost.LOGGER.error("FrameBoost mixin audit failed", t);
			System.exit(1);
		}
	}
}
