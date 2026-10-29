package dev.frameboost;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.io.Reader;
import java.io.Writer;
import java.nio.file.Files;
import java.nio.file.Path;

/** Settings stored in config/frameboost.json. A distance of 0 disables that limit. */
public class FrameBoostConfig {
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static final Path PATH = FabricLoader.getInstance().getConfigDir().resolve("frameboost.json");

	public boolean enabled = true;
	/** Mobs, minecarts, armor stands, item frames... beyond this many blocks are not rendered. */
	public int entityRenderDistance = 64;
	/** Dropped items and XP orbs beyond this many blocks are not rendered. */
	public int itemRenderDistance = 32;
	/** Chests, signs, banners, skulls... beyond this many blocks are not rendered. Beacons and end gateways are exempt. */
	public int blockEntityRenderDistance = 48;
	/** Maximum new particles per client tick; extra particles are dropped. */
	public int maxParticlesPerTick = 800;

	public static FrameBoostConfig load() {
		if (Files.exists(PATH)) {
			try (Reader reader = Files.newBufferedReader(PATH)) {
				FrameBoostConfig config = GSON.fromJson(reader, FrameBoostConfig.class);
				if (config != null) {
					config.save();
					return config;
				}
			} catch (Exception e) {
				FrameBoost.LOGGER.warn("Could not read {}, using defaults", PATH, e);
			}
		}
		FrameBoostConfig config = new FrameBoostConfig();
		config.save();
		return config;
	}

	public void save() {
		try (Writer writer = Files.newBufferedWriter(PATH)) {
			GSON.toJson(this, writer);
		} catch (IOException e) {
			FrameBoost.LOGGER.warn("Could not write {}", PATH, e);
		}
	}
}
