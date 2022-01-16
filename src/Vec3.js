/** Dense Vector data structure
 *
 * Immutable class, not managing exceptions
 * For is faster than reduce, forEach, maps, perf here: https://replit.com/@pedroth/forVsForEach#index.js
 * Didn't use private vars because of performance
 */
export default class Vec {
  constructor(array, isValid = false) {
    if (isValid) {
      this._vec = array;
      this._n = this._vec.length;
    } else {
      this._vec = BUILD_VEC(array.length);
      _sanitize_input(array, this._vec);
      this._n = this._vec.length;
    }
  }

  get n() {
    return this._n;
  }

  size = () => this._n;
  shape = () => [this._n];

  clone() {
    return new Vec(COPY_VEC(this._vec), true);
  }

  /**index starts at zero */
  get(i) {
    return this._vec[i];
  }

  toArray() {
    return COPY_VEC(this._vec);
  }

  toString() {
    return "[" + this._vec.join(", ") + "]";
  }

  serialize() {
    return this._vec.join(", ");
  }

  add(y) {
    return this.op(y, (a, b) => a + b);
  }

  sub(y) {
    return this.op(y, (a, b) => a - b);
  }

  mul(y) {
    return this.op(y, (a, b) => a * b);
  }

  div(y) {
    return this.op(y, (a, b) => a / b);
  }

  dot(y) {
    // didn't use reduce because this is faster
    let acc = 0;
    for (let i = 0; i < this._n; i++) {
      acc += this._vec[i] * y._vec[i];
    }
    return acc;
  }

  squareLength() {
    return this.dot(this);
  }

  length() {
    return Math.sqrt(this.dot(this));
  }

  normalize() {
    return this.scale(1 / this.length());
  }

  scale(r) {
    return this.map((z) => z * r);
  }

  map(lambda) {
    const ans = BUILD_VEC(this._n);
    for (let i = 0; i < this._n; i++) {
      ans[i] = lambda(this._vec[i], i);
    }
    return new Vec(ans, true);
  }

  /**
   *
   * @param {*} y: Vec
   * @param {*} operation: (a,b) => op(a,b)
   */
  op(y, operation) {
    sameSizeOrError(this, y);
    const ans = BUILD_VEC(this._n);
    for (let i = 0; i < this._n; i++) {
      ans[i] = operation(this._vec[i], y._vec[i]);
    }
    return new Vec(ans, true);
  }

  reduce(fold, init = 0) {
    let acc = init;
    for (let i = 0; i < this._n; i++) {
      acc = fold(acc, this._vec[i], i);
    }
    return acc;
  }

  fold = this.reduce;
  foldLeft = this.fold;

  equals(y, precision = 1e-5) {
    if (!(y instanceof Vec)) return false;
    return this.sub(y).length() < precision;
  }

  take(n = 0, m = this._vec.length) {
    return new Vec(this._vec.slice(n, m));
  }

  static fromArray(array) {
    return new Vec(array);
  }

  static of(...values) {
    return new Vec(values);
  }

  static ZERO = (n) => new Vec(BUILD_VEC(n), true);
  static e = (n) => (i) => {
    const vec = BUILD_VEC(n);
    if (i >= 0 && i < n) {
      vec[i] = 1;
    }
    return new Vec(vec, true);
  };
}

export const BUILD_VEC = (n) => new ARRAY_TYPES.Float64Array(n);
export const COPY_VEC = (array) => ARRAY_TYPES.Float64Array.from(array);
export class VectorException extends Error {}

const ARRAY_TYPES = {
  Float32Array: Float32Array,
  Float64Array: Float64Array,
};
//stateful function
function _sanitize_input(arrayIn, arrayOut) {
  for (let i = 0; i < arrayIn.length; i++) {
    const z = arrayIn[i];
    const zIsNumber = z !== null && z !== undefined && typeof z === "number";
    arrayOut[i] = zIsNumber ? z : 0;
  }
  return arrayOut;
}

function sameSizeOrError(a, b) {
  if (a.n === b.n) {
    return true;
  }
  throw new VectorException("Vector must have same size");
}

export const Vec3 = (x = 0, y = 0, z = 0) => Vec.of(x, y, z);
export const Vec2 = (x = 0, y = 0) => Vec.of(x, y);
