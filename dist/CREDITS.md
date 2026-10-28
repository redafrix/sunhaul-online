<!-- SUNHAUL asset and generation credits; external tooling stays outside the repo. -->
# SUNHAUL asset credits

Quaternius models: CC0; pack sources and retained licences are listed in [README.md](README.md).
Painted textures and skies: generated for SUNHAUL (project-owned)
Foliage masks, flow brush normals and surface shaders: authored for SUNHAUL (project-owned).
Scenery LODs: derived from the credited Quaternius CC0 models; artist sources retained in assets/library/.
Little Sun face atlas and flame petals: authored for SUNHAUL by tools/textures/paint-sun.mjs
from the project concept art in art/concepts/sun/sun_design.jpg (project-owned).

| Item | Source | Licence / ownership | Used for |
|---|---|---|---|
| Brann front/back concepts | OpenAI built-in image generation; fallback prompts in `art/concepts/heroes/prompts.md`; director-approved inputs in lane 1 at `art/concepts/heroes/brann/_variants/brann_front.png` and `brann_back.png` | Our generated outputs, allowed by BIBLE §11 | Approved PNGs condition the C1 mesh; worktree JPEGs retain the earlier fallback sheets |
| TRELLIS.2 code and pretrained weights | [Microsoft TRELLIS.2](https://github.com/microsoft/TRELLIS.2), [model](https://huggingface.co/microsoft/TRELLIS.2-4B) | MIT; Microsoft Corporation | Local image-to-3D generation |
| GGUF runtime and quantized TRELLIS.2 weights | [Aero-Ex wrapper](https://github.com/Aero-Ex/ComfyUI-Trellis2-GGUF), [Q4 weights](https://huggingface.co/Aero-Ex/Trellis2-GGUF) | Wrapper retains Microsoft MIT licence; quantized Microsoft weights retain upstream MIT | 512³ generation on the 8 GB GPU |
| DINOv3 ViT-L/16 image feature weights | [Meta DINOv3](https://github.com/facebookresearch/dinov3), [download mirror](https://huggingface.co/Aero-Ex/Dinov3) | [DINOv3 licence](https://github.com/facebookresearch/dinov3/blob/main/LICENSE.md); separate from TRELLIS.2's MIT licence | Local image conditioning; weights are not shipped |
| CuMesh and FlexGEMM | [CuMesh](https://github.com/visualbruno/CuMesh), [FlexGEMM](https://github.com/JeffreyXiang/FlexGEMM) | MIT | Local mesh processing and sparse convolutions |
| O-Voxel | [Microsoft O-Voxel](https://github.com/microsoft/TRELLIS.2/tree/main/o-voxel) | MIT | Mesh/texture decode and GLB export |
| NVIDIA differentiable rendering dependencies and CUDA compiler | [nvdiffrast](https://github.com/NVlabs/nvdiffrast), [nvdiffrec](https://github.com/NVlabs/nvdiffrec), [CUDA redistributables](https://developer.download.nvidia.com/compute/cuda/redist/redistrib_12.8.1.json) | NVIDIA source licences in the linked repositories; CUDA Toolkit licence | Local texture rasterization and sm_89 compilation; dependencies are not shipped |
| ComfyUI support modules | [ComfyUI](https://github.com/comfyanonymous/ComfyUI) | GPL-3.0 | Local wrapper imports only; no ComfyUI server or runtime game dependency |
| Native GGUF tensor operations | [city96 ComfyUI-GGUF](https://github.com/city96/ComfyUI-GGUF) | Apache-2.0 | Local Q4 loading and per-layer dequantization |
| Brann runtime mesh and painted texture | C1b projected TRELLIS.2 mesh from our approved Brann concepts; C2a local Mixamo-named rig | Our generated output; TRELLIS.2 MIT tooling | `assets/characters/brann/brann.glb`, 24,588 triangles, 1.35 m, WebP paint |
| Animations | [Mixamo (Adobe)](https://www.mixamo.com/) | Royalty-free for use in games; not redistributed as raw files | Rest-compensated, in-place hero library in `assets/characters/animations.glb`; separate Creature library for Brutes/bosses |

| Seven C5a heroes and separate equipment | Local TRELLIS.2 from the approved OpenAI hero front/back and equipment sheets in `art/concepts/heroes/`; automatic local rigs | Our generated outputs; TRELLIS.2 MIT tooling | `assets/characters/{mara,ivo,sera,elian,nerali,oren,asha}/` |
| Ivo crane arm | Local TRELLIS.2, crop of the approved Ivo back sheet; source retained as `art/concepts/heroes/ivo/crane-source.jpg` | Our generated output; TRELLIS.2 MIT tooling | Separate spine equipment GLB |
| Oren seed lantern | [Quaternius Fantasy Props MegaKit](https://quaternius.com/packs/fantasypropsmegakit.html), `fantasy/Lantern_Wall`; wall bracket removed, bark/moss recolour and authored emissive seed | Quaternius CC0; authored edits project-owned | `assets/characters/oren/seed_lantern.glb` |
| Eight hero portraits | Rendered locally from the v2 skins with the project painterly material and lighting | Project-owned renders of the credited models | `assets/characters/<id>/portrait.webp`, 512×512 |

Runtime assets are in `assets/characters/`; uncompressed sources and generation work remain in `~/sunhaul-tools/work/`.

### V7 spring-rig test
- `characters/sera_v7/`: BlueGua **Vix**, supplied free FBX/texture package `Vix/Vix/Sources/Vix.fbx` from the V7 local body library. Original creator terms apply; the downloaded package did not include a licence text. Used for the explicitly authorised local V7 test, before SUNHAUL design wrapping. Artist rig and skin weights retained; disconnected scarf ornaments removed. Motion comes from the existing shared Mixamo library above.

- `characters/sera_wrap_v7/`: BlueGua **Taro**, free local package `Taro/Taro/Sources/Taro.fbx` from the V7 body library selected in the V7 plan. Original creator terms apply; the supplied archive contains no licence text. This is the explicitly authorised local wrap test. Artist body topology, UVs and four-influence skin retained; authored tail reposed with its existing rig and coloured to the SUNHAUL palette. Head, boots and cape are rigid references cut from the existing SUNHAUL Sera concept-generated mesh. Not the production hero export. Existing shared Mixamo library supplies motion.

- `characters/mara_split_v7/`: **Character Free Golem Rock** by [OSCAR CREATIVO](https://sketchfab.com/oscar_creativo), [original model](https://sketchfab.com/3d-models/character-free-golem-rock-by-oscar-creativo-9383d3630e2945c5bdac5f7063308037), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Attribution/licence verified from the downloaded GLB's `asset.extras`. Modified rest proportions and positions retain the artist skin; a thin indigo joint underlay supports 17 rigid stone regions cut from the existing SUNHAUL Mara concept mesh, plus a PCA-rigged hanging tabard. New smart-UV colour/normal atlas baked locally. Existing SUNHAUL shield/hammer and shared Mixamo motion reused. Local V7-3 splitter proof, before final V7-4 hero production.

## Jam runtime derivatives (J1)
The three shipped v8 Keepers retain their authored rigs and clips. The release builder derives
Meshopt meshes with WebP paint (512 px), bodies below 12,000 triangles and equipment below
6,000 triangles. Scenery atlases are 256 px; original meshes, textures and credits stay here.

## Camera raycast acceleration (J8)
[three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) by Garrett Johnson, MIT licence.
The release includes the notice at `licenses/three-mesh-bvh/LICENSE`.

## J9 animated Shades · CC BY 4.0

- **Lurker — Nightmare Creature 3#** by Mr.Prizz (https://sketchfab.com/Rodolfoisreal1423). Source: https://sketchfab.com/3d-models/nightmare-creature-3-4b676ea02aba4690801188881d67c034. Licence: CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/). Modified for SUNHAUL: reduced geometry, removed textures/materials and redundant control tracks, selected and renamed animation clips, Meshopt compression, Shade shading.
- **Wisp — Skeleton Dragon** by LivindorCreation (https://sketchfab.com/LivindorCreation). Source: https://sketchfab.com/3d-models/skeleton-dragon-0ae92a30d2c242069acd61ed432f6c32. Licence: CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/). Modified for SUNHAUL: reduced geometry, removed textures/materials and redundant control tracks, selected and renamed animation clips, Meshopt compression, Shade shading.
- **Brute — Low-poly orc** by Riltariki (https://sketchfab.com/Riltariki). Source: https://sketchfab.com/3d-models/low-poly-orc-62f1637181cb4f6aa38897f5b7ab5edf. Licence: CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/). Modified for SUNHAUL: reduced geometry, removed textures/materials and redundant control tracks, selected and renamed animation clips, Meshopt compression, Shade shading.
- **Hound — Four Legged Predator** by Timsblends (https://sketchfab.com/timsblends). Source: https://sketchfab.com/3d-models/four-legged-predator-7f68f9daa698433299092bfecaae4e9e. Licence: CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/). Modified for SUNHAUL: reduced geometry, removed textures/materials and redundant control tracks, selected and renamed animation clips, trimmed exporter holds from attack/run/roar, Meshopt compression, Shade shading.

## The Drowned King — doctorA (CC BY 4.0)
- **WoP - Octopus Pirate King (High Poly)** by [doctorA](https://sketchfab.com/doctorA).
- Source: https://sketchfab.com/3d-models/wop-octopus-pirate-king-high-poly-06034af18d0b4f5fa0d5efdb475b5bb7
- Licence: https://creativecommons.org/licenses/by/4.0/
- Modifications: simplified to under 20,000 triangles, textures resized to 1024 px WebP,
  thirteen selected and renamed motion clips, redundant control tracks removed,
  Meshopt compression, runtime ink rim and gold exposure effect. Artist source is excluded.

## J12 interface typography and pictograms
- **Cinzel** by Natanael Gama; **Nunito** by Vernon Adams, Cyreal and Jacques Le Bailly. SIL Open Font License 1.1. Self-hosted, Latin-subset variable WOFF2 from [Google Fonts](https://github.com/google/fonts). Licences: `fonts/cinzel-OFL.txt`, `fonts/nunito-OFL.txt`.
- **Kenney Game Icons** and **Game Icons Expansion**, [Kenney](https://kenney.nl/assets/game-icons), [expansion](https://kenney.nl/assets/game-icons-expansion), CC0. Downloaded once on 27 October 2026; only used recoloured symbols ship in `ui/icons/`: settings/gear, menu/barsHorizontal, person/singleplayer, plus, star, fist/fightFist, play/forward, howto/question, credits/information, race/flag, survive/power, boss/trophy.
- Supplemental rope, sword, dash, shield, anchor, shield bash, dome, hook, paw, flame-heart, fullscreen corners and Little Sun face SVGs: SUNHAUL project, CC0. These symbols are not included in the two named Kenney packs; they match the plain filled icon treatment.

The landscape web app icons are raster derivatives of the project Little Sun mark (CC0).
