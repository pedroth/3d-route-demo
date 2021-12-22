import { Vec3 } from "./Vec3.js";

export function clamp(x, xmin, xmax) {
  return Math.max(xmin, Math.min(xmax, x));
}

export const dirac = (i) => (j) => i === j ? 1 : 0;

/**
 *
 * @param {Array3<Vec3>} matrix
 * @param {Vec3} vec3
 * @returns {Vec3}
 */
export function matrixTransposeProd(matrix, vec3) {
  return Vec3(...matrix.map((e) => e.dot(vec3)));
}

/**
 *
 * @param {Array3<Vec3>} matrix
 * @param {Vec3} vec3
 * @returns {Vec3}
 */
export function matrixProd(matrix, vec3) {
  const [x, y, z] = vec3.toArray();
  return matrix[0].scale(x).add(matrix[1].scale(y)).add(matrix[2].scale(z));
}

export class Device {
  constructor() {
    this.pos = Vec3(0, 0, 0);
    this.vel = Vec3(0, 0, 0);
    this.euler = Vec3(0, 0, 0);
    this.eulerSpeed = Vec3(0, 0, 0);
    this.basis = [];
  }

  computeBasisFromEuler() {
    const [alpha, beta, gamma] = this.euler.toArray();
    let ca = Math.cos(alpha);
    let sa = Math.sin(alpha);
    let cb = Math.cos(beta);
    let sb = Math.sin(beta);
    let cg = Math.cos(gamma);
    let sg = Math.sin(gamma);

    // Rz(alpha) * Rx(-beta) * Ry(gamma), where Rx is the x-axis rotation matrix
    // https://en.wikipedia.org/wiki/Euler_angles#Rotation_matrix
    //https://developers.google.com/web/fundamentals/native-hardware/device-orientation
    this.basis[0] = Vec3(
      ca * cg - sa * sb * sg,
      cg * sa + ca * sb * sg,
      -cb * sg
    );
    this.basis[1] = Vec3(-cb * sa, ca * cb, sb);
    this.basis[2] = Vec3(
      ca * sg + cg * sa * sb,
      sa * sg - ca * cg * sb,
      cb * cg
    );
    return this.basis;
  }
}

export class Fifo {
  constructor(n) {
    this.index = 0;
    this.maxSize = n;
    this.buffer = [];
  }

  push(x) {
    this.buffer[this.index] = x;
    this.index = (this.index + 1) % this.maxSize;
  }

  reduce(fold, initial) {
    const n = this.buffer.length;
    if (n === 0) return initial;
    let acc = initial;
    for (let i = 0; i < n; i++) {
      acc = fold(acc, this.buffer[i]);
    }
    return acc;
  }

  getLast() {
    return this.buffer[this.index];
  }
}

/**
 *
 * @param {Vec2} pos
 * @param {Vec2} size
 */
export const LoadingBar = function (pos, size) {
  this.pos = pos;
  this.size = size;
  this.percentFill = 0;
};
