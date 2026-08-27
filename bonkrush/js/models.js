import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

const ADV =
  "https://cdn.jsdelivr.net/gh/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0@main/addons/kaykit_character_pack_adventures/Characters/gltf/";
const SKEL =
  "https://cdn.jsdelivr.net/gh/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0@main/addons/kaykit_character_pack_skeletons/Characters/gltf/";

export const HERO_MODELS = {
  rook: { file: "Knight.glb", base: ADV, height: 1.92 },
  grom: { file: "Barbarian.glb", base: ADV, height: 2.05 },
  vex: { file: "Mage.glb", base: ADV, height: 1.86 },
  nyla: { file: "Rogue.glb", base: ADV, height: 1.84 },
  kett: { file: "Rogue_Hooded.glb", base: ADV, height: 1.88 },
};

export const ENEMY_MODELS = {
  grunt: { file: "Skeleton_Minion.glb", base: SKEL, height: 1.55 },
  runner: { file: "Skeleton_Rogue.glb", base: SKEL, height: 1.62 },
  tank: { file: "Skeleton_Warrior.glb", base: SKEL, height: 1.95 },
  spitter: { file: "Skeleton_Mage.glb", base: SKEL, height: 1.72 },
  elite: { file: "Skeleton_Warrior.glb", base: SKEL, height: 2.05 },
  swarm: { file: "Skeleton_Minion.glb", base: SKEL, height: 1.05 },
  boss: { file: "Skeleton_Warrior.glb", base: SKEL, height: 2.45 },
};

function localUrl(file) {
  return `./models/${file}`;
}

function pickClip(clips, keys) {
  const lower = clips.map((c) => ({ c, n: c.name.toLowerCase() }));
  for (const key of keys) {
    const hit = lower.find((x) => x.n.includes(key));
    if (hit) return hit.c;
  }
  return clips[0] || null;
}

function fitToHeight(root, height) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.y < 0.01) return;
  const s = height / size.y;
  root.scale.multiplyScalar(s);
  root.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(root);
  root.position.y -= box2.min.y;
}

function collectMats(root) {
  const mats = [];
  root.traverse((n) => {
    if (!n.isMesh) return;
    n.castShadow = true;
    n.receiveShadow = true;
    if (Array.isArray(n.material)) {
      n.material = n.material.map((m) => m.clone());
      mats.push(...n.material);
    } else if (n.material) {
      n.material = n.material.clone();
      mats.push(n.material);
    }
  });
  for (const m of mats) {
    m.userData.baseEmissive = m.emissiveIntensity || 0;
    m.userData.baseEmissiveColor = m.emissive ? m.emissive.clone() : new THREE.Color(0x000000);
  }
  return mats;
}

function findHand(root) {
  let bone = null;
  root.traverse((n) => {
    if (bone || !n.isBone) return;
    const name = n.name.toLowerCase();
    if (/(righthand|hand_r|hand\.r|handslot.*r|weapon.*r|hold\.r)/.test(name)) bone = n;
  });
  if (bone) return bone;
  root.traverse((n) => {
    if (bone || !n.isBone) return;
    if (/hand/.test(n.name.toLowerCase())) bone = n;
  });
  return bone;
}

export class ModelKit {
  constructor() {
    this.loader = new GLTFLoader();
    this.cache = new Map();
    this.loaded = false;
    this.progress = 0;
    this.ready = this.loadAll();
  }

  async loadOne(key, spec) {
    const urls = [localUrl(spec.file), spec.base + spec.file];
    let lastErr;
    for (const url of urls) {
      try {
        const gltf = await this.loader.loadAsync(url);
        this.cache.set(key, {
          scene: gltf.scene,
          clips: gltf.animations || [],
          height: spec.height,
        });
        return;
      } catch (err) {
        lastErr = err;
      }
    }
    console.warn("[BONKRUSH] model miss", key, lastErr);
  }

  async loadAll() {
    const jobs = [];
    for (const [id, spec] of Object.entries(HERO_MODELS)) jobs.push(["hero:" + id, spec]);
    const seen = new Set();
    for (const spec of Object.values(ENEMY_MODELS)) {
      if (seen.has(spec.file)) continue;
      seen.add(spec.file);
      jobs.push(["enemy:" + spec.file, spec]);
    }
    let done = 0;
    await Promise.all(
      jobs.map(async ([key, spec]) => {
        await this.loadOne(key, spec);
        done += 1;
        this.progress = done / jobs.length;
        const el = document.getElementById("boot-fill");
        if (el) el.style.width = `${Math.round(this.progress * 100)}%`;
      })
    );
    this.loaded = true;
    const boot = document.getElementById("boot");
    if (boot) boot.classList.add("hide");
  }

  hasHero(id) {
    return this.cache.has("hero:" + id);
  }

  hasEnemy(file) {
    return this.cache.has("enemy:" + file);
  }

  spawnHero(heroId) {
    const pack = this.cache.get("hero:" + heroId);
    if (!pack) return null;
    return this._instance(pack, 1);
  }

  spawnEnemy(kindId, boss) {
    const spec = boss ? ENEMY_MODELS.boss : ENEMY_MODELS[kindId] || ENEMY_MODELS.grunt;
    const pack = this.cache.get("enemy:" + spec.file);
    if (!pack) return null;
    return this._instance(pack, 1);
  }

  _instance(pack, scaleMul) {
    const model = SkeletonUtils.clone(pack.scene);
    model.traverse((n) => {
      n.frustumCulled = false;
    });
    fitToHeight(model, pack.height * scaleMul);
    const mats = collectMats(model);
    const mixer = new THREE.AnimationMixer(model);
    const idleClip = pickClip(pack.clips, ["idle", "wait", "stand"]);
    const walkClip = pickClip(pack.clips, ["run", "sprint", "jog", "walk", "move"]);
    const atkClip = pickClip(pack.clips, ["attack", "slash", "melee", "hit", "swing"]);
    const idle = idleClip ? mixer.clipAction(idleClip) : null;
    const walk = walkClip ? mixer.clipAction(walkClip) : null;
    const attack = atkClip ? mixer.clipAction(atkClip) : null;
    if (idle) {
      idle.loop = THREE.LoopRepeat;
      idle.play();
    }
    if (walk) {
      walk.loop = THREE.LoopRepeat;
      walk.enabled = true;
      walk.weight = 0;
      walk.play();
    }
    if (attack) {
      attack.setLoop(THREE.LoopOnce, 0);
      attack.clampWhenFinished = true;
    }
    const hand = findHand(model);
    return { model, mixer, idle, walk, attack, mats, hand };
  }

  playMove(ud, moving, dt) {
    if (!ud?.mixer) return;
    ud.mixer.update(dt);
    if (!ud.walk || !ud.idle) return;
    const t = moving ? 1 : 0;
    ud.moveW = ud.moveW == null ? t : ud.moveW + (t - ud.moveW) * Math.min(1, dt * 8);
    ud.walk.setEffectiveWeight(ud.moveW);
    ud.idle.setEffectiveWeight(1 - ud.moveW);
    ud.walk.timeScale = moving ? 1.15 : 1;
  }

  playAttack(ud) {
    if (!ud?.attack) return;
    ud.attack.reset();
    ud.attack.play();
  }

  setFlash(ud, on) {
    if (!ud?.mats) return;
    for (const m of ud.mats) {
      if (on) {
        m.emissive.setHex(0xffffff);
        m.emissiveIntensity = 0.7;
      } else {
        m.emissive.copy(m.userData.baseEmissiveColor);
        m.emissiveIntensity = m.userData.baseEmissive;
      }
    }
  }

  setCharge(ud, amount) {
    if (!ud?.mats) return;
    for (const m of ud.mats) {
      if (amount > 0.04) {
        m.emissive.setHex(0xffaa44);
        m.emissiveIntensity = amount * 0.65;
      } else {
        m.emissive.copy(m.userData.baseEmissiveColor);
        m.emissiveIntensity = m.userData.baseEmissive;
      }
    }
  }
}
