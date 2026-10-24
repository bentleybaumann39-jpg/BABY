# BENTHOS: THE SILENT PRESSURE

**Concept Document · v0.1 · Pixel/Vector Hybrid Edition**

*A single-player survival-horror descent into the Trench of Whispers, drawn in high-fidelity 2D pixel art with dynamic lighting.*

> *"The deep keeps order, not time."*
> — scratched with a diver's knife into the inner hull of the bathyscaphe *Thalassa Vigil*, found hanging at 2,200 m

---

## At a Glance

| | |
|---|---|
| **Genre** | Survival horror · inertial stealth · descent-driven exploration |
| **Perspective** | Top-down isometric: a 45°-rotated grid drawn in 2:1 dimetric for clean pixel lines, with continuous vertical descent through stacked strata |
| **Internal resolution** | 480×270 for the first descent, 320×180 for New Game+ (see §1.5) |
| **Output** | Integer upscale, then a CRT / caustic / bioluminescence shader stack. Sharp-bilinear fallback on displays that don't divide evenly. |
| **Length** | 9–11 hours: prologue, three acts, three endings |
| **Platforms** | PC, Steam Deck, current-gen consoles. Adaptive triggers and HD haptics are designed in from the start. |
| **Lineage** | *Carrion*'s fluid, consuming body · *Hollow Knight*'s melancholy and layered darkness · *Subnautica*'s depth-gated dread |
| **Design pillars** | **Weight:** the water is a substance, not a backdrop. **Darkness is information:** what you can't see is data you don't have. **Every gauge lies a little.** **You are being forgotten.** |

> [!WARNING]
> **Spoilers.** This is an internal document. The twist drives every system, so it is discussed openly from §1.2 onward. §5.5 lays it out in full.

---

## 1. Core Hook & Premise: *The Why*

### 1.1 The Inciting Incident

Seventy-two hours before the game begins, Halvard Marine's survey ROV ***Magpie-3*** goes dark at **2,904 metres** in the Asher Deep. The Asher Deep is a fault in the South Pacific, 600 km east of the Kermadec arc, and every crew that has worked it calls it **the Trench of Whispers**. *Magpie*'s tether doesn't snap. It is *cut* cleanly, about a metre from the vehicle. The ROV's emergency acoustic modem keeps sending data for eleven more seconds after that.

The prologue opens on the aft deck of the support vessel MSV ***Halcyon Mercy***. It is a grey dawn with rain coming in sideways, and the air stinks of diesel from the A-frame crane. Dive supervisor **Tobias Wend** turns a ruggedised laptop toward you under a dripping tarp and plays the eleven seconds.

* **The picture.** Silt, lit sodium-orange by the ROV's lamps, with marine snow drifting through the frame. In the centre, a hardsuit helmet lies on its side with its viewport crazed into a starburst. The camera auto-focuses on the collar ring, where a stencil reads **HV-0419**.
* **Why that stops your breath.** HV-0419 is *your* suit. It is hanging fifteen metres away in the dive locker, dry and polished, with its viewport intact. You have worn it for six years.
* **The sound.** Tobias plays the hydrophone track. Under the hiss, crushed to the narrow band of a through-water telephone, a woman's voice says:

  > *"Halcyon, Four-One-Nine. Depth one-one-four-zero. I'm—"*

  Then nothing. **Four-One-Nine** is your call sign, and that is your voice. You have never been in the Asher Deep.

You are **Mara Ekdahl**, 47. You spent twenty-three years as a commercial saturation diver, and you are the last pilot certified on Halvard's HV-series atmospheric hardsuits. The other two certified pilots left the company in 2019, and neither will say why.

* **What Halvard wants:** *Magpie-3*'s data core, a 4 kg titanium recorder the crew call **the Wren**. It holds the survey that proves a polymetallic-nodule claim worth $2.1 billion.
* **Why it has to be now:**
  * The claim lapses in 96 hours.
  * A Southern Ocean low will close the weather window in 80.
  * The 17 Hz pulse that has risen from the Trench since 1963 changed its rhythm three days ago, for the first time since 1994.
* **What Halvard offers:** triple day rate, and the eleven seconds struck from the incident report.
* **Why you take it:** not for the money. You take it because the alternative is to spend the rest of your life listening to that voice and wondering how it learned your name.

The prologue is the only time in the game you stand on something solid. You walk the deck. There are crew, coffee, and an old waltz on the galley radio. You suit up. The cage swings out over the water on its winch, and the sky is the last thing you see in colour.

### 1.2 The Wreck, the Artifact, and the Thing Beneath Both

There are three layers to what Mara is retrieving, and the player peels them back in order.

1. **The wreck: *Magpie-3*.**
   * **Where and what:** a 3.2-tonne work-class ROV on a basalt ledge at 2,904 m, at the mouth of the inner trench.
   * **What's been done to it:** its thruster pods have been stripped, and something has packed its frame with what looks like nesting material: kelp that cannot grow at this depth, rope, and a child's yellow raincoat.
   * **Its light:** the ROV's lamps still burn on reserve power, and it is the only fixed light in all of Act II. Beer–Lambert says a lamp that size should vanish beyond forty metres of water, yet you can see it from nineteen hundred. The Trench bends exactly one law in your favour, and only for the light it wants you to follow.
2. **The artifact: the Wren.**
   * **What it looks like:** a flight-recorder-orange cylinder the size of a thermos. Orange stops existing outside your lamp below 600 m, so the Wren only glows when you are close enough to touch it.
   * **What Halvard says is on it:** 72 hours of survey sonar.
   * **What is actually on it:** 72 hours of *camera footage*. After the eleven seconds Tobias showed you, the camera kept recording. What it saw is the game's final revelation (§5.5).
3. **The source: the Ostinato.**
   * **What it is:** in 1963 a Cold War hydrophone array logged a **17 Hz pulse** rising from the Asher Deep. It is regular, patient and too slow for any whale, and it has never stopped.
   * **What Halvard thinks:** its geologists believe the pulse is a resonant mineral formation, which would mean a deposit.
   * **What the logs show:** the rhythm has **changed exactly four times**.

     | When | What was lost |
     |---|---|
     | 1971 | The bathyscaphe *Thalassa Vigil* and her two crew |
     | 1994 | The Halvard saturation team known as the Halvard Four, with their bell, the *Gannet* |
     | 2009 | The hadal lander *Tern-7* |
     | 72 hours ago | *Magpie-3*: the moment it filmed your helmet, before you agreed to dive |

   * **How the player finds out:** a dossier on the *Halcyon Mercy* lists the first three changes. The player works out the fourth for themselves, from a timestamp.

### 1.3 The Rules of the Trench

The Trench has one governing law, and the player reads it on the scratched hull of the *Thalassa Vigil* long before they understand it: **the deep keeps order, not time.** Pressure doesn't just crush; it *files*. Everything that sinks into the Asher Deep is stored and sorted by weight, not by when it arrived.

The law shows itself as three physical hazards. Each one starts from real oceanography and is pushed past it, each one owns a depth band, and each one corrupts a different verb:

* **Hazard I** corrupts **sensing**.
* **Hazard II** corrupts **moving**.
* **Hazard III** corrupts **time and fidelity**.

#### Hazard I: The Phantom Floor (420–560 m)

*Real-world anchor:* in the 1940s, naval sonar operators logged a seafloor that rose toward the surface every night and sank again at dawn. It turned out to be the **Deep Scattering Layer**: a band of lanternfish, krill and siphonophores dense enough to echo like rock. In the Trench, that Layer is sixty metres thick and denser than anywhere else on Earth.

* **Sonar lies.** A wide ping inside or above the Layer returns a *false floor*: a solid wireframe plane of terrain that isn't there. It masks the real geometry underneath 70% of the time. Players who trust the ping "land" on nothing and keep sinking.
* **The lamp blinds you.** Backscatter turns the headlamp into a wall of bright, dithered fog three metres from the viewport. Inside the Layer you see better with the lamp *off*, or on red.
* **Touch sets off alarms.** Brushing animals in the Layer triggers **burglar-alarm cascades**, modelled on the real behaviour of jellyfish that flash to summon a bigger predator onto whatever is touching them. Each contact sends a ring of palette-cycled light rippling outward at 12 m/s for 80 m. Anything that hunts by light comes to look.
* **The Layer moves.** It runs on a diel cycle against a compressed 24-minute dive-clock "day", rising 300 m during the "night" half. Players learn to time their crossings like tides.

*Deeper:* below 560 m the Phantom Floor never quite leaves. Its migrants drift down past you as falling curtains of dying animals, and false sonar returns become rarer but sharper. By Act III a false return is so rare that the player trusts the sonar completely. That is exactly when the Mimic (§3.5) starts to exploit it.

#### Hazard II: The Slow Wave (900–1,300 m, the SOFAR band)

*Real-world anchor:* where layers of water of different density meet, **internal waves** can run hundreds of metres tall and take minutes to pass. You can't see them from the surface, and they are strong enough to drag a submarine down. This depth band is also the **SOFAR channel**, a natural acoustic waveguide in which low-frequency sound can carry for thousands of kilometres.

* **The wave.** An internal wave with a period of about four minutes and an amplitude of up to 180 m rolls through the open water column. You can only see it in the marine snow.
  * All five particle parallax layers stop falling and start to *shear*. The near layers slide one way and the far layers the other, as if the screen were being wrung out like a cloth.
  * The depth needle "breathes".
  * The hull gives a low structural groan.
* **The trough.** If the trough catches you, it carries you *down* 100–180 m in about sixty seconds without any input of your own, past your hull rating.
  * You can fight it with thrust, which is loud.
  * You can ride it with silent trim and hope.
  * The only real counter is to **anchor**, and the midwater offers almost nothing to anchor to.
* **The channel.** Inside the SOFAR band, sound does not fade.
  * A wide ping's aggro radius jumps from 30 m to **300 m**.
  * Passive listening picks up things kilometres away, some of which have been listening for a very long time.
  * Something on the far side of the channel answers your pings. It answers late, and in your rhythm.

*Deeper:* the Slow Wave causes the game's central event, the hull breach at 1,140 m (§5.3). Below the band, waves are rare, but each one is bigger.

#### Hazard III: The Settling (3,000 m and below)

*Real-world anchor:* almost none, and that's the point. This is where the anomaly stops pretending to be oceanography. Sediment normally settles in layers, each one a slice of time. On the Benthic Plain the layers have collapsed into one.

* **Pre-echo.** Sound arrives *before* its source.
  * **Creatures:** an attack cue plays up to 1.5 s ahead of the attack. That reads as a gift until the player learns that one pre-echo in four belongs to an event that *never happens*, because it comes from a branch that sank somewhere else.
  * **Mara:** the game plays her own thruster ignition about 400 ms before the player presses the trigger, using an input predictor trained on the last ten minutes of play. When the predictor is wrong, you hear the version of you that *did* fire.
* **Compression.** For every 250 m below 3,000 m, the world loses information:
  * **Palette:** the world palette sheds two colours.
  * **Audio:** the master bus drops a sample-rate step, from 44.1 kHz to 22, then 11, then 6 kHz.
  * **HUD:** the depth readout rounds to tens, then hundreds, then thousands, and finally shows only the word `DEEP`.
* **Brine lakes.** Hypersaline lakes lie *on* the seafloor, with shorelines and slow waves of their own.
  * They are dense enough that you float on top of them.
  * Nothing that falls through the surface survives.
  * They preserve everything perfectly: whatever ever drowned in one is still there, intact, under a mirror.

*Deeper:* there is no deeper. At 4,190 m the Settling is total, and that is where the Archive is.

**Depth reference**

| Depth | Zone | Hazard | World palette | Master audio | Comms latency (one way) |
|---|---|---|---|---|---|
| 0–200 m | The Sunlit Wall | None | 32 colours, caustics | 44.1 kHz | 0–0.13 s |
| 200–1,000 m | The Twilight Shelf | Phantom Floor | 24 → 16 | 44.1 kHz, low-pass tightening | 0.13–0.67 s |
| 1,000–2,904 m | The Mid-Water Zone | Slow Wave / SOFAR | 16 → 10 | 44.1 kHz, no early reflections | 0.67 s at 1,000 m, then **negative after 1,140 m** |
| 3,000–4,190 m | The Benthic Plain | The Settling | 10 → 2 | 22 → 6 kHz, then 16 → 4-bit | None. Nobody is listening. |

### 1.4 Horror Philosophy: Lossy Horror

The horror in *Benthos* is not cosmic: nothing in the Asher Deep is a god, and nothing in it wants you. It isn't purely biological either, though every creature is a plausible branch of evolution. Nor is it purely psychological, though the HUD will lie to you for hours. We call the source of the dread **lossy horror**: the fear of being *approximated*.

The Trench does not destroy what falls into it. It **compresses** it, the way a codec compresses an image: it keeps the broad shape, throws away the detail, and rounds every colour to the nearest one it has. The fear isn't that you'll die down there. The fear is that something will come back up that is *almost you*, and nobody will notice the difference. Your handler won't, your company won't, and eventually you won't either.

The dread is delivered in three layers:

| Layer | Fear | Delivered by |
|---|---|---|
| **Biological** (the body) | Being eaten by things that are better at this place than you | The four creatures (§3); the hull, breath and biomass systems |
| **Psychological** (the mind) | Your instruments, your eyes and your handler can't be trusted | The lying Lung Cluster, pre-echo, the Second Diver, comms that drift out of sync |
| **Informational** (the self) | Being reduced to a summary of yourself | Fidelity (§2.2.3), the coarsening diver sprite, the flipped sprite, the Archive |

The ocean in this game is not hostile. It is *thorough*. Every system is tuned to make the player feel the slow, administrative indifference of four kilometres of water filing them away. There are no conventional jump scares: no musical stingers, no faces lunging at the lens. The worst moments in *Benthos* are quiet ones. One is noticing that your heart rate has read exactly 72 for an hour. Another is hearing your supervisor laugh, over the comms, at a joke you didn't make.

### 1.5 Pixel Narrative: Why This Has to Be Pixel Art

Pixel art is lossy compression of the world, so *Benthos* uses it because pixel art is how the Trench sees you, not out of nostalgia. Every pixel rule below is also a story rule.

* **The two grids diverge.** As the player descends, the world and the diver stop sharing a resolution.
  * **The Trench gets finer.** Anomalous geometry (the Archive, the Ostinato structure, rock in the Settling) is authored at **2× texel density**, as if for a 960×540 screen. It is drawn into the 480×270 buffer with nearest-neighbour sampling and no prefilter, so it **aliases**: those surfaces crawl with moiré whenever the camera moves. The detail exists, but your screen can't hold it, and neither can your eyes.
  * **The diver gets coarser.** Mara's sprite steps down through three hand-redrawn resolutions:
    * 1×1 art pixels until 1,140 m
    * 2×2 art pixels after the breach
    * 3×3 on the Benthic Plain

    Each step is a new sprite sheet, not a resize, so she reads as *less information* rather than as blurry. The world becomes too detailed to perceive while you become too simple to matter. That is the loss of human scale, drawn in both directions at once.
* **Palette death follows physics.** Light in water dies in order: red, then orange, yellow and green, until only blue remains.
  * The world palette follows that curve, using Beer–Lambert absorption (§4.2).
  * By 600 m nothing outside your lamp is red, so blood reads as black until your light touches it.
  * The suit's amber HUD is the **last warm colour in the game**: the only warm thing left is the thing counting down how long you have. In Act III even the HUD drifts toward teal.
* **Pixel density is time.** The longer the Trench has held something, the chunkier it is drawn:
  * The 1994 Halvard Four divers use 2×2 art pixels.
  * The 1971 *Thalassa Vigil* crew use 3×3.
  * The oldest objects in the Archive are **single 8×8 blocks of flat colour** that were once whales.

  Players learn to date a corpse by its resolution before any text tells them to.
* **Dither is depth.** Every Z-level below the diver is darkened through a 4×4 Bayer threshold, and the threshold density rises with the metres of water between that level and the camera. Depth is literally drawn as a coarsening dot pattern. On the Benthic Plain the dither stops and darkness becomes flat `#000000`, which reads as an absence of information rather than shadow.
* **Glitches are codec artifacts, never random noise.** The Trench's psychic interference uses the vocabulary of compression:
  * 8×8 **macroblocking**
  * **palette-index errors**, where a pixel shows the right brightness in the wrong colour
  * **scanline tears** along the CRT pass
  * **posterisation** bands

  Each one is the Trench *re-encoding* what you see. They are diegetic and follow rules (§3.5).
* **The flipped sprite.** Mara's suit is asymmetric: the manipulator arm is on the right and the culture tank sits off-centre. Until 1,140 m, all eight of her facing directions are drawn individually. After the breach, the west-facing sprites are quietly replaced by flipped east-facing ones, so the arm is on the wrong side. Almost nobody notices consciously, but everybody feels it: you have become a mirror image of yourself.
* **New Game+ runs at 320×180.** The second descent is subtitled *Second Copy* and renders at a lower internal resolution, with every sprite redrawn to match. You are a copy of a copy, and the game says so in pixels.
* **The single lossless frame.** One ending (§5.5) shows Mara's face at full display resolution for exactly one frame. It is the only image in the game that hasn't been compressed.

> [!NOTE]
> **Design Note: why the pixel narrative creates tension**
> Players read resolution as a promise: crisp means authored and safe, broken means a bug or danger. *Benthos* breaks that promise slowly and on purpose. Nobody can say what's wrong when a sprite drops from 1×1 to 2×2 art pixels, but the brain registers lost detail as lost *self*. Aliasing on anomalous geometry makes the player's own hardware feel inadequate to what is on screen, and that feeling of perceptual insufficiency is the core of deep-sea dread. Every visual degradation follows a rule (depth, time held, or Fidelity), so attentive players can read the art as a diagnostic instrument. That turns paranoia into a skill instead of noise.

---

## 2. Mechanics & Gameplay Loop: *The How*

**Core loop:** *Descend → Listen → Ping (or don't) → Drift → Salvage → Absorb → Repair or upgrade at a Cairn → Descend deeper than your suit is rated for.*

Every pass through the loop trades one scarce thing for another:

* Information costs noise.
* Speed costs breath.
* Survival costs Fidelity.

No action in the deep is free, and no menu pauses the water.

### 2.1 Movement & Physics: A Projectile in a Viscous Medium

Mara doesn't walk. She is **410 kg of titanium, syntactic foam and person**, trimmed to near-neutral buoyancy and pushed through a fluid eight hundred times denser than air. The left stick doesn't set her position. It sets a **thrust vector** for four ducted electric thrusters, and the water decides the rest.

* **The physics model.**
  * The simulation runs at a fixed 60 Hz with semi-implicit Euler integration.
  * Drag is quadratic, `F_drag = −c · |v| · v`. The coefficient is anisotropic: the suit is 2.4× harder to push sideways than forward.
  * Thrust takes 300 ms to spin up and 600 ms to spin down, so every move is a deliberate, heavy glide.

  | Speed | m/s | px/s (12 px/m) | Noise |
  |---|---|---|---|
  | Cruise | 1.6 | 19 | 38 dB |
  | Boost (R2 held) | 3.5 | 42 | 55 dB |
  | Siphon jet (biomass) | 9.0 | 108 | 25 dB |

* **Coasting is silence, and it is the core stealth verb.** Cut the thrusters and Mara keeps her momentum, slowing over about 9 seconds and roughly 8 m from cruise speed. Build speed somewhere safe, cut power, and glide through predator territory with nothing audible but the scrubber fan. Planning momentum is to *Benthos* what taking cover is to a shooter.
* **Trim (the vertical axis).** Depth is set by the variable ballast tank:
  * **R1 floods (sink).** Silent and cheap.
  * **L1 blows (rise).** It hisses at 50 dB and spends compressed air, which is also a crafting resource.

  The asymmetry is the theme: **the Trench makes it easy to go down.**
* **The Pick (anchor-walk).**
  * The right-arm manipulator fires a 12 m Spectra line that anchors to rock, wreck or bone.
  * Reeling in is quiet (a 22 dB electric winch), so Mara can chain *anchor, reel, release, anchor* across surfaces without any thrust at all. This is *Carrion*'s tendril locomotion, recast as industrial equipment.
  * After the breach, the line is quietly replaced by something that *grew*. The Pick can then hold **three anchors at once** and swing between them fluidly, and movement becomes fast, graceful and inhuman. The better you move, the less of you there is.
* **Altitude and the drop shadow.** The isometric camera handles depth the classic way: Mara casts a shadow straight down onto the first solid surface below her. It's a dithered ellipse whose Bayer density falls off with altitude, so you read your height off the floor from how solid your shadow looks.
  * **In the midwater (Act II) nothing lies within 60 m below you, so you have no shadow at all.** The ground is gone, and the game won't tell you how far away it is. This is the moment playtesters describe as the one where they started holding their breath.
* **Collision and impact.**
  * **Hitbox:** a 10×20 px capsule.
  * **Hurtbox:** the same capsule plus the culture tank, a separate 6×8 px rectangle on the back that leaks biomass when hit.
  * **Impact:** striking geometry above 2.5 m/s adds Crush Debt in proportion to the impulse, rings the hull at 70 dB, and kicks up a **silt plume** (§4.3). The plume blocks lamp and sonar for 6–15 s. It can be a smoke screen or a blindfold.
* **Currents.** A per-tile flow field (one vector per 8×8 px cell) pushes the diver around. You can see it in streaming particulate, and hear it as currents whistle through wreck geometry.
* **Sub-pixel rendering.**
  * Positions are stored as floats, and sprites are drawn at integer pixels in the 480×270 buffer.
  * The camera snaps to the diver's rounded position, so she never jitters against the world.
  * The camera's fractional offset is applied *after* upscaling: the final 4× image is shifted by `frac × 4` real pixels. The camera glides smoothly while every art pixel stays perfectly crisp.
* **Haptics.**
  * **Thrust trigger:** DualSense adaptive-trigger resistance rises with depth as the joints stiffen.
  * **Prop spin-up:** a soft buzz in the right grip.
  * **Hull contact:** a single dull knock in the left.

> [!NOTE]
> **Design Note: why inertial movement creates tension**
> Precise movement creates confidence; inertia creates *commitment*. Every burst of thrust is a promise about where you will be in nine seconds, and the Trench has nine seconds to break it. Because stealth is tied to coasting, the safest state is also the least controllable one: to be silent, you have to give up the ability to react. Taking away the drop shadow in the midwater removes the isometric player's most basic sense of where their body is, which produces real vertigo in a 2D game. The post-breach Pick turns progression into dread. The game finally feels as good to control as *Carrion*, and that feeling is the evidence that you are no longer human.

### 2.2 Oxygen, Pressure & Fidelity: Three Gauges, None of Them Honest

HV-0419 is an **atmospheric diving suit**. Mara breathes air at one atmosphere inside it, so the classic diver's dangers of narcosis and decompression sickness don't apply. That's what the brochure says. What does apply is quieter, and worse:

* **CO₂ poisoning:** the scrubber saturates, and the air turns to poison one breath at a time.
* **Hull failure:** four kilometres of water leaning on a shell rated for one.
* **Fidelity:** the Trench filing you away, one colour at a time.

#### 2.2.1 The Lung Cluster (breath)

Breathable gas is shown not as a bar but as an **8×8 cluster of 64 pixels** in the HUD's upper left, drawn like a living culture.

* **Capacity.** Each pixel is about 15 seconds of oxygen at rest, so one O₂ cartridge lasts roughly 16 minutes.
* **Depletion.** The cluster doesn't empty left to right. A CO₂ *stain* spreads in from its edges, turning clean cyan pixels sickly olive and then dead black. It shrinks like a lung collapsing from the outside in.
* **Consumption** scales with exertion and fear:

  | State | Multiplier |
  |---|---|
  | Rest or coast | ×1.0 |
  | Cruise | ×1.3 |
  | Boost | ×2.0 |
  | Panic: predator within 20 m, heart rate above 110 | ×1.8 |
  | Breath control (hold LT) | ×0.6 |

* **Breath control has a price.** While held, the playfield narrows to a vignette dithered inward with blue noise, and a heartbeat thuds on the left haptic motor. You buy air with tunnel vision.
* **The scrubber is a separate consumable.** Soda-lime canisters remove CO₂. Whenever scrubber efficiency drops below 100%, a hidden `PaCO₂` value climbs.
* **The HUD lies because of hypercapnia, not narcosis**, and it lies in stages:

  | PaCO₂ | Stage | What the cluster shows |
  |---|---|---|
  | Above 45 mmHg | **Optimism** | 10–25% more gas than you actually have |
  | Above 55 mmHg | **Migration** | Pixels swap places and drift; the cluster visibly "breathes" |
  | Above 62 mmHg | **Pareidolia** | Pixels form patterns: an eye, the digits `0419`, a face for one frame |
  | Above 70 mmHg | **Reassurance** | **Full**, in perfect clean cyan, while you are minutes from blacking out |

* **The truth costs attention.** An analog needle on Mara's chest never lies. Holding d-pad down zooms the camera to a 4× view of her chest plate for 1.5 seconds. The world keeps running, unwatched, so every check is a gamble.
  * **After the breach, the needle stops moving.** It stays frozen at its 1,140 m reading, because nothing in the suit is breathing any more. The digital cluster keeps draining out of habit.

> [!NOTE]
> **Design Note: why the Lung Cluster creates tension**
> A bar is a contract; the Lung Cluster is a negotiation. Because the HUD's honesty depends on a second resource, the scrubber, the player has to hold a *mental model* of their breath instead of reading it off the screen. That moves the resource into their head, which is where horror lives. The chest gauge turns the truth into a risk/reward decision paid in unwatched seconds. The frozen needle is one of the game's best quiet reveals: an attentive player discovers they are not breathing by checking the one gauge the system taught them to trust.

#### 2.2.2 Crush Debt (pressure)

HV-0419 is rated to **1,100 m** and has been tested to 1,000. Below its rating the suit accrues **Crush Debt**, structural stress that the ocean will eventually collect.

* **Accrual.** Debt grows by `((depth − rating) / 100)^1.5` points per second, plus spikes from impacts, up to a cap of 100.
  * At 1,140 m, every square centimetre of viewport carries the weight of a heavyweight boxer.
  * At 4,190 m, it carries a grand piano.
* **The bezel closes.** Debt isn't shown as a bar. The **playfield itself shrinks**: the suit-telemetry bezel around the 480×270 view pushes inward a row and a column at a time, until at 100 debt the window has lost 40% of its area. The screen is the hull, and the hull is closing.
* **The glass bends.** The CRT shader's barrel curvature flattens as debt rises and then **inverts into pincushion**, so the screen bows *inward* as if something were pressing on the glass.
* **The hull knocks.** At 25, 50 and 75 debt the hull gives a sharp structural tick. Three of them in a row sound exactly like someone knocking politely on the outside of the suit. The right haptic motor knocks along with them.
* **Joints stiffen.** Turn rate drops by up to 35%, and trigger resistance rises.
* **Paying it back:**

  | Method | Effect | Cost |
  |---|---|---|
  | Ascend above the rating | −2 debt per second | Ballast air, and noise |
  | **Brace**: anchor to rock with the Pick and power down | −0.5 debt per second | No lamp, no sonar, no thrust: total blackout |
  | Spend **Graft** biomass | −40 debt instantly | −1 Fidelity, permanently (§2.5) |

* **Failure.** At 100 debt the hull goes: a crack like a gunshot, one white frame, then silence.

> [!NOTE]
> **Design Note: why Crush Debt creates tension**
> A shrinking playfield is claustrophobia you can't look away from, because it eats the very space you use to spot threats. Treating debt as an accumulating *loan* rather than a timer means the player chooses how much to owe. It is always possible to dive below the rating for salvage, so it is always tempting, and every knock is a bill arriving. Paying debt down by bracing requires total sensory blackout in hostile water. That is the game's purest statement of its theme: to survive the pressure, you have to become helpless.

#### 2.2.3 Fidelity (the third pressure)

Fidelity is the number of colours left in Mara's sprite palette. It starts at **16** and can't fall below **3**. The game tracks it from the first minute but **keeps it hidden until the breach**. At that point it appears on the HUD as a thin strip of swatches under the Lung Cluster, and players discover they have *already* been losing it.

* **Fidelity is lost by:**
  * using Graft repairs
  * holding biomass above two-thirds of tank capacity for more than 90 s
  * being stripped by the Grain
  * exposure to anomalies in the Settling
  * dying after the breach
* **How a colour goes.** The lost palette entry merges into its nearest neighbour by CIEDE2000 colour distance, so the sprite *simplifies* rather than corrupts. Cheekbone highlights go first, then the warm skin tone visible through the viewport. The amber of the name stencil goes last.
* **Losing Fidelity isn't purely a penalty:**

  | Fidelity | Effect |
  |---|---|
  | 8 or less | Predators are 30% less likely to detect Mara. She is starting to smell like the Trench. |
  | 5 or less | The Grain treats her as part of the seabed and ignores her. |
  | 4 or less | The HUD renders in 2 colours and starts dropping letters from words. |

* **Fidelity gates the endings.** The *Lossless* ending needs 12 or more. The only way to restore Fidelity is with rare **Lossless Shards** (§2.4).
* **After the breach, failure changes shape.** Every resource still works, but running one out does something different:
  * **Breath at zero no longer kills.** It drains one colour of Fidelity every 45 s.
  * **Crush Debt at 100 no longer kills.** It *recompresses* you: −2 Fidelity and a respawn at the last Cairn.

  The first time a player runs out of air and *doesn't die* is when they start to understand.

> [!NOTE]
> **Design Note: why Fidelity creates tension**
> Fidelity turns the player's identity into a resource they can spend. The central horror question, *how much of yourself will you trade to survive?*, becomes a literal choice made again and again. Low Fidelity also *helps*, through stealth and Grain immunity, so there is a real pull toward self-erasure. The game never punishes that pull outright; it just shows you, in pixels, what you are becoming. Keeping the meter hidden until the breach recasts every earlier Graft and every greedy biomass hoard as a debt the player didn't know they were taking on.

### 2.3 The Echo System: Sonar, Light & Stealth

In the Trench, seeing is broadcasting. Every way of gathering information announces you, so stealth is really an **information economy**: how much do you need to know, and who will hear you finding out?

* **Passive listening (hold L3): free, slow and honest.**
  * **Why it matters:** sound outside the suit is **non-directional** by default. Humans genuinely can't localise sound underwater, because it travels 4.3× faster than in air and the brain loses its interaural timing cues.
  * **What it does:** listening activates the suit's hydrophone array and restores full HRTF directionality. The screen desaturates to the zone's three darkest palette entries. Every sound source within 80 m is drawn as a faint **arc at the edge of the screen**:
    * **thickness** shows loudness
    * **brightness** shows proximity
    * **tremolo** shows creature type
  * **The cost:** thrusters lock out while you listen, so you can only coast.
* **The wide ping (tap R3): three seconds of truth.** The suit emits a pulse that visibly expands at 600 px/s, slowed from physical reality so it reads clearly. Everything within **30 m** is drawn for **3 seconds** into a separate *sonar buffer*:
  * **Creatures,** visible or not, appear as **high-contrast 1-px wireframes**. Each silhouette comes from a Sobel edge pass over the entity's collision mask, drawn in pure `#E8FFF8` on black. It updates at a deliberately choppy **10 fps** so it reads as machine data, not vision.
  * **Terrain** returns as a **dithered point cloud**: one dot per 4×4 cell, brighter where the surface faces the diver.
  * **Hollow objects** such as wrecks, helmets and bells return a double ring, a hint that there's salvage inside.
* **The hull rings: the Echo Trail.** Every ping leaves the titanium shell **ringing** for **10 seconds**. You hear it as a faint 1.1 kHz resonance and see it as a shimmering ribbon. The path Mara travels while ringing becomes an **Echo Trail**: a chain of nodes dropped every 0.25 s, each stamped with a time and a loudness.
  * **Predators that hear the ping** come from within 2× the ping radius: 60 m normally, 300 m in the SOFAR band. They don't go to where you pinged. They **follow the trail node by node**, freshest first.
  * **Damping the ring** is a tactical choice:

    | Method | Effect | Cost |
    |---|---|---|
    | **Clamp** with the Pick | Grounding the hull on rock kills the ring in 2 s | A 48 dB scrape |
    | Enter a **silt plume** | Muffles the trail | You're blind inside it |
    | Spend a **Caul** | Slime absorbs the ring completely | Your lamp scatters and you slow down |
    | **Hold perfectly still** | The trail stops growing | You are sitting on its freshest node |

* **The narrow ping (hold R3, then release): precision at a price.** A 60° cone that reaches **55 m**, with a 2-second reveal and a 6-second ring. It's good for surveying ahead, and dangerous because it tells you nothing about what's behind you.
* **Light.** The headlamp has three modes, cycled with d-pad up:
  * **White:** a 15 m, 50° cone. The best visibility you'll get, and an advertisement.
  * **Red:** 5 m, 70°. Red light dies within metres underwater, and almost nothing down here evolved to see it. The deep-sea dragonfish *Malacosteus* hunts with a red searchlight for exactly this reason. In red mode the world renders in a four-shade red ramp, and you are invisible to every creature in the game except one: the Second Diver (§3.5). It sees what you see, because it is you.
  * **Off:** blind, but not invisible. You still give off scrubber noise and an electrical field.
* **Bioluminescence is data.** Creature light patterns form a language the player can learn:
  * **A slow pulse** means feeding.
  * **A ripple running front to back** means alarm.
  * **A glowing belly** is *counter-illumination*: an animal matching the faint light from above so its silhouette disappears. In the Trench, that means it's hiding from something *below* it.

**Noise reference**

| Action | Noise | Notes |
|---|---|---|
| Coasting | ~0 dB | Scrubber fan only (12 dB, inaudible beyond 4 m) |
| Pick reel-in | 22 dB | |
| Cruise thrust | 38 dB | |
| Biomass absorption | 45 dB | A wet tearing sound |
| Clamp scrape | 48 dB | |
| Ballast blow | 50 dB | |
| Boost thrust | 55 dB | |
| Hull impact above 2.5 m/s | 70 dB | |
| Wide ping | 120 dB at source | Hearing radius 60 m; ×10 in the SOFAR band |
| Powerhead | 130 dB | Draws everything within 200 m |

* **Propagation.** Noise moves across a coarse acoustic grid with per-cell attenuation. Rock **occludes** it and thermoclines **refract** it.
* **Cairns.** Some pockets of geometry sit in **acoustic shadow zones**, where sound physically can't reach. These are the save points, and the only places where crafting is reasonably safe.

> [!NOTE]
> **Design Note: why the Echo System creates tension**
> The ping is the most powerful tool in the game and its most dangerous action. The 3-second reveal against the 10-second ring is the ratio that keeps it that way: **you always owe more time than you bought.** Predators follow the trail rather than homing in on the diver, so every ping becomes a small chase the player can *plan*: ping, move perpendicular to the trail, clamp, and watch the wireframe of the thing that came for you swim through the place you used to be. Non-directional exterior sound keeps the player mildly disoriented all the time, and only active listening cures it. Listening means stopping. Every source of information asks the same question: what will you give up to know?

### 2.4 Salvage & Crafting

There are no shops in the deep, and nothing pauses the water. All crafting is **diegetic and happens in real time.**

* **The Field Fabricator.** It's mounted on Mara's chest and only works while she is clamped to a stable surface with the Pick. While it runs it glows and whines at 40 dB. A job takes 4–20 seconds of real time. The camera stays on the world, and the recipe UI is drawn across her chest plate.
* **Cairns.** You can build anywhere, but the sensible place is a **Cairn**: an acoustic shadow pocket where Mara deploys a Halvard emergency transponder. The transponder records her state (this is the save) and pings the surface.
  * After the breach, the transponders stop reaching the surface. From then on, a Cairn is where the Trench *rebuilds* her.

**Resource classes**

| Class | Examples | Used for |
|---|---|---|
| **Scrap** | Titanium ring stock, syntactic foam, alumina ceramic plate, copper wire, Li-ion cells | Hull rating, thrusters, lamp, sonar |
| **Consumables** | O₂ cartridges, soda-lime canisters, compressed air, flares, powerhead shells (max 3), silt charges | Breath, scrubbing, trim, emergencies |
| **Biological** | Chitin, luciferin sacs, hagfish mucus, siphonophore swimming bells | Biomass strains (§2.5), lures, light |
| **Relics** | Unique objects with lore attached | Passive effects with costs, and story |

**Upgrade tracks**

| Track | Each tier gives | Parts come from |
|---|---|---|
| Hull rating | +250 m (from 1,100 m to 4,350 m over 13 tiers) | Titanium and ceramic stripped from wrecks |
| Scrubber | +20% canister life, slower PaCO₂ climb | Soda lime, copper |
| Thrusters | Shrouded props: −6 dB noise, −8% top speed | Foam, cells |
| Sonar | Ping radius, narrow-cone length, shorter ring | Copper, glass bells, *Magpie-3* parts |
| Pick | Line length; multiple anchors after the breach | Spectra line, then nothing you made |
| Culture tank | +1 biomass cell (from 3 to 5) | Chitin, glass |

* **The Reliquary is a rival collector.** Salvage on the seabed isn't yours until you're holding it. The Reliquary (§3.1) picks up unattended loot and corpses, so a wreck you skip at 600 m may have been picked clean by the time you come back.

**Three relics**

1. **The Second Lung**
   * **What it is:** a rubber rebreather counterlung, cracked and patched with electrical tape, found clipped inside the flooded diving bell *Gannet* at 620 m. Nothing is attached to it, yet it is **still inflating and deflating** on its own, four breaths a minute. The name tape reads `ARNESEN, P.`
   * **What it does:** +20% breath capacity, and it gives back one pixel of gas every 60 s.
   * **What it costs:** it breathes out of time with you. Every 90–180 seconds, at random and sometimes halfway through a stealth crossing, it gives a long, audible **gasp** (34 dB). When the Lung Cluster starts lying, its breaths blend into yours in the mix until you can't tell which are which.
   * **What it means:** Pell Arnesen died in 1994, and something has kept breathing for him for thirty years. It's the first hint that the Trench keeps bodies *running* after the person inside is gone, and it foreshadows the breach.
2. **The Cartographer's Hand**
   * **What it is:** found inside the *Thalassa Vigil*'s crew sphere at 2,200 m. A skeletal human hand has calcified into the steel claw of an early manipulator, still gripping a grease pencil above a slate. The slate holds a hand-drawn map of the Trench, made in total darkness, and it is **accurate**: every wreck, every Cairn, and the Archive are on it.
   * **What it does:** permanently reveals the map of the current act and the location of every Cairn.
   * **What it shows:** at 1,140 m, in grease pencil, there is a small cross labelled **"419"**. The hydrophonist Lena Szabo drew it in 1971.
   * **What it costs:** whenever you open the map, you hear the hand's grip tighten with a dry crackle. Every tenth time, a new mark appears on the slate somewhere you haven't been yet.
   * **What it means:** someone in 1971 knew where you would die. Szabo didn't predict it. The archive is kept in order, not by time, and she read the index.
3. **The Lossless Shard**
   * **What it is:** a palm-sized wedge of viewport acrylic, found in the silt beside the helmet that *Magpie-3* filmed. The HUD labels it automatically: `VIEWPORT FRAGMENT · SERIAL HV-0419 · CONDITION: HISTORICAL`. It is the first of **seven** pieces of that viewport scattered across Acts II and III.
   * **What it does:** hold L2 to look through it. A 64 px circular lens draws the world underneath from a 960×540 buffer, box-filtered down rather than nearest-sampled, with the full palette and every artifact removed.
     * **True sight:** inside the circle, the Mimic, false sonar returns and macroblock faces all disappear, and anomalous geometry resolves instead of aliasing.
     * **Restoration:** a Shard can be consumed at a Cairn for +3 Fidelity.
   * **What it costs:** point the lens at Mara and you see the inside of her helmet. It is empty.
   * **What it means:** this is *your* viewport, the one that cracked at 1,140 m. You are using a piece of your own death to see clearly.

> [!NOTE]
> **Design Note: why salvage and crafting create tension**
> Real-time crafting tied to anchoring turns every upgrade into a vigil: you stand still, glowing and humming, in water that never stops moving. Making the Reliquary a rival collector turns backtracking into loss, so the "I'll come back later" instinct has a price. The relics are built so their benefits are mechanically real and their costs are *psychologically* real: a gasping lung that ruins stealth, a map that keeps drawing, a lens that shows you an empty helmet. The player wants every one of them, and regrets carrying them.

### 2.5 "Carrion" Hybrid Combat: Biomass

Mara is not a warrior. She has no gun, no blade, and no health bar for trading blows. She is a **vessel**. HV-0419 was built as a science suit: there is a specimen **Intake** port on the left wrist and a glass **culture tank** on the back, meant for bringing samples to the surface alive. The Trench teaches her a second use for both.

* **Absorption.** Touch a corpse, or a creature stunned by the Powerhead or an impact, and hold R2. The Intake **absorbs** biomass over 1.2 s.
  * **Cost:** a wet, tearing 45 dB sound, and 1.2 s with your back to the dark.
  * **Feedback:** the culture tank on the diver sprite fills row by row with glowing matter in the source creature's bioluminescent colour.
* **Cells and strains.** The tank holds **3 cells**, upgradable to 5. Each cell holds one **strain**, decided by what you absorbed:

| Strain | Source | Augment | Numbers |
|---|---|---|---|
| **Siphon** (jet burst) | Glass squid, mid-water jet swimmers | Expels biomass as one high-velocity jet. It's far quieter than the thrusters, because biology is better at this than engineering. | +9 m/s impulse over 0.4 s, 25 dB, 8 s cooldown |
| **Caul** (shield bubble) | "Slimewives", hagfish-like scavengers at whale falls | Wraps the suit in a 2.4 m sphere of mucus that expands 10,000×. It absorbs one bite or contact, and the attacker gags and retreats with its gills clogged. It blocks the Grain completely and **kills the Echo Trail**. | 8 s. Lamp scatters (visibility −60%), speed −50% |
| **Bloom** (toxic cloud) | Mourning squid, vampire-squid-like animals | Ejects a 4 m cloud of glowing mucus that lasts 12 s. Light-hunters attack the cloud instead of you, the Grain finds it toxic and scatters, and the Procession *flinches*. | Decoy priority 0.9, 12 s |
| **Graft** (repair) | Any strain, consumed raw | Seals the hull with living tissue. | −40 Crush Debt instantly. **−1 Fidelity, permanently**, and the growth stays visible on the sprite. |

* **The tank is alive.** Biomass isn't inert ammunition.
  * **Overfill:** keep the tank more than two-thirds full for longer than 90 s and its contents begin to **sing**, soft 30 dB pulses that predators can hear.
  * **Growth:** they also begin to **grow** into the suit. This costs Fidelity and draws 1–2 px tendrils across the sprite's shoulder plates.
  * A full tank is power, but it's also a clock: use it, or it uses you.
* **Combinations** reward fluid play in the *Carrion* style:

  | Combination | Result |
  |---|---|
  | **Siphon into a creature** | A ram that stuns it, so you can absorb it |
  | **Bloom inside a Caul** | A glowing lure that is also a trap: any Grain swarm inside dies |
  | **Siphon through a Bloom** | A luminous wake that drags light-hunters off your Echo Trail |

* **Tendril (passive, after the breach).** The culture tank and the Pick fuse, and the manipulator line becomes biological, able to hold three anchors at once (§2.1). Nothing in the crafting menu made this happen, and no menu ever mentions it.
* **The Powerhead.** Mara's only weapon is a **bang stick**: a single-shot cartridge on a pole, a real diver's last resort against sharks.
  * **Ammunition:** three shells for the whole game.
  * **Effect:** a shot stuns or kills anything up to the Reliquary's size.
  * **Cost:** at 130 dB it calls everything within 200 m.

  It is less a weapon than a decision to start a fight with the whole neighbourhood.

> [!NOTE]
> **Design Note: why biomass combat creates tension**
> *Carrion* lets you be the monster and revel in it. *Benthos* hands you that pleasure one cell at a time, then sends the bill. Every strain is an escape tool rather than a damage tool, so encounters are about *getting away well*, not winning. Because the tank is alive, hoarding (the default survival-game instinct) becomes a hazard. Graft is the most tempting button in the game, because it instantly fixes the scariest meter. It's also the most honest one: what it costs is drawn on your body for good. The final revelation (§5.5), that biomass was never augmenting you but *rebuilding* you, retroactively makes every absorption a step toward writing your own replacement.

---

## 3. The Horrors: *The What*

None of these are monsters in the usual sense. Each one started as real deep-sea biology (an isopod, a sleeper shark, a siphonophore, an amphipod) and was then bent by two forces. The first is the ordinary brutality of depth: cold, darkness, starvation and pressure. The second is the Trench's anomaly: **the deep keeps order, not time.**

Every creature is an evolutionary answer to both. Each one also tests a different player skill, and each is drawn with a different animation technique, so no two of them feel as if they belong to the same reality.

| Creature | Archetype | Tests | Animation signature |
|---|---|---|---|
| The Reliquary | Patient scavenger | Resource discipline | A 10 fps hand-drawn body on 60 fps procedural legs |
| The Sleeper | Echo-trail hunter | Trusting sonar and sound over sight | A lagged procedural spine, held "on threes" |
| The Procession | Static ambusher that learns | Reading space; signal discipline | Verlet rope plus palette cycling |
| The Grain | Swarm that denies areas | Spotting broken patterns | No sprites: written straight into the pixel buffer |

*Ambient fauna (glass squid, slimewives, mourning squid, lanternfish, grenadiers) supply biomass and atmosphere and aren't covered here.*

### 3.1 The Reliquary

***Bathynomus custos*** · 380 m to the floor · Acts I–III

**What it looks like**

* **Body:** a giant isopod, essentially a woodlouse the length of a car. It is 4 m long (48×28 px) with fourteen legs and segmented dorsal plates of chalky, bone-white chitin. The chitin uses a 5-step ramp that is never brighter than your lamp makes it.
* **Light:** it has **no bioluminescence of its own**. You only ever see it by reflected light. It wears other things' light.
* **Shell:** its back is a reliquary. It cements salvage to itself with a secretion like pale wax: diving helmets, ROV floats, a ship's bell, porthole rings, a child's shoe. Each helmet is a 10×10 px sub-sprite whose visor catches your headlamp as a single 1-px specular glint, so when it moves through your light it *twinkles*.
* **Eyes:** two broad compound eyes with a reflective tapetum. They flare green-gold, as 3×2 px clusters, whenever your lamp crosses them. Usually the first thing you see is that eyeshine, 14 m out at the very edge of your cone.
* **Pixel density:** the body is drawn at 1×1, but each helmet is drawn at the density of its own era: 2×2 for 1994, 3×3 for 1971. Its back is a collage of incompatible resolutions, and it looks *wrong* before you understand why.

**Behaviour and AI**

It runs on utility AI, scoring four considerations every 0.5 s:

| Consideration | Measures |
|---|---|
| **Weakness** | The inverse of the player's breath, Crush Debt and Fidelity |
| **Patience** | Time since the player last took damage |
| **Proximity** | Distance to the player |
| **Salvage** | Unattended loot within 40 m |

It chooses from five actions:

* **Shadow** (the default). It holds a 25–40 m distance band, moves parallel to the player at matching speed, and stays just beyond the lamp's 15 m reach. Ping and it's there. Ping ten minutes later and it's still there.
* **Collect.** It picks up unattended salvage and corpses, and it's faster at it than you are.
* **Close.** It narrows the gap to 10 m once Weakness passes 0.6.
* **Feed.** It attacks *only* when breath is below 10%, when the player is Tangled or Bracing, or when the player is a corpse. It doesn't hunt. **It waits.**
* **Conglobate.** If it's hit, or held in the white lamp for 3 s, it rolls into an armoured ball and is immune for 6 s.

It ignores pings entirely. It reads distress from the suit's own electrical noise: servo strain, failing cells, the stutter of an overworked scrubber.

It can be *useful*. It leads you toward corpses, and it clears the Grain off the bodies it collects.

**After the breach,** a new helmet sits at the front of its shell like a crown. The stencil reads **HV-0419**.

**Kill state**

* **How:** it can be killed with all three Powerhead shells, by luring it into the Sleeper, or by driving it into a brine lake. It **never fights back** against you.
* **The death:** on the killing blow it curls up for good, and every helmet visor on its back **boots up**, dead HUDs flickering amber one last time. Each shows the depth and time at which its owner died. They go out one at a time over twenty seconds.
* **What spills out:** its hoard. That means relics, logs, and any of your own post-breach helmets it had collected.
* **The cost:**
  * Nothing collects your corpses any more. They stay where they fall and feed the Grain and the Second Diver (§3.5).
  * The Archive at the bottom is left *unfinished*, with gaps in the spiral where its offerings would have gone.
  * You killed the only thing down here that was patient with you.

**Animation and pixel constraints**

* **Body:** hand-drawn frame by frame at **10 fps**, with 8 directions and a 12-frame crawl cycle.
* **Legs:** all fourteen are *procedural*. Each is a two-bone IK chain drawn as a 1-px Bresenham line at the full **60 fps**, and each foot plants on the tile surface with an audible tick. The legs move more smoothly than the body they carry, which produces an uncanny-valley effect players can't name but can't ignore.
* **Helmets:** socketed sub-sprites on verlet springs. They clack together, and the collisions drive the audio.
* **Flipping:** the body is symmetrical and can be sprite-flipped. The helmets never are, so their stencils stay readable, and you can see them reseat when it turns.
* **Lighting:** the helmets carry hand-painted 2D normal maps so the lamp rakes across them correctly.

### 3.2 The Sleeper

***Somniosus tardus*** · 550–2,900 m · Acts I–II · divers call it "Old Lag"

**What it looks like**

* **Body:** a sleeper shark grown to **14 m** (168×40 px, a third of the screen) and more than four hundred years old.
* **Hide:** weathered lead, mottled brown and grey, mapped from a hand-pixelled tiling texture along a procedural spine. It is scarred with pale, coin-sized sucker rings from squid that lost, and lamprey craters that healed badly.
* **Eyes:** blind. Each one is crusted with parasitic copepods trailing pale 6-px streamers, white as dental floss, that stream back along its flanks as it swims.
* **Light:** it makes none of its own. A film of luminous bacteria on its skin gives off scattered 1-px green specks, and before you ever ping it you may notice a loose constellation of green dots drifting in perfect formation. Those dots are its outline.
* **Mouth:** the inside is drawn in flat `#000000`, with no dither. It's the only true black above 3,000 m, the only place the game draws *the absence of information* before Act III.

**The anomaly: lag**

The Sleeper is so old that the Trench has started *filing* it. Its rendered sprite trails its simulated body by **30 frames (500 ms)**, with three afterimages, each one palette step dimmer.

| Channel | Shows |
|---|---|
| **Hitbox** | Where it *is* |
| **Sprite** | Where it *was* |
| **Sound** | Its true position |
| **3-second ping** | Its true position, as a ghostly wireframe *ahead* of the visible body |

Players learn to trust sonar and sound over sight, and to lead their dodges the way a pilot leads a target.

**Behaviour and AI (behaviour tree)**

* **Drift.** Patrols long Catmull-Rom splines at 0.6 m/s, listening.
* **Listen.** Any noise above 35 dB within 60 m (300 m in the SOFAR band) makes it still its tail, glide, and orient toward the sound for 2–4 s.
* **Track.** Follows Echo Trail nodes, freshest first, at 1.4 m/s. If the trail is damped or broken it goes to the last node, searches in an expanding spiral for 12 s, then returns to Drift.
* **Commit.** Within 8 m, with the target in its 60° frontal arc, it lunges at **9 m/s for 1.2 s**. The mouth hitbox is a 24×12 px capsule leading the snout by 12 px.
* **Electroreception.** It detects any *powered* suit within 6 m, whatever the noise level. Passing close to it means **Bracing**: Pick anchored, everything off, no lamp, no sonar, no thrust, in the dark, while 14 m of shark passes close enough to feel through the haptics.

**A bite**, depending on Crush Debt:

* **Above 50:** instant hull failure.
* **Otherwise:** +45 debt, the culture tank ruptures and spills all biomass, and the suit is flung 10 m.

**Kill state**

* **The Powerhead doesn't kill it.** A shot only makes it flinch and withdraw for 30 s.
* **Only the Trench can kill the Sleeper,** in one of two ways:
  1. **The Procession (Act II).** Lure it into the curtain. It tangles, thrashes for two minutes, and is slowly hauled up into the feeding polyps, lighting the colony from the inside.
  2. **The brine lake** on the 2,880 m ledge beside *Magpie-3*. The brine is denser than the shark, so when it hits the surface it *bounces*. It thrashes on top of an underwater lake like a beached animal, suffocating in water with no oxygen.
* **As it dies, the lag closes.** Its sprite slides forward and syncs with its body for the first time. The last thing the Sleeper does is catch up with itself.
* **What remains:**
  * **The corpse** floats pickled on the brine forever. It becomes a landmark and a deep reserve of biomass (ten Graft cells).
  * **The copepods** leave its eyes and swim for your viewport. They cling as pale 1-px specks on the CRT glass layer until you hold the wipe input, which drags Mara's manipulator across the whole screen.

**Animation and pixel constraints**

* **Spine:** a 14-segment verlet chain with angular limits. Each segment draws from a pre-rendered **RotSprite** sheet with 32 angles, so rotation never smears the pixel art.
* **Tail:** a procedural sine wave whose amplitude scales with speed.
* **Frame hold:** the rendered pose updates only every third frame (**on threes**, 20 fps). Combined with the 500 ms lag, it moves with the stately judder of old film against a 60 fps world.
* **The lunge:** a 9-frame **hand-drawn** sequence (4 frames of anticipation, 2 of strike, 3 of follow-through) that plays at full rate *and in sync*. When it commits, it stops lagging. That's how you know.

### 3.3 The Procession

***Praya interminata*** · 1,000–2,600 m · Act II

**What it looks like**

A colonial siphonophore stretched **300 m vertically** through open water: seven and a half screens tall.

* **From far away** (on the farthest parallax layer) it's a vertical line of moving lights, like the lit elevator shaft in a dark tower.
* **Up close it's lace:**
  * **Stem:** a single 1-px translucent line, dithered from near-black and deep teal.
  * **Zooids:** 800–1,200 of them along the stem. The pulsing swimming bells are 3×3 px sprites, with feeding polyps between them.
  * **Fishing tentacles:** 15–20 m long and 1 px wide, drawn at 25% dither density. Beyond 6 m of lamp they're effectively invisible, though a ping draws them in full.
* **At the top** is the **pneumatophore**, a 12×16 px gas float of pale, translucent pink. It's the only pink in Act II.
* **Light:** its photophores fire in waves of cobalt, cyan and white that roll up and down the colony.

**The anomaly: it learns your signals**

It keeps a rolling buffer of your last 16 signal events (ping intervals and lamp toggles) and plays them back as light. The playback escalates:

1. your lamp's flicker
2. the rhythm of a Halvard distress strobe
3. your **heart rate**, read live from the suit's telemetry

**The lure it learns last.** In Act II you steer by *Magpie-3*'s sodium-orange lamp, a pinprick in the black and the only fixed light for 1,900 m. The Procession learns to glow **sodium-orange**, breaking its blue palette to make room for a colour it shouldn't have. Players steer toward the light for ten minutes before they notice that "*Magpie*" is moving up and down.

**Behaviour and AI**

It's a static ambusher that changes posture through utility scoring:

| Posture | Behaviour |
|---|---|
| **Fishing** | Tentacles fully extended: a 20 m curtain on either side |
| **Contracted** | Triggered by vibration above 45 dB or a burglar-alarm flash. The whole colony shrinks to a third of its length in 3 s; its collision volume collapses, then re-expands over 20 s. |
| **Luring** | Replays your patterns while you're within 120 m |
| **Feeding** | Reels Tangled prey up toward the polyps at 0.5 m/s |

**Tangled.** Touching a tentacle locks your movement; rotate the stick to tear free.

* **Each struggle** makes 40 dB of noise.
* **Stinging cells** hammer the suit like hail, adding 2 Crush Debt per second.
* **Reaching the polyps** means a breach. That's digestion.
* **The Sleeper can tangle too.** That's how the player kills it.

**Kill state**

* **The climb:** cutting the pneumatophore means ascending all 300 m of the colony, threading through its curtain in a vertical stealth sequence, and striking the float three times with the Pick.
* **The collapse:** the float deflates and the colony loses its buoyancy. Around a thousand zooids separate and drift outward in every direction, each still glowing, in a slow firework that goes out over 90 seconds.
* **The reveal:** for that minute the midwater is bright enough to see **200 m** in every direction. It's the only time the player sees the true scale of the open water: empty, enormous, and holding silhouettes they never knew were there.
* **What remains:** swimming bells (Siphon biomass) and **glass bells**, a crafting material for sonar upgrades.

**Animation and pixel constraints**

* **Physics:** the colony is a 1,200-particle **verlet rope** covering stem and tentacles. It's solved at 30 Hz with 4 constraint iterations and drawn with 1-px Bresenham lines, and the zooid sprites ride on the rope's nodes.
* **Light waves:** pure **palette cycling**, a 12-entry rotation stepped at 20 Hz, in the tradition of classic hand-tuned colour-cycling art. It costs almost nothing on the GPU and couldn't be faked any other way.
* **Contraction:** an **18-frame hand-keyed curve** drives the procedural stem's rest length. The timing is drawn by hand; the shape is simulated.
* **Orientation:** it's never flipped and never seen from any angle but vertical.

### 3.4 The Grain

***Hirondellea pulvis*** · 2,000 m to the floor · late Act II and Act III

**What it looks like**

A swarm of 2,000–4,000 hadal amphipods, each 3–6 cm long and each drawn as a **single pixel**.

* **In white light:** translucent and two-toned, with bone-white bodies and a faint pink gut.
* **In darkness, invisible by design.** Above 3,000 m, darkness is drawn as a two-colour 4×4 Bayer dither of black and the zone's darkest blue. The Grain occupies the "lit" cells of that pattern, so it *becomes the texture of the dark*.
* **The tell:** you can only see it when the pattern goes wrong:
  * a seam where the Bayer matrix is offset by one pixel
  * a patch of dither drifting against the scroll
  * a region that *crawls*

  Players learn to scan for **dither seams** the way soldiers scan for tripwires.
* **In the lamp** they scatter in a burst of white pixels fleeing the cone, like static clearing from a television channel.

**The anomaly: a codec with mouths**

The Grain strips flesh, and the skeletons it leaves behind are drawn **one resolution step coarser** than the body was. While it feeds, the area around it breaks into 8×8 **macroblocks**. It is the Trench's compression algorithm in animal form.

**Behaviour and AI**

The swarm runs boids (2 px separation, alignment and cohesion) on a spatial hash, plus three rules of its own:

* **Dither-binding.** Each agent snaps to the nearest Bayer cell whose threshold matches the local light level, which keeps the swarm camouflaged.
* **Chemotaxis.** Agents climb a **biomass scent field** that diffuses across the fluid grid. Your culture tank gives off a strong scent; corpses give off a stronger one.
* **Photophobia.** Agents flee any pixel at light band 3 or above.

Swarm states:

| State | Behaviour |
|---|---|
| **Diffuse** | Spread out as dither |
| **Converge** | Contract along the scent gradient. On screen, the dark gets visibly *denser*, a shadow thickening with no source. |
| **Strip** | Each attached agent drains 1 biomass unit per second. Once the tank is empty they attack the seals: +1 Crush Debt per second for every 100 agents, and −1 Fidelity for every 30 s of continuous stripping. |
| **Satiate** | After feeding, disperse for 60 s |

**Counters**

* **Lamp:** they flee it, but it draws everything else.
* **Flares:** a 60 s clear zone.
* **Caul:** blocks them.
* **Bloom:** toxic to them.
* **Silt plumes:** scatter the scent field.
* **Chum:** eject a biomass cell and let them have it.
* **Fidelity 5 or lower:** they stop treating you as food.

**Kill state**

* **You can't kill a swarm,** only disperse it. A Bloom does kill the agents inside it. They fall as a slow rain of dead pixels that drift downward and go dark one by one, like static settling.
* **They leave a hole in the dark.** Where a swarm dispersed, there's pure flat black instead of dither for 60 s. The Grain avoids ground it has already spent, so a patch of *missing* darkness is the safest place to stand in Act III.
* **What remains:** nothing of the Grain itself, only what it leaves behind. Its perfect, coarsened skeletons can be looted for whatever the dead were carrying.

**Animation and pixel constraints**

* **No sprites at all.** A compute pass writes the Grain straight into the pixel buffer at 60 Hz, one pixel per agent.
* **Feeding on Mara:** attached agents *mask out* the diver sprite's pixels and replace them, so the player watches Mara erode into static, pixel by pixel. When the swarm lets go the sprite comes back, minus a colour.
* **The only creature drawn in the screen's own language.** The Grain is the only creature in the game animated entirely in the language of the screen, and the only one that literally turns you into pixels.

### 3.5 The Mimic Phenomenon: The Second Diver

The Trench doesn't just store what sinks into it. Now and then it **decompresses** a copy, and the copy is always slightly wrong. Its most frequent subject is the one it holds the most recent data on: you.

The Mimic isn't a creature with a health bar. It's an environmental condition that escalates across the game, eroding the player's trust first in their eyes, then in their sonar, and finally in their sense of which diver they are.

**How it escalates**

1. **Ghost Frames (Act I).** For exactly **one frame** (16.7 ms), a second diver sprite appears at the edge of the lamp cone, in Mara's *current* pose. Most players never consciously see it. Some get a feeling. A few scrub back through their recordings and post the frame online.
2. **The Second Diver (Act II).** A full copy moves through the water, *replaying your own recorded movement*.
   * **How it works:** the game keeps a **120-second ring buffer**, sampled at 60 Hz, of the player's position, velocity, input bitmask, animation state and lamp mode. When the player enters a cell influenced by the Settling, a copy spawns just outside the camera frustum (plus a 20% margin), shifted to the nearest valid nav position, and plays the buffer back.
   * **Why it's convincing:** it is *your actual behaviour*. It hesitates where you hesitated. It checks its chest gauge. It pings in your rhythm, and its pings lay **real Echo Trails** that predators follow. Sometimes that saves you. Sometimes it brings the Sleeper over to your side of the trench.
   * **Tells, for players who look:**
     * It has no drop shadow.
     * In Act II, it returns no sonar wireframe.
     * Its culture tank glows one palette index off.
     * Within 10 m your breath begins to **flange**: your breathing interferes with a copy of itself running one frame behind, and the result is a comb-filter sweep.
     * It can see your red lamp.
3. **The Forecast (late Act II).** Sometimes the Second Diver replays your *predicted future* instead of your past. The input predictor that drives pre-echo walks it down a route you haven't taken yet, and it dies there, revealing a trap. Players start to **follow their copy**. Then, once, it leads them somewhere it survives and they won't.
4. **Physical (Act III).** The Second Diver gains mass.
   * **What changes:** it casts a shadow and returns sonar. It's assembled from the biomass of your post-breach corpses, and it spawns far more often if the Reliquary is dead and nothing collects them.
   * **How it behaves:** it stops replaying and starts *imitating*. A behaviour model built from your stats drives its ping frequency, preferred lamp mode, coasting habits and favourite anchor surfaces.
   * **What it does to you:** it doesn't bite; it **holds** on. If it grapples Mara for 4 seconds it takes **2 Fidelity**, and your lost colours appear on its sprite.

**Supporting artifacts**

* **Lossy recall.** Areas you backtrack through are *regenerated*. The game downsamples the visited tilemap 4× (essentially the minimap data) and rebuilds it with wave-function collapse, constrained by the zone's tileset. The layout broadly matches but the details don't: a wreck turned 90°, a passage that wasn't there, a Cairn twenty metres from where you left it. **The minimap stays faithful to the original while the world doesn't**, so the mismatch is itself information.
* **Macroblock pareidolia.** At most once every four minutes, and only in cells under the Settling's influence, a **face encoded in 8×8 DCT blocks** appears in the dithered dark at 12% opacity for 6 frames. It's Mara's ID photo from the prologue personnel file, quantised to 4×4 blocks, and it never appears in the same place twice.
* **Phantom contacts.** The HUD minimap shows two diver markers, both labelled `0419`.
* **Sonar spoofing (Act III).** False pings come back showing *your own wireframe* approaching from behind.

**Countermeasures**

| Countermeasure | Works in | Notes |
|---|---|---|
| **The Lossless Shard** (§2.4) | Every act | Truth inside a 64 px circle |
| **Magpie's Eye** | Act III | A tethered camera drone that shows what a machine sees |
| **The ping** | Acts I–II only | |
| **Listening for the flange** | Every act | If you can hear past your own fear |

> [!NOTE]
> **Design Note: why the Mimic creates tension**
> Most horror mimics copy a *shape*. The Second Diver copies *behaviour*, specifically the player's own, and that is the one thing they can't dismiss as "just a monster." Playing back real input data makes the copy hesitate, check gauges and make mistakes exactly as the player does, so on some level the player recognises it as themselves before they consciously know it's there. Each stage takes away one verification tool (eyes, then sonar, then the shadow rule), forcing the player toward the slower, costlier tools: the Shard, the Eye, the flange. Making the copy *helpful* (it reveals traps and draws predators off you) means the player starts to rely on it. Being betrayed by something you've come to trust is the deepest wound horror can deal, and here the thing you trusted is you.

---

## 4. Atmosphere & Audio Design: *The Feel*

At 2,000 metres the water is two degrees above freezing and has never seen the sun. That doesn't make it empty. It's full of falling snow, of animals smaller than your eyelashes, of sound that has been travelling since before you were born. *Benthos* doesn't draw water as a blue tint over a level. It draws water as a medium, with weight, grain, temperature and memory, and every visual and audio system exists to make the player feel it pressing on the glass.

### 4.1 Art Direction

*Benthos* is drawn in **two visual grammars**:

| | Human-made things | Trench things |
|---|---|---|
| **Drawn like** | Diagrams | Flesh |
| **Examples** | Suits, wrecks, Cairn transponders, the HUD | Rock, animals, anomalies |
| **Lines** | Hard 1-px edges | No straight lines |
| **Shading** | Flat 3-step ramps | 5–7-step ramps that shift hue from warm highlights to cool shadows |
| **Detail** | Readable stencils, rivets on an exact grid | Selective outlines (*selout*) one step darker than the local hue |

* **Outlines.** Nothing in the game has a black outline. Bioluminescent things are outlined in their own glow colour.
* **Made or grown.** At a glance you can always tell whether something was *made* or *grown*, until late in Act III, when Mara's own sprite starts drawing in the second grammar.

**What each reference contributes**

* ***Carrion*:** creatures and terrain that react *physically* to touch, procedural bodies, and both the joy and the guilt of consumption.
* ***Hollow Knight*:** layered silhouettes in darkness, a sparse palette pierced by luminous accents, and melancholy built into places instead of spoken aloud.
* ***Subnautica*:** depth as the axis of progression, colour shift as the depth gauge, and beauty that turns into threat as you learn what it means.

**Scale and grid**

* **Projection:** 2:1 dimetric isometric, with 32×16 px floor tiles.
* **Scale:** **12 px = 1 m**, so the 480×270 view covers about 40 × 22 m of world.
* **Mara:** 16×24 px.
* **Z-levels:** 4 m each.
  * **Below the diver**, levels are darkened with depth-dither.
  * **Above the diver**, levels get *screen-door* cutaways: any overhang within 40 px of her drops to 50% Bayer transparency, so she's never hidden.

**Palette**

* **Master palette:** **Halvard-48**. Each zone uses a subset that shrinks with depth (see the depth table in §1.3).
* **HUD:** a four-colour amber ramp (`#2A1A05 · #7A4B0F · #D98E1C · #FFD27A`). It's the warmest thing in the game, and in Act III it slowly gives ground to teal.

**Animation**

* **Simulation:** a fixed 60 Hz.
* **Mara:** authored at **12 fps** (on fives) in 8 directions, with no tweening or smear frames. She should always feel like a machine.
* **Creatures:** each runs at its own rate (§3), so nothing in the Trench shares Mara's tempo.

### 4.2 Lighting

Light in *Benthos* is a substance with a price. It travels badly, it dies by colour, and it announces you to everything that can see.

**The lightmap pipeline**

1. **Shadows.** Occluders come from tile collision. Each light casts shadows using a classic 2D technique: occluders are rendered into a **1D polar shadow map** per light, which is then sampled radially.
2. **Light shapes.** Cones for the headlamp, radial falloffs for bioluminescence, rectangles for wreck lamps.
3. **Water absorption.** Each colour channel is attenuated by the distance the light travels through water, following **Beer–Lambert**: `I_c(d) = I_c(0) · e^(−k_c · d)`.
   * The game uses `k_r = 0.35`, `k_g = 0.07` and `k_b = 0.02` per metre.
   * At 5 m the headlamp keeps 17% of its red; at 15 m, less than 1%.
   * Warmth drains out of the beam along its length, so whatever sits at the edge of your cone is already lit blue-green.
4. **Banding.** Light intensity is quantised into **6 bands**, and the band edges get a **4×4 Bayer ordered dither**. Falloff reads as stippled rings rather than smooth gradients, and that single rule *is* the look of the game.
5. **Palette mapping.** Albedo × light goes through a **32³ 3D LUT** that maps every result into the current zone's palette.

**Light sources**

* **The headlamp** is a cone of high-brightness pixels with a hard, dithered falloff.
  * Its inner 3 m core is near-white with a faint warm cast. Below 600 m, this is the only place red exists.
  * The beam is drawn by marching through particle density. In turbid water it becomes a solid shaft of glittering snow; in the Phantom Floor it becomes a wall.
* **Bioluminescence** is written to a separate emissive buffer.
  * Each glowing creature registers up to 4 point lights, with a budget of 64 dynamic lights on screen.
  * Creature light is **coloured**, and so are its shadows. In a scene lit by a blue Procession and *Magpie-3*'s sodium lamp, every object casts two shadows: an orange one in the blue light and a blue one in the orange.
* **Normal-mapped sprites.** Mara, the wrecks and the Reliquary's helmets carry hand-painted 2D normal maps, quantised to 8 directions, so the lamp rakes properly across rivets and visor glass.

**Darkness**

* **Above 3,000 m, darkness is never black.** It's a two-colour Bayer dither of `#000000` and the zone's darkest blue (`#020814` in Act II), threaded with marine snow.
* **Below 3,000 m the dither stops** and darkness becomes flat `#000000`. Players' eyes register the change as a change in *substance*.

**Caustics**

* **Where:** only in the first 150 m.
* **How:** a procedural Voronoi caustic is computed at **240×135** and upscaled nearest-neighbour, so it falls across the seabed in chunky 2×2 cells and fades with depth.
* **The last flicker,** at 150 m, is the last sunlight the player will ever see.

### 4.3 Water Physics

The water is not a background. It's the most present character in the game, and every system works to make it *visible*.

**Five parallax layers of particulate**

Marine snow is the slow organic rain that feeds the deep: dead plankton and faecal pellets. Here it drifts through five layers between the camera and the seabed:

| Layer | Particle | Count on screen | Behaviour |
|---|---|---|---|
| L0 (farthest) | 1 px, dim | 120 | Barely moves |
| L1 | 1 px | 90 | |
| L2 | 1–2 px | 60 | |
| L3 | 2 px, half-dithered | 30 | |
| L4 (nearest) | 3–4 px out-of-focus discs at 50% Bayer opacity | 10 | Sweeps past the lens fast enough to make you flinch |

* **It always falls,** drifting screen-down in iso space and quietly reinforcing the descent.
* **It bends with the flow field,** and in the Slow Wave the layers shear against one another.
* **It only sparkles where there's light,** so a beam fills up with it while the darkness looks empty.

**Bubbles are physics, not sprites**

Every bubble is a tiny **lens**:

* **Refraction:** it samples the framebuffer behind it with a radial offset and adds a 1-px specular highlight.
* **Motion:** buoyancy accelerates it, it wobbles on a sine, and bubbles merge on contact.
* **Growth:** it swells as it rises, following Boyle's law (`r ∝ (P₀/P)^⅓`).
* **Hydrate skins:** at Act III pressures, methane seep bubbles grow ice-like hydrate shells. They rise as frosted white spheres that don't wobble at all.

**Mara makes no bubbles.** Her suit is a closed system. Every bubble in the game belongs to something else: a seep, the Second Lung, the air still trapped in the *Gannet* bell, and in Act III, things that should not be breathing.

**Silt**

* **Simulation:** a Stam **stable-fluids** solver on a 60×34 grid of 8 px cells tracks silt density and current velocity.
* **Disturbance:** prop wash, impacts and creatures all push silt into it.
* **Rendering:** silt draws as a dithered fog whose Bayer density follows its concentration.
* **Settling:** a plume takes 6–15 s to settle, depending on grain size.

Silt is your smoke screen and your blindfold. On the Benthic Plain it's also a record of everything that has recently passed through.

**Density boundaries**

* **Thermoclines and haloclines** appear as horizontal refractive bands, a 1-px sine displacement per row, like heat haze.
* **Brine-lake surfaces** are **mirrors**. A flipped render of the scene above, with ripple displacement, draws a lake *inside* the sea, with a shoreline and slow waves. Things lie under its surface, perfectly preserved.

### 4.4 The Upscale and CRT Stack

The 480×270 frame is upscaled by an integer factor, then run through a shader stack that treats the screen as the suit's **viewport glass**:

1. **Integer upscale.** 4× gives 1080p and 8× gives 4K. Displays that don't divide evenly (1440p, Steam Deck) get the largest integer fit, followed by a **sharp-bilinear** pass that only interpolates at pixel boundaries.
2. **Emissive bloom.** Bloom applies to the bioluminescence buffer only, so glow bleeds like phosphor and nothing human-made blooms.
3. **Aperture-grille mask** at 18% and **scanlines** at 12%.
4. **Curvature.** 2.5% barrel distortion at rest, inverting to **pincushion** as Crush Debt rises.
5. **Caustic modulation** in the first 150 m (§4.2).
6. **The codec layer.** A corruption mask drives macroblocking, palette-index errors and scanline tears. It follows rules (§1.5, §3.5) and is never random.
7. **Chromatic split.** Every Fidelity loss splits red and blue by 2 px for 8 frames. It's the only time the image comes apart along colour lines.
8. **The glass layer.** A screen-space overlay carries the viewport crack from the breach, the Sleeper's copepods, and condensation creeping in from the corners when the scrubber struggles. The HUD's amber lights this layer, so the glass glows faintly whenever the HUD is busy.

> [!NOTE]
> **Design Note: why the visual system creates tension**
> Dithered banding means light never fades gracefully. It **steps** into darkness, so the player always knows exactly where their knowledge ends. Beer–Lambert colour loss makes the lamp a dying thing even at full charge: everything at the edge of your light is already turning the colour of the water. Two-colour shadows from creature light mean that once you're deep enough to see well, you're seeing by the light of things that eat. And because the CRT is treated as viewport glass, pressure, injury and parasites happen *on the screen itself*, between the player and the world. Nothing is ever truly outside the suit.

### 4.5 Sound Design: The Underwater Filter

Audio in *Benthos* has two worlds and a single membrane between them.

**Inside the suit: dry, close and crisp.** Everything is close-miked, stereo and unfiltered:

* **Breath:** in for four counts and out for six at rest, speeding up as the heart rate climbs.
* **Scrubber:** a 117 Hz fan whir with a bearing tick every 1.3 s.
* **Servos:** a whine at every joint, pitched differently for each limb.
* **The depth relay:** the amber HUD's mechanical relay clicks once per metre of depth. A slow descent sounds like a clock. A fast one sounds like a Geiger counter.

**Outside: the hull transfer chain.** Everything else reaches the player through the suit:

* **Low-pass filter:** 800 Hz (24 dB/oct) near the surface, closing to 400 Hz by 4,000 m.
* **Resonant peaks** at the hull's modal frequencies (180 Hz, 420 Hz and 1.1 kHz). Loud things nearby excite the suit's own resonance, so they sound as if they're *touching* you.
* **Convolution reverb** using procedurally generated impulse responses per zone:
  * **The Shelf:** long, dark and diffuse.
  * **The midwater:** **no early reflections at all.** With no walls to bounce off, the ear hears infinite space.

**Exterior sound is non-directional.** It's mono and centre-panned, because divers really can't localise sound underwater. The hydrophone (§2.3) restores full HRTF, at the price of stopping. Most of the time in *Benthos* you can hear something and can't tell where it is.

**Comms** run over a through-water telephone:

* **Bandwidth:** narrowband (300–3,000 Hz), heavily compressed, on a warbling carrier.
* **Latency:** depth divided by 1,500 m/s, which is 0.67 s each way at 1,000 m and 1.94 s at 2,904 m.
* **Performance:** Tobias's lines are written and recorded *around* the delay. He talks over you, apologises, waits, and gives up halfway through jokes.

**Two bangs.** When the downline snaps in Act I, the player hears the break twice: first through the steel cable, where sound travels at 5,000 m/s, then through the water at 1,500 m/s. It's physically correct, and players feel it in their stomachs.

### 4.6 What Silence Sounds Like

In *Benthos*, silence is a room the size of a bathtub, and you are inside it.

When nothing is near, the exterior bed drops to a very low noise floor and the interior takes over:

* your breath
* the scrubber's 117 Hz whir and its patient bearing tick
* the depth relay counting down
* the **hull settling**: one to three dry thermal *pinks* a minute as the titanium adjusts to the cold and the load
* blood moving in your ears, a soft whoosh at −40 dB that rises with your heart rate
* and from 1,000 m down, under everything, **the Ostinato**

**Danger has no sting.** When something dangerous is close, the exterior bed drops *further*, and the scrubber tick suddenly sounds very loud. Players learn to fear the moment the world gets quieter. Then the 180 Hz hull resonance swells: something large has passed within a metre of the suit.

**The Ostinato** is a 17 Hz pulse in an irregular five-beat pattern: four beats and a hesitation, the rhythm of something counting.

* **The fundamental is inaudible.** Almost no speaker can reproduce 17 Hz.
* **How it's rendered:** only harmonics 2 to 5 are played (34, 51, 68 and 85 Hz). The listener's auditory system reconstructs the missing fundamental, so **the player perceives a 17 Hz pulse that nothing in their room is producing.**
* **Haptics:** where the hardware allows, the controller's low motor pulses at the true 17 Hz.
* **With depth:** the harmonics rise in level.
* **In Act III:** the pattern gains a beat. It's yours.

### 4.7 How Audio Changes With Pressure

| Depth | What you hear |
|---|---|
| **0–200 m** | Open and bright. Swell slaps against the cage. The **Halcyon's engines** are a distant rhythmic thrum, your connection to the ship. Humpbacks sing far off. Snapping shrimp crackle along the wall like frying fat. |
| **200–1,000 m** | The engine thrum fades out at about 300 m. It's **the last human sound that isn't a voice**, and the game lets it go without comment. The low-pass filter tightens. Hull creaks begin. The Phantom Floor hums with a million fins. |
| **1,000–2,904 m** | The SOFAR channel. Distant sounds arrive with uncanny clarity: fin whales thousands of kilometres away, a container ship crossing the Pacific, and once, impossibly, **the Halcyon's engines**. The Ostinato begins as a pulse you feel. Reverb loses its early reflections. |
| **3,000 m+** | **Compression.** The master bus steps down in sample rate (22, then 11, then 6 kHz) and then in bit depth (16, then 8, then 4-bit). This applies to *everything*, including your breath and Tobias. Quantisation noise rises until "silence" **hisses**, the sound of a recording rather than a place. At the Archive, Mara's breathing sounds like an answering-machine tape from 1986. |

**Creature voices**

* **The Reliquary.**
  * Helmets clacking together like wind chimes made of bone.
  * Leg ticks.
  * Its mouthparts make a constant, patient, wet click, like a fingernail tapping on a tooth.
* **The Sleeper.**
  * It has no voice. Its tail sweeps are 40 Hz pressure *whumps* that excite the hull modes and roll through the left motor, and they always play from its **true** position. In this game your ears are more honest than your eyes.
  * When it commits, there's a rush of high-frequency water, the only bright sound it ever makes.
* **The Procession.**
  * Glassy clicks like ice settling in a glass, pitched to its palette cycle.
  * Once it has learned your rhythm, the clicks follow your ping intervals.
  * Late in Act II it plays **the galley waltz** from the prologue, the song that was on the *Halcyon*'s radio when Mara went into the water. The Trench heard it.
* **The Grain.**
  * A dry hiss like a radio between stations, built with **granular synthesis**: the density of grains in the sound follows the density of agents in the swarm. The pun is how the effect actually works.
  * As the swarm converges, a rhythmic chewing texture comes into the hiss.
* **The Second Diver.** Your thrusters and your breath, one frame late. When it's near, your breathing **flanges**.

**Music.** There's no score, only the diegetic waltz and the Ostinato. The single exception is reserved for the Ascent ending.

> [!NOTE]
> **Design Note: why the audio design creates tension**
> Non-directional exterior sound puts the player in the most primal horror state: *I can hear it, and I don't know where it is.* The cure, the hydrophone, means stopping, so information always costs safety. Using quiet instead of stingers as the danger cue trains players to dread silence, which lets the game raise tension just by taking something away. Comms latency turns the only human voice into a constant reminder of distance. Compressing the master bus in Act III makes the player's *own sound world* lossy, so they experience the Trench's central threat through their ears before the story names it. Finally, the missing-fundamental Ostinato is a sound the player's brain is manufacturing for itself. It's the most intimate thing we can do with audio, and it's exactly what the Trench is doing to Mara.

---

## 5. Narrative Structure & Pacing: *The Flow*

The descent is a story told by taking things away. Each act removes one more thing the player relied on, and the pacing follows a pressure curve: long, quiet stretches of drift and salvage, broken by short, violent events that permanently change the rules.

| Act | Depth | Length | Shape | Signature fear |
|---|---|---|---|---|
| **Prologue: Topside** | Deck | 15 min | Walk, listen, suit up | None, and that's the point |
| **Act I: Descent** | 0–1,000 m | ~2.5 h | Walls, ledges, wrecks, the cage | Being hunted |
| **Act II: The Mid-Water Zone** | 1,000–2,904 m | ~3.5 h | Open water: no walls, no floor | Being lost |
| **Act III: The Benthic Plain** | 3,000–4,190 m | ~2.5 h | An impossible plain, brine lakes, the Archive | Being replaced |

### 5.1 Prologue: Topside

The prologue is drawn at **the highest fidelity the game will ever offer**:

* the full Halvard-48 palette
* sub-pixel animation on the crew
* smooth parallax on the swell
* real red: hull paint, Tobias's beanie, a sunrise pushing through the cloud

The player walks the *Halcyon Mercy*'s aft deck, the only time they'll stand on anything. They talk to the crew and read the dossier on the Trench's earlier losses. They watch the eleven seconds, listen to the voice, and suit up. The galley radio plays an old waltz. Tobias makes a joke about the coffee ("only thing on this ship rated to four thousand metres"). Mara doesn't laugh.

**The prologue exists to be lost.** Everything in it is placed so the player can feel it taken away later:

* the colour and the warmth
* the crew
* Tobias's voice without any delay
* ground with a shadow on it
* the waltz
* the joke

### 5.2 Act I: Descent (0–1,000 m)

The cage is lowered down the Trench's west wall, and each stop on the way is a hub. Mara unclips, explores the ledges and wrecks, and comes back so the winch can take her deeper. The act teaches the game's whole vocabulary:

| Depth | Place or event | What it teaches |
|---|---|---|
| 0–200 m | **The Sunlit Wall** | Inertia, trim and coasting. Caustics and colour. |
| 380 m | The Reliquary appears | Being followed. It never really leaves. |
| ~500 m | **The Phantom Floor** | The ping can lie, and the lamp can hurt you. |
| 620 m | **The *Gannet* bell** | The Halvard Four, and the Second Lung |
| 650 m | First Sleeper encounter | The ping draws its wireframe *ahead* of the body you can see. |
| 700 m | A small whale fall | First absorption: a slimewife, which gives a Caul |
| 780 m | **The Cage Fall** | There is no up. |
| 1,000 m | **Midnight Ledge** | The last wall |

**Key narrative beat: the Cage Fall (780 m)**

Mara clips back into the cage after the *Gannet* bell. Over a second of comms delay, the waltz is still faintly audible on Tobias's open mic.

1. **The jerk.** The winch takes up the slack. The cage rises a metre, stops, then **drops**, jerked downward hard enough to slam Mara into the rail.
2. **The warning, late.** Tobias: *"Line tension two tonnes. Three. Mara, get out of the—"*
3. **Two bangs.** One comes down the cable, the other through the water.
4. **The fall.** The downline parts topside and the cage falls. Mara is thrown clear, or climbs clear if the player is quick. Its lights shrink into the black below.
5. **The ping.** If the player pings, the wireframe shows the cage **stop falling** at about 900 m and hang in open water with nothing supporting it. Something is *holding* it.
6. **The promise.** Tobias: *"...We'll rig the backup winch. Eight hours. Get to Magpie. We'll drop a new line on her transponder."*

**Why this breaks the player's sense of safety.** The cage was home: the hub, the elevator, the place where Tobias sounded clearest, the guaranteed way back up. Now there is no way up, only a promise of one, and the next eight hours of play are spent travelling toward the place that promise points to. The suspended cage also plants a question that the midwater will answer.

### 5.3 Act II: The Mid-Water Zone (1,000–2,904 m)

Below Midnight Ledge the walls fall away, and so does the drop shadow. For 1,900 vertical metres there is **nothing to touch**. The only fixed point is *Magpie-3*'s sodium-orange lamp, a pinprick far below. The player navigates by it the way sailors steered by stars, until the Procession learns to imitate it.

Act II is built as a **vertical archipelago**, islands of salvage hanging in the void:

* **Midwater debris.** Wreckage from the Halvard Four's surface support barge, still sinking after thirty years.
* **The *Thalassa Vigil*.** The 1971 bathyscaphe hangs neutrally buoyant at 2,200 m, held up by its intact gasoline float.
  * Its crew sphere is the act's hub Cairn, the only enclosed space in two kilometres of water.
  * The hatch was opened *from the inside*.
  * The Cartographer's Hand is waiting in there.
* **Three Processions.** One of them has to be climbed and cut.
* **The cage, at 1,900 m.** It is tangled in a Procession's curtain. Clipped inside is a body in an HV-series hardsuit, stencilled **HV-0419**.
  * The helmet is intact but packed with silt drawn at 2×2. It's *older* than it should be.
  * The chest HUD is still glowing amber. It reads `780 m · SIGNAL LOST`.
  * It's the Mara who didn't get out of the cage. The game never says so.
* ***Magpie-3*, on its basalt ledge at 2,904 m.** Here Mara finds:
  * the **Wren**
  * the **Magpie's Eye** camera module
  * the **helmet** from the footage, its viewport crazed, lying exactly where it was filmed
  * the first **Lossless Shard**

**Key narrative beat: the Breach (1,140 m)**

Early in the act, inside the SOFAR band, with *Magpie*'s light still below her, **the largest Slow Wave in the game** arrives.

1. **The warning.** The snow layers shear. The depth needle breathes. There's nothing to anchor to.
2. **The trough.** It drags Mara down, and Crush Debt climbs from 0 to 100 in about forty seconds:
   * the bezel slams inward
   * the CRT bows into pincushion
   * three knocks on the hull
3. **The crack.** A fracture overlay spreads across the glass layer pixel by pixel, following a hand-authored crack graph that advances with each hull tick. Tobias shouts warnings that arrive 0.76 s *after* the events they warn about.
4. **The voice.** Mara speaks without any player input, in a voice the player recognises:

   > *"Halcyon, Four-One-Nine. Depth one-one-four-zero. I'm—"*

5. **The death screen.** A crack like a gunshot, one white frame, then black. Then the standard death screen, the same one the player has seen after every death so far: `SIGNAL LOST`, with `RETRY` and `QUIT`.
6. **The choice.** The player presses RETRY.
7. **No load.** There's no fade and no checkpoint. The game simply *resumes*, 260 m deeper:
   * Mara is drifting at 1,400 m.
   * The HUD runs a boot sequence: `HV-0419 · RESTART · VITALS NOMINAL`.
   * Her heart rate reads 72.
   * The chest needle is frozen.
   * A new strip of colour swatches has appeared under the Lung Cluster, and some of them are already gone.
8. **The voice upstairs.** A long silence, then Tobias:

   > *"...Mara? We lost you for six minutes. Telemetry's patchy. Vitals look... fine. Say your depth."*

   She does. **He answers before she finishes.**

If the player chooses QUIT and reloads, the save slot reads `MARA EKDAHL · 1,140 m · SIGNAL LOST`, and loading it resumes at 1,400 m exactly the same way. **No version of the game exists in which Mara survives 1,140 m.**

**Why this breaks the player's sense of safety.** Every game teaches that death is a rewind. *Benthos* keeps that promise for four hours and then breaks it with the player's own button press. The death screen was telling the truth, and the RETRY prompt was the Trench asking permission. Everything after this point is subtly, provably wrong, and players who investigate will find the proof:

* the frozen needle
* the flipped sprite
* the negative comms latency
* a heart rate stuck at 72 bpm
* air that runs out without killing them

**How Act II ends: up is down.** Back at *Magpie-3* with the Wren in hand, Tobias says: *"That's the job. Drop your weights. We'll bring you home."* The player drops ballast, and **the depth gauge climbs**. The ledge gives way. Mara sinks past *Magpie*'s light, down through the 40 m mouth of the inner trench, into a space the sonar measures as **90 kilometres across**.

### 5.4 Act III: The Benthic Plain (3,000–4,190 m)

This is an abyssal plain at the bottom of a trench that is narrower than its own floor. Sonar returns contradict one another. The walls are gone and the horizon is flat in every direction. The Settling begins:

* the palette sheds colours
* audio sheds bits
* the HUD rounds off its own numbers

What's down here:

* **Brine lakes** with mirror surfaces.
* **A whale fall,** with slimewives working it, bubbling slowly in hydrate frost.
* **The hadal lander *Tern-7*** (2009). Its bait cage holds a single hardsuit glove in Mara's size.
* **The Grain,** in its billions.
* **The Second Diver,** which now has mass.
* **The real *Halcyon Mercy*.** For ninety seconds over SOFAR, Tobias can be heard briefing a new diver in suit **HV-0420**. He tells *the same coffee joke*, word for word, and the new diver laughs.

**Key narrative beat: the Machine's Eye**

At the shore of a brine lake, the player deploys *Magpie*'s Eye, a tethered camera they can throw out and look through.

1. **What a machine sees.** The view switches to the ROV's own visual language: **1-bit at 960×540**, in ordered-dithered monochrome. The machine's grid is finer than Mara's, and it has no palette to lie with.
2. **What it shows.** The player turns the camera back toward the shore. HV-0419 stands at the edge of the brine:
   * the viewport is shattered, and the helmet behind it is dark and hollow
   * every seam of the suit is packed with faintly glowing biomass
   * tendrils trail from the culture tank into the silt like roots
3. **The HUD cuts in:** `OPTICAL FAULT · CAMERA DISCARDED`.
4. **The suit acts.** **With no player input**, Mara's arm tears the Eye's tether loose and throws the camera into the brine. It sinks under the mirror with its light on all the way down. This is the only time in the game the player character acts without the player.
5. **Back to normal.** The camera returns to its usual isometric view, and Mara's sprite looks the way it always has at 3×3. Tobias says *"You're doing great, Mara"*, 0.8 seconds before she has said anything at all.

**Why this breaks the player's sense of safety.** The last instrument the player trusted was a machine, and machines have no palette to lie with. The suit (*your* suit, moved by *your* controller) destroyed the evidence. From here on the player is no longer sure who is holding the controller.

### 5.5 The Twist: *The Deep Keeps Order, Not Time*

**The Archive.** At 4,190 m, the source of the Ostinato turns out to be a structure the Reliquaries have been building since before there were humans.

* **What it's made of:** everything that ever sank. Whale bone, hull steel, a bathyscaphe float, the *Gannet*'s winch, all cemented in pale wax into a resonant cathedral that spirals two kilometres across.
* **What it does:** it hums at 17 Hz, and every object in it is one beat of the count.

**What the Wren holds.** Mara slots the Wren into her suit's data port and the footage plays across the HUD. It isn't survey data. It's **72 hours of video**, because the camera kept running after the eleven seconds Tobias showed her. It shows divers arriving at the helmet on the ledge one after another, every one of them in HV-0419, every one of them kneeling to look:

* **Resolution:** some are drawn at 1×1, some at 2×2, some at 3×3.
* **One** is still breathing through a Second Lung.
* **One** has no culture tank.
* **There's one diver for every time the player has died in this save file.** The game logged the position, pose and loadout of every death and replays each one as a figure in the footage. The player watches *their own failures* kneel at their own helmet, in order.
* **Then the footage catches up to now:** Mara herself, approaching the camera, live.
* **And then it keeps going.** It shows a diver who hasn't arrived yet, rendered at **320×180**.

**The revelation, plainly:**

* **The Trench is an archive.** Pressure doesn't destroy things; it **files** them, by order rather than by time. Everything that will ever sink into the Asher Deep is already there.
* **The helmet** in *Magpie*'s footage was Mara's, because she was always going to lose it at 1,140 m. She did.
* **The voice** on the hydrophone was hers, recorded at the moment she died and filed three days before it happened.
* **The Ostinato changed its rhythm 72 hours before she dived** because it had already counted her.
* **Mara Ekdahl died at 1,140 m.** The death screen was the truth.
* **Everything since then has been the Trench decompressing her:** a lossy copy, piloting a ruptured suit and rebuilt from the biomass she absorbed. The *Carrion* mechanic was never an augmentation. **Every cell of biomass was a cell of her replacement**, and the player chose every absorption.
* **The surface has already moved on.** HV-0420 is in the water.
* **The Archive holds one helmet for every death in the save,** laid into the spiral with their stencils facing inward. Their marine-snow lines (§5.6) don't sort by date, and some of Mara's deaths are older than the *Thalassa Vigil*. Order, not time.

**Endings**

1. **ASCENT.** Take the Wren and climb.
   * **The climb.** For the only time in the game, *up works*. Fidelity returns metre by metre: the 3×3 sprite resolves to 2×2 and then 1×1, colours return in the reverse of the order they were lost (red comes back last), and the ship's engine thrum fades in at 300 m.
   * **The music.** The waltz plays clean. It's the game's only non-diegetic music.
   * **The surface.** It's dawn. The crew haul the suit aboard and crack the helmet open. **It's full of silt**, packed into the rough shape of a person.
   * **The last shot.** They upload the Wren, file the claim, and lower HV-0420 over the side. New Game+ begins at 320×180.
2. **SEDIMENT.** Lie down in the Archive.
   * **The fade.** The resolution halves, then halves again: 240×135, 120×68, 30×17, 1×1.
   * **The pixel.** A single blue pixel holds the centre of the screen for sixty seconds of Ostinato. Then the pattern gains a beat, and the pixel blinks with it.
3. **LOSSLESS** (secret). To reach it the player needs:
   * Fidelity of 12 or more
   * all seven Lossless Shards
   * the Reliquary still alive

   What happens:

   * **The ping.** At the centre of the Archive, Mara pings the Ostinato in the rhythm of her own call sign, *four, one, nine*, and writes herself out of the index.
   * **The silence.** The Ostinato stops. For the first time since 1963 the Trench is **silent**. That's the *Silent Pressure* of the title.
   * **The face.** Mara's sprite renders at full display resolution for exactly one frame, a face with its eyes open, at peace. Then black.
   * **The epilogue.** A Halvard hydrophone log reads `OSTINATO CEASED · 06:14`, followed by an internal memo: `HV PROGRAMME SUSPENDED · HV-0420 STANDS DOWN`. Nobody on the ship remembers why they were worried. Mara is forgotten, but nobody else will have to be.

### 5.6 Environmental Storytelling

The pixel art is the Archive's catalogue. Every corpse is labelled in a visual language the player learns without being taught.

**Resolution dates the dead**

| Loss | Year | Art pixels |
|---|---|---|
| The Halvard Four | 1994 | 2×2 |
| The *Thalassa Vigil* crew | 1971 | 3×3 |
| Whales and older | Older | 4×4 and up |
| The oldest objects in the Archive | Unknown | Single 8×8 blocks |

As Mara coarsens, she joins the same timeline as the dead.

**Dead palettes.** Corpses and abandoned suits are drawn in 4-colour ramps that *don't belong to the zone*. Each ramp comes from the film stock of its era:

* **1971:** faded Ektachrome magenta and cyan.
* **1994:** the bleeding reds and greens of VHS.

These ramps are **excluded from the lighting LUT**. They glow at a constant dim level that ignores your lamp and look as if they were pasted in from somewhere else, which they were: they've been *filed*.

**Dead HUDs are still running.** Every lost diver's chest display still glows faint amber with three readings: depth at death, time of death, and last heart rate. To read one you have to kneel over the body and leave yourself exposed.

**Marine-snow lines.** Upper surfaces carry a white line of accumulated snow, one pixel per decade at game scale:

| Object | Snow line |
|---|---|
| The *Gannet* | 3 px |
| The *Thalassa Vigil* | 5 px |
| The helmet beside *Magpie-3* | 0 px |
| Some HV-0419 helmets in the Archive | 8 px, older than anything else down here |

**Scratched text** uses a 3×5 px font with jitter on each glyph, so it reads as cut with a knife:

* on the *Vigil*'s hull: "THE DEEP KEEPS ORDER NOT TIME"
* in the *Gannet* bell, a grease-pencil tally that stops at four, then starts again in a different hand

**The Reliquary is a travelling museum.** Every helmet on its back has a readable stencil, and if it dies, every one comes with a log you can recover.

**Your own corpses.** After the breach, every death leaves Mara's body where it fell. It's drawn in a dead palette, and its chest HUD shows the depth of that death. You can recover the biomass you were carrying, unless the Reliquary gets there first. It collects them, as long as it's alive.

**The title screen is the Archive.** Each death adds a helmet to the seabed behind the logo, so after a long playthrough the title screen is a field of them.

### 5.7 Simulating the Feeling of Being Forgotten

*Benthos* treats *being forgotten* as a system that can be tuned, not just a mood.

**Tobias's form of address decays.** The writing tracks what he calls Mara:

| Point in the game | What Tobias calls her |
|---|---|
| Act I | "Mara" |
| After the Cage Fall | "Ekdahl" |
| After the Breach | "Four-One-Nine" |
| Overheard, late Act II | "the suit" |
| Act III | "the asset" |
| Finally, over SOFAR, to someone else | "HV-0420, you're clear to dive" |

**Latency becomes evidence.** Before the breach, the delay grows with depth exactly as physics says it should. After the breach it goes *negative*: answers arrive before your questions finish, because they come from a recording the Trench already has.

**The save menu forgets her name.** The UI outside the fiction is in on it too:

| Point in the game | Save slot label |
|---|---|
| Start | `MARA EKDAHL` |
| Act II | `MARA EKDA L` |
| Late Act II | `M RA  KD  L` |
| Act III | `419` |
| Last save in Act III | `—` |

**The HUD boot photo.** Every Cairn restore flashes the crew photo taken on deck in the prologue. After the breach, Mara is the first to fade out of it. Later the others are standing differently, as if the photo had been taken again without her.

**Voice logs come back compressed.** Mara can record short voice logs. Later the Trench plays them back to her from somewhere out in the dark, in her voice, at a lower bit depth, with words missing.

**The pause screen.** Pausing freezes the frame, and the frozen image slowly dithers toward black: the longer you're away, the less of the picture remains. Resuming restores it instantly. The game never punishes you for pausing. It just *notices* that you left.

> [!NOTE]
> **Design Note: why the narrative structure creates tension**
> Each act takes one support away from the player. Act I takes *the way home* (the cage). Act II takes *the ground* (no walls, no shadow) and then *life itself* (the Breach). Act III takes *the self* (the Machine's Eye). The Breach comes early in Act II and is never announced, so the player spends hours inside a game they half-suspect is lying to them. That suspicion lasts far longer than any jump scare. Because the twist is built from the player's own data (their deaths, their inputs, their habits), the revelation feels *personal*. Nobody watches a scripted cutscene of a character's failures; each player watches their own.

---

## 6. Marketing Taglines

1. **"The deep doesn't kill you. It keeps you."**
   *Primary line for key art and the store capsule.* It sells the thalassophobia straight away and hides the twist inside a sentence that sounds like a threat. After the credits, players realise it was a literal description of the game.
2. **"Every light you make is a promise to something hungry."**
   *Trailer end card.* It tells the audience the core mechanic, that information costs exposure, in a single sentence, and it pairs naturally with footage of a lone headlamp cone in dithered black and a Sleeper wireframe resolving behind it.
3. **"Four kilometres of water. One lamp. Nobody coming."**
   *Social and launch-week line.* Short and specific, it lists the three things the game takes away: space, light and rescue. It also fits on a single 480×270 frame of the game in the amber HUD font, so the marketing can come from inside the game.

---

## 7. Target Audience Profile

**Primary audience: "the thalassophobic devotee" (ages 22–40)**

* Players who finished *Subnautica* and remember exactly where they were when the ground fell away.
* Players who bought *Iron Lung* because its store page scared them, and who count *SOMA*, *Signalis* and *Inside* among the best horror ever made.
* They value atmosphere over action, systems that mean something, and stories they have to piece together themselves.
* They watch analysis videos after finishing a game. They'll find the flipped sprite, the frozen needle and the negative latency, and they'll post about them.

**Secondary audience: "the pixel-art and movement enthusiast" (ages 18–35)**

* Fans of *Carrion*, *Hollow Knight*, *Celeste* and *Dead Cells* who come for the feel: inertial movement, chained anchor-walking, and post-breach tendril locomotion that rewards mastery.
* They're drawn in by visuals made for GIFs: palette-cycled siphonophores, dithered lightmaps, an amphipod swarm hiding inside the dither pattern.
* Some will stay for horror they didn't know they wanted.

**Tertiary audience: "the deep-sea curious"**

* People who follow ocean-science channels and watch live ROV dive streams.
* *Benthos* is meticulous about its real-world anchors: the Deep Scattering Layer, internal waves, the SOFAR channel, Beer–Lambert light loss, brine pools, whale falls, hagfish slime, amphipod swarms.
* Every creature has a real cousin, and the in-game bestiary links each one to its inspiration.

**Psychographics**

* They tolerate, and seek out, slow-burn tension: sessions of 60–120 minutes, usually at night and on headphones.
* They would rather be outwitted by a system than startled by a script.
* They share what they discover. The game's secrets are designed to be found by communities, not looked up on wikis.

**Platform and pricing**

* **Release order:** PC (Steam) first and Steam Deck Verified (the 320×180 mode is recommended there), then PS5 for adaptive triggers and haptics, then Xbox and Switch 2.
* **Price:** a premium price of about $24.99, with no microtransactions.
* **Length:** 9–11 hours, plus New Game+ (*Second Copy*) and three endings for replay value.

**Content warnings and comfort**

* **Content warnings:** thalassophobia, claustrophobia, body horror, and themes of death and loss of identity.
* **Comfort settings:**
  * **Honest HUD:** turns off the hypercapnia lies without touching the story.
  * **Photosensitivity mode:** replaces white flashes and chromatic splits with fades, and caps how often glitches occur.
  * **Intensity sliders** for low frequencies and haptics.
  * **Full captions with direction tags:** sounds without a direction are captioned `[somewhere]`.
  * **Hold-to-toggle** for every sustained input.
  * **Steady Trim:** an automatic depth-hold assist.
