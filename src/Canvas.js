/*
Canvas coordinates
0            W
+-------------> y
|      
|      
|       *
|
|
v x

H
*/

import { Vec2 } from "./Vec3.js";

export default class Canvas {
  /**
   *
   * @param {HTMLCanvasElement} canvas
   * @param {Vec2} min
   * @param {Vec2} max
   */
  constructor(canvas, min = Vec2(0, 0), max = Vec2(1, 1)) {
    this.canvas = canvas;
    this.ctx = this.canvas.getContext("2d");
    this.image = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );
    this.data = this.image.data;
    this.min = min;
    this.max = max;
  }

  /**
   *
   * @param {Array4} rgba
   * @returns {Canvas}
   */
  fill(rgba = [0, 0, 0, 255]) {
    this.ctx.fillStyle = `rgba(${rgba.join(",")})`;
    this.ctx.globalCompositeOperation = "source-over";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.image = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );
    this.data = this.image.data;
    return this;
  }

  /**
   *
   * @param {Number} x
   * @param {Number} y
   * @returns {Number}
   */
  getImageIndex(x, y) {
    const { width } = this.canvas;
    return 4 * (width * x + y);
  }

  /**
   * Space to Canvas coordinates
   * @param {Number} x
   * @param {Number} y
   * @returns {Vec2}
   */
  canvasTransformInt(x, y) {
    const { width, height } = this.canvas;
    const [xmin, ymin] = this.min.toArray();
    const [xmax, ymax] = this.max.toArray();
    let xint = (-height / (ymax - ymin)) * (y - ymax);
    let yint = (width / (xmax - xmin)) * (x - xmin);
    return Vec2(xint, yint);
  }

  /**
   * Canvas to Space coordinates
   * @param {Number} x
   * @param {Number} y
   * @returns {Vec2}
   */
  canvasTransform(x, y) {
    const { width, height } = this.canvas;
    const [xmin, ymin] = this.min.toArray();
    const [xmax, ymax] = this.max.toArray();
    let xt = xmin + ((xmax - xmin) / width) * y;
    let yt = ymax - ((ymax - ymin) / height) * x;
    return Vec2(xt, yt);
  }

  /**
   *
   * @param {Number} x
   * @param {Number} y
   * @returns {Array4}
   */
  getPxlData(x, y) {
    let rgba = [];
    let index = this.getImageIndex(x, y);
    rgba[0] = this.data[index];
    rgba[1] = this.data[index + 1];
    rgba[2] = this.data[index + 2];
    rgba[3] = this.data[index + 3];
    return rgba;
  }

  /**
   *
   * @param {Number} x
   * @param {Number} y
   * @param {Array4} rgb
   * @returns {Canvas}
   */
  drawPxl(x, y, rgb) {
    let index = this.getImageIndex(x, y);
    this.data[index] = rgb[0];
    this.data[index + 1] = rgb[1];
    this.data[index + 2] = rgb[2];
    this.data[index + 3] = rgb[3];
    return this;
  }

  drawLineIntClipped(x1, x2, rgb) {
    const v = x2.sub(x1);
    const n = v.fold((e, x) => e + Math.abs(x), 0);
    for (let k = 0; k < n; k++) {
      const s = k / n;
      const x = x1.add(v.scale(s)).map(Math.floor);
      const [i, j] = x.toArray();
      this.drawPxl(i, j, rgb);
    }
    return this;
  }

  drawLineInt(x1, x2, rgb) {
    const { width, height } = this.canvas;
    // do clipping
    const stack = [];
    stack.push(x1);
    stack.push(x2);
    const inStack = [];
    const outStack = [];
    for (let i = 0; i < stack.length; i++) {
      const x = stack[i].toArray();
      if (0 <= x[0] && x[0] <= height && 0 <= x[1] && x[1] <= width) {
        inStack.push(Vec2(...x));
      } else {
        outStack.push(Vec2(...x));
      }
    }
    // both points are inside canvas
    if (inStack.length == 2) {
      return this.drawLineIntClipped(inStack[0], inStack[1], rgb);
    }
    //intersecting line with canvas
    const intersectionSolutions = [];
    const v = x2.sub(x1);
    // Let s \in [0,1]
    // line intersection with [0, 0]^T + [H, 0]^T s
    intersectionSolutions.push(
      this.solve2by2UpperTriMatrix(v, -height, x1.scale(-1))
    );
    // line intersection with [H, 0]^T + [0, W]^T s
    intersectionSolutions.push(
      this.solve2by2LowerTriMatrix(
        v,
        -width,
        Vec2(height - x1.get(0), -x1.get(1))
      )
    );
    // line intersection with [H, W]^T + [-H, 0]^T s
    intersectionSolutions.push(
      this.solve2by2UpperTriMatrix(v, height, Vec2(height, width).sub(x1))
    );
    // line intersection with [0, W]^T + [0, -W]^T s
    intersectionSolutions.push(
      this.solve2by2LowerTriMatrix(
        v,
        width,
        Vec2(-x1.get(0), width - x1.get(1))
      )
    );

    const validIntersection = [];
    for (let i = 0; i < intersectionSolutions.length; i++) {
      const x = intersectionSolutions[i].toArray();
      if (0 <= x[0] && x[0] <= 1 && 0 <= x[1] && x[1] <= 1) {
        validIntersection.push(x);
      }
      if (validIntersection.length == 2) {
        const p1 = x1.add(v.scale(validIntersection[0][0]));
        const p2 = x1.add(v.scale(validIntersection[1][0]));
        return this.drawLineIntClipped(p1, p2, rgb);
      }
    }
    if (validIntersection.length == 0) {
      return this;
    }
    //it can be shown that at this point there is only one valid intersection
    const p = x1.add(v.scale(validIntersection[0][0]));
    return this.drawLineIntClipped(inStack.pop(), p, rgb);
  }

  /**
   *
   * @param {Vec2} x1
   * @param {Vec2} x2
   * @param {Array4} rgb
   */
  drawLine(x1, x2, rgb) {
    let x1Int = this.canvasTransformInt(...x1.toArray());
    let x2Int = this.canvasTransformInt(...x2.toArray());
    this.drawLineInt(x1Int, x2Int, rgb);
  }

  /**
   * Paint canvas
   * @returns {Canvas}
   */
  paint() {
    this.ctx.putImageData(this.image, 0, 0);
    return this;
  }

  onMouseDown(mouseDownLambda) {
    const lambda =
      (isMouse = true) =>
      (e) => {
        const mouse = this._getMouseFromEvent(e, isMouse);
        mouseDownLambda(mouse);
      };
    this.canvas.addEventListener("mousedown", lambda(), false);
    this.canvas.addEventListener("touchstart", lambda(false), false);
  }

  onMouseMove(mouseMoveLambda) {
    const lambda =
      (isMouse = true) =>
      (e) => {
        const mouse = this._getMouseFromEvent(e, isMouse);
        mouseMoveLambda(mouse);
      };
    this.canvas.addEventListener("mousemove", lambda(), false);
    this.canvas.addEventListener("touchmove", lambda(false), false);
  }

  onMouseUp(mouseUpLambda) {
    this.canvas.addEventListener("mouseup", mouseUpLambda, false);
    this.canvas.addEventListener("touchend", mouseUpLambda, false);
  }

  onMouseWheel(mouseWheelLambda) {
    this.canvas.addEventListener("wheel", mouseWheelLambda, false);
  }

  /**
   * return solution to : [ u_0 , h] x = z_0
   *
   *					            [ u_1,  0] y = z_1
   */
  /**
   *
   * @param {Vec2} u
   * @param {Number} h
   * @param {Vec2} z
   * @returns {Vec2}
   */
  solve2by2UpperTriMatrix(u, h, z) {
    const [u1, u2] = u.toArray();
    const [z1, z2] = z.toArray();
    const aux = z2 / u2;
    return Vec2(aux, (-u1 * aux + z1) / h);
  }
  /**
   * return solution to : [ u_0 , 0] x = z_0
   *
   *					            [ u_1,  w] y = z_1
   */
  /**
   *
   * @param {Vec2} u
   * @param {Number} w
   * @param {vec2} z
   * @returns {Vec2}
   */
  solve2by2LowerTriMatrix(u, w, z) {
    const [u1, u2] = u.toArray();
    const [z1, z2] = z.toArray();
    const aux = z1 / u1;
    return Vec2(aux, (-u2 * aux + z2) / w);
  }

  _getMouseFromEvent(e, isMouse = true) {
    const { top, left } = this.canvas.getBoundingClientRect();
    const { clientX, clientY } = isMouse ? e : e.touches[0];
    return Vec2(clientY, clientX).sub(Vec2(top, left));
  }
}
