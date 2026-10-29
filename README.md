# FrameBoost (Fabric 1.21.11, VulkanMod-kompatibel)

Client-Mod, die die Render-Last reduziert, indem sie weniger Arbeit an die GPU schickt.
Gedacht als Ergänzung zu [VulkanMod](https://github.com/xCollateral/VulkanMod), läuft aber auch ohne.

## Was sie macht

| Feature | Standard | Wirkung |
|---|---|---|
| Entity-Renderdistanz | 64 Blöcke | Mobs, Rüstungsständer, Rahmen, Loren usw. weiter weg werden nicht gerendert |
| Item-Renderdistanz | 32 Blöcke | Gedroppte Items und XP-Orbs weiter weg werden nicht gerendert |
| Block-Entity-Renderdistanz | 48 Blöcke | Kisten, Schilder, Banner, Köpfe usw. weiter weg werden nicht gerendert (Beacons und End-Gateways ausgenommen) |
| Partikel-Budget | 800 pro Tick | Partikel-Spam (Explosionen, Farmen) wird gedeckelt |

Spieler, leuchtende Entities, das Reittier und Bosse (Enderdrache, Wither) werden nie ausgeblendet.

## Zusammenspiel mit VulkanMod

VulkanMod ersetzt den OpenGL-Renderer komplett durch Vulkan. Das ist der eigentliche GPU-Gewinn.
FrameBoost greift **nicht** in die Render-Pipeline ein, sondern nur an drei Stellen, an denen entschieden wird, *was* gerendert wird:

- `EntityRenderer.shouldRender`: Inject am Methodenanfang. VulkanMods Occlusion-Culling (Redirect in derselben Methode) bleibt aktiv.
- `BlockEntityRenderDispatcher.tryExtractRenderState`: wird auch von VulkanMods eigenem `WorldRenderer` aufgerufen, wirkt also mit VulkanMod.
- `ParticleEngine.add`: VulkanMod ändert diese Methode nicht.

Die CI prüft bei jedem Push, dass alle Mixins auf 1.21.11 greifen, sowohl allein als auch zusammen mit dem aktuellen VulkanMod-Release von Modrinth.

## Ehrliche Erwartung

Keine Mod kann aus derselben Grafikkarte zaubern, was VulkanMod nicht schon herausholt.
FrameBoost hilft dort, wo zu viel gezeichnet wird: Mob-Farmen, Basen mit vielen Kisten und Schildern, Item-Lager, Partikel-Spam.
Dort können es spürbar mehr FPS sein; in einer leeren Landschaft ändert sich wenig. Mit `/frameboost off` / `on` kannst du direkt vergleichen.

## Befehle

```
/frameboost                    Status + wie viel in der letzten Sekunde übersprungen wurde
/frameboost on|off             Ein-/Ausschalten (für FPS-Vergleich)
/frameboost entities <n>       Entity-Distanz (0 = kein Limit)
/frameboost items <n>          Item-Distanz
/frameboost blockentities <n>  Block-Entity-Distanz
/frameboost particles <n>      Partikel pro Tick
/frameboost reload             config/frameboost.json neu laden
```

## Installation

1. Fabric Loader ≥ 0.18.4 (gebaut und getestet mit 0.20.1) für Minecraft 1.21.11 und Fabric API installieren.
2. VulkanMod (für 1.21.11) und `frameboost-1.0.0+1.21.11.jar` in den `mods`-Ordner legen.

Die fertige Jar gibt es unter **Actions → build → Artifacts → FrameBoost**.

## Selbst bauen

```
./gradlew build                 # Jar in build/libs/ (Gradle braucht JDK 25)
./gradlew runMixinAudit         # prüft, dass alle Mixins greifen
```
