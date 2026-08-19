import {
  decompose,
  multiply,
  rotate,
  scale,
  translate,
  type Decomposed2D,
  type Mat2D,
} from './mat2d.js';

/** A pivot in source-art coordinates plus its rest joint transform. */
export interface RigSlot {
  parent: string | null;
  rest: readonly [number, number];
  rotation?: number;
  scale?: number;
}

export interface OrderedRigSlot extends RigSlot {
  id: string;
}

/** Joint-space values evaluated from pose tracks at one frame. */
export interface JointPose {
  x?: number;
  y?: number;
  rotation?: number;
  scale?: number;
}

export type RigDefinition = Record<string, RigSlot>;
export type RigPose = Record<string, JointPose | undefined>;

/**
 * Compose a topologically ordered FK rig into flat-node world transforms.
 * Interpolation happens before this function, in joint space, so a rotating
 * limb follows an arc rather than a chord (ADR 0006).
 */
export function composeRig(
  rig: RigDefinition | readonly OrderedRigSlot[],
  pose: RigPose,
  artCentre: readonly [number, number] = [0, 0],
): Record<string, Decomposed2D> {
  const matrices: Record<string, Mat2D> = {};
  const rests: Record<string, readonly [number, number]> = {};
  const output: Record<string, Decomposed2D> = {};

  const composeSlot = (slotId: string, slot: RigSlot) => {
    const parent = slot.parent;
    const parentMatrix = parent === null ? undefined : matrices[parent];
    if (parent !== null && parentMatrix === undefined) {
      throw new Error(
        `rig slot "${slotId}" appears before parent "${parent}" — slots must be in topological order`,
      );
    }
    const parentRest = parent === null ? artCentre : rests[parent];
    const joint = pose[slotId] ?? {};
    const offsetX = slot.rest[0] - parentRest[0];
    const offsetY = slot.rest[1] - parentRest[1];

    let local = multiply(
      translate(offsetX, offsetY),
      translate(joint.x ?? 0, joint.y ?? 0),
    );
    local = multiply(
      local,
      rotate((slot.rotation ?? 0) + (joint.rotation ?? 0)),
    );
    local = multiply(local, scale((slot.scale ?? 1) * (joint.scale ?? 1)));
    const world =
      parentMatrix === undefined ? local : multiply(parentMatrix, local);
    matrices[slotId] = world;
    rests[slotId] = slot.rest;
    output[slotId] = decompose(world);
  };

  if (Array.isArray(rig)) {
    for (const slot of rig) composeSlot(slot.id, slot);
  } else {
    for (const [slotId, slot] of Object.entries(rig)) {
      composeSlot(slotId, slot);
    }
  }

  return output;
}
