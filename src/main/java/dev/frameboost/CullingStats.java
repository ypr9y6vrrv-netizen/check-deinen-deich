package dev.frameboost;

/** Counters for /frameboost status and the per-tick particle budget. Only touched from the client thread. */
public final class CullingStats {
	private static int entities;
	private static int blockEntities;
	private static int particles;
	private static int particlesThisTick;
	private static int ticks;

	public static int entitiesPerSecond;
	public static int blockEntitiesPerSecond;
	public static int particlesPerSecond;

	private CullingStats() {
	}

	public static void entitySkipped() {
		entities++;
	}

	public static void blockEntitySkipped() {
		blockEntities++;
	}

	/** Returns false when this tick's particle budget is used up. */
	public static boolean tryAddParticle() {
		int max = FrameBoost.config.maxParticlesPerTick;
		if (!FrameBoost.config.enabled || max <= 0 || particlesThisTick < max) {
			particlesThisTick++;
			return true;
		}
		particles++;
		return false;
	}

	static void endTick() {
		particlesThisTick = 0;
		if (++ticks >= 20) {
			// Entity and block entity counts are per frame, so this is "skips per second" summed over frames.
			entitiesPerSecond = entities;
			blockEntitiesPerSecond = blockEntities;
			particlesPerSecond = particles;
			entities = blockEntities = particles = ticks = 0;
		}
	}
}
