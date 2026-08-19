/** SVG-style affine 2×3 matrix `[a, b, c, d, e, f]`. */
export type Mat2D = readonly [number, number, number, number, number, number];

export const IDENTITY_2D: Mat2D = [1, 0, 0, 1, 0, 0];

/** Compose `left · right` for column-vector affine transforms. */
export function multiply(left: Mat2D, right: Mat2D): Mat2D {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5],
  ];
}

export function translate(x: number, y: number): Mat2D {
  return [1, 0, 0, 1, x, y];
}

export function rotate(degrees: number): Mat2D {
  const radians = (degrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [cosine, sine, -sine, cosine, 0, 0];
}

/** Uniform scale only — non-uniform FK would introduce shear (ADR 0006). */
export function scale(value: number): Mat2D {
  return [value, 0, 0, value, 0, 0];
}

export interface Decomposed2D {
  x: number;
  y: number;
  rotation: number;
  scale: number;
}

/** Decompose a shear-free affine matrix back into node signals. */
export function decompose(matrix: Mat2D): Decomposed2D {
  return {
    x: matrix[4],
    y: matrix[5],
    rotation: (Math.atan2(matrix[1], matrix[0]) * 180) / Math.PI,
    scale: Math.hypot(matrix[0], matrix[1]),
  };
}
