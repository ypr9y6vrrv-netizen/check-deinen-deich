package dev.frameboost.mixin;

import dev.frameboost.Culling;
import net.minecraft.client.renderer.culling.Frustum;
import net.minecraft.client.renderer.entity.EntityRenderer;
import net.minecraft.world.entity.Entity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Runs before VulkanMod's occlusion check in the same method (VulkanMod redirects the frustum call inside it),
 * so both apply: far entities are dropped here, hidden ones by VulkanMod.
 */
@Mixin(EntityRenderer.class)
public abstract class EntityRendererMixin {
	@Inject(method = "shouldRender", at = @At("HEAD"), cancellable = true)
	private void frameboost$skipDistantEntity(Entity entity, Frustum frustum, double camX, double camY, double camZ,
			CallbackInfoReturnable<Boolean> cir) {
		if (Culling.shouldSkipEntity(entity, camX, camY, camZ)) {
			cir.setReturnValue(false);
		}
	}
}
