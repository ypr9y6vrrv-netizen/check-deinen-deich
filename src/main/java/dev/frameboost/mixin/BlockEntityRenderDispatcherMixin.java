package dev.frameboost.mixin;

import dev.frameboost.Culling;
import net.minecraft.client.renderer.blockentity.BlockEntityRenderDispatcher;
import net.minecraft.client.renderer.blockentity.state.BlockEntityRenderState;
import net.minecraft.client.renderer.feature.ModelFeatureRenderer;
import net.minecraft.world.level.block.entity.BlockEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Both the vanilla renderer and VulkanMod's WorldRenderer collect block entities through this method. */
@Mixin(BlockEntityRenderDispatcher.class)
public abstract class BlockEntityRenderDispatcherMixin {
	@Inject(method = "tryExtractRenderState", at = @At("HEAD"), cancellable = true)
	private void frameboost$skipDistantBlockEntity(BlockEntity blockEntity, float partialTick,
			ModelFeatureRenderer.CrumblingOverlay crumblingOverlay, CallbackInfoReturnable<BlockEntityRenderState> cir) {
		if (Culling.shouldSkipBlockEntity(blockEntity)) {
			cir.setReturnValue(null);
		}
	}
}
