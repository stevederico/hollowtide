import * as THREE from 'three';
import { combine, Eased, lampMaterial, type Area, type Kit, type Site } from '../kit.ts';
import { SEA_HIGH, SEA_LOW } from '../layout.ts';
import { buildMist, buildRocks, buildTerrain, buildTrees, buildWater, FOG_COLOUR, FOG_DENSITY } from '../terrain.ts';
import { buildDock } from './dock.ts';
import { buildEngineHouse } from './engineHouse.ts';
import { buildGarden } from './garden.ts';
import { buildLighthouse } from './lighthouse.ts';
import { buildObservatory } from './observatory.ts';
import { buildPaths, buildPowerLights } from './paths.ts';
import { buildStack } from './stack.ts';
import { buildVaultRock } from './vaultRock.ts';

/** The whole outdoor island as one area. */
export function buildIsland(kit: Kit, glowTex: THREE.Texture): Area {
  const globe = lampMaterial(0xffc27a);
  const windows = lampMaterial(0xffb45e);
  const water = buildWater();
  const mist = buildMist();
  const lights = buildPowerLights();
  const power = new Eased(0, 0.9);
  const tide = new Eased(SEA_HIGH, 0.35);

  const scenery: Site = {
    group: new THREE.Group().add(
      buildTerrain(),
      buildTrees(),
      buildRocks(kit),
      water.mesh,
      mist.group,
      lights.group
    ),
    sync: (state) => {
      power.target = state.powered ? 1 : 0;
      tide.target = state.tide === 'low' ? SEA_LOW : SEA_HIGH;
    },
    update: (dt, time) => {
      const level = power.step(dt);
      const flicker = level < 0.98 && level > 0.02 ? 0.7 + Math.sin(time * 40) * 0.3 : 1;
      globe.emissiveIntensity = level * 3.4 * flicker;
      windows.emissiveIntensity = level * 1.6 * flicker;
      lights.setLevel(level * flicker);
      water.mesh.position.y = tide.step(dt) + Math.sin(time * 0.4) * 0.04;
      water.setTime(time);
      mist.update(time);
    }
  };

  return combine('island', { colour: FOG_COLOUR, density: FOG_DENSITY }, [
    scenery,
    buildPaths(kit, globe),
    buildDock(kit, globe),
    buildEngineHouse(kit, globe, windows),
    buildLighthouse(kit, globe, windows, glowTex),
    buildGarden(kit, globe),
    buildObservatory(kit, globe, windows, glowTex),
    buildVaultRock(kit, glowTex),
    buildStack(kit, glowTex)
  ]);
}
