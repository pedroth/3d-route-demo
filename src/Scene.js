export default class Scene {
  constructor() {
    this.scene = {};
  }

  addElement(elem) {
    const classes = [Line, Path];
    if (!classes.some((c) => elem instanceof c)) return this;
    const { name } = elem;
    this.scene[name] = elem;
    return this;
  }

  clear() {
    this.scene = {};
  }

  getElements() {
    return Object.values(this.scene);
  }
}

class Line {
  /**
   *
   * @param {String} name
   * @param {Vec3} start
   * @param {Vec3} end
   * @param {Array4} color
   */
  constructor(name, start, end, color) {
    this.name = name;
    this.start = start;
    this.end = end;
    this.color = color;
  }

  static builder() {
    return new LineBuilder();
  }
}

class LineBuilder {
  constructor() {
    this._name;
    this._start;
    this._end;
    this._color;
  }

  name(name) {
    this._name = name;
    return this;
  }

  start(start) {
    this._start = start;
    return this;
  }

  end(end) {
    this._end = end;
    return this;
  }

  color(color) {
    this._color = color;
    return this;
  }

  build() {
    const attrs = [this._name, this._start, this._end, this._color];
    if (attrs.some((x) => x === undefined)) {
      throw new Error("Line is incomplete");
    }
    return new Line(...attrs);
  }
}

Scene.Line = Line;

class Path {
  /**
   *
   * @param {String} name
   * @param {Array<Vec3>} path
   * @param {Array4} color
   */
  constructor(name, path, color) {
    this.name = name;
    this.path = path;
    this.color = color;
  }

  static builder() {
    return new PathBuilder();
  }
}

class PathBuilder {
  constructor() {
    this._name;
    this._path;
    this._color;
  }

  name(name) {
    this._name = name;
    return this;
  }

  path(path) {
    this._path = path;
    return this;
  }

  color(color) {
    this._color = color;
    return this;
  }

  build() {
    const attrs = [this._name, this._path, this._color];
    if (attrs.some((x) => x === undefined)) {
      throw new Error("Path is incomplete");
    }
    return new Path(...attrs);
  }
}

Scene.Path = Path;
