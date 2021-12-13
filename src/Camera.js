import Scene from "./Scene.js";
import { matrixTransposeProd } from "./Utils.js";
import { Vec3, Vec2 } from "./Vec3.js";

export default class Camera {
  /**
   *
   * @param {Number} distanceToPlane
   * @param {Number} alpha radians > 0
   * @param {Vec3} param
   */
  constructor(
    distanceToPlane = 1,
    alpha = Math.PI / 4,
    param = Vec3(2, -Math.PI / 2, Math.PI / 2),
    focalPoint = Vec3(0, 0, 0),
    eye = Vec3(2, 0, 0)
  ) {
    this.distanceToPlane = distanceToPlane;
    this.alpha = alpha;
    // Vec3(rho, theta, phi)
    this.param = param;
    this.focalPoint = focalPoint;
    this.eye = eye;
    this.canvasSize = distanceToPlane * Math.tan(alpha);
  }

  orbit() {
    const [rho, theta, phi] = this.param.toArray();
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const cosP = Math.cos(phi);
    const sinP = Math.sin(phi);

    this.basis = [];
    // z - axis
    this.basis[2] = Vec3(-cosP * cosT, -cosP * sinT, -sinP);
    // y - axis
    this.basis[1] = Vec3(-sinP * cosT, -sinP * sinT, cosP);
    // x -axis
    this.basis[0] = Vec3(-sinT, cosT, 0);

    const sphereCoordinates = Vec3(
      rho * cosP * cosT,
      rho * cosP * sinT,
      rho * sinP
    );
    this.eye = sphereCoordinates.add(this.focalPoint);
    return this;
  }

  sceneShot(scene) {
    return {
      to: (canvas) => {
        canvas.min = Vec2(1, 1).scale(-this.canvasSize);
        canvas.max = Vec2(1, 1).scale(this.canvasSize);
        scene.getElements().forEach((e) => {
          const paintMethodByType = {
            [Scene.Line.name]: drawLine,
            [Scene.Path.name]: drawPath,
          };
          const type = e.constructor.name;
          if (type in paintMethodByType) {
            paintMethodByType[type](e, this, canvas);
          }
        });
        canvas.paint();
        return this;
      },
    };
  }
}

/**
 *
 * @param {Vec3} vertexOut
 * @param {Vec3} vertexIn
 * @param {Camera} camera
 * @returns {Array3}
 */
function intersectImagePlaneInCameraSpace(vertexOut, vertexIn, camera) {
  const { distanceToPlane } = camera;
  const v = vertexOut.sub(vertexIn);
  const alpha = (distanceToPlane - vertexOut.get(2)) / v.get(2);
  const p = vertexOut.add(v.scale(alpha));
  return p.toArray();
}

function drawLine(line, camera, canvas) {
  const { color: rgb } = line;
  const { distanceToPlane } = camera;
  // camera coords
  const cameraLine = [line.start, line.end];
  const start = line.start.sub(camera.eye);
  const end = line.end.sub(camera.eye);
  cameraLine[0] = matrixTransposeProd(camera.basis, start).toArray();
  cameraLine[1] = matrixTransposeProd(camera.basis, end).toArray();

  //frustum culling
  let inFrustum = [];
  let outFrustum = [];
  for (let i = 0; i < cameraLine.length; i++) {
    if (cameraLine[i][2] < distanceToPlane) {
      outFrustum.push(i);
    } else {
      inFrustum.push(i);
    }
  }
  if (outFrustum.length == 2) {
    return;
  }
  if (outFrustum.length == 1) {
    const inVertex = inFrustum[0];
    const outVertex = outFrustum[0];
    const inter = intersectImagePlaneInCameraSpace(
      Vec3(...cameraLine[outVertex]),
      Vec3(...cameraLine[inVertex]),
      camera
    );
    cameraLine[outVertex] = inter;
  }

  //project
  for (let i = 0; i < cameraLine.length; i++) {
    cameraLine[i][0] = (cameraLine[i][0] * distanceToPlane) / cameraLine[i][2];
    cameraLine[i][1] = (cameraLine[i][1] * distanceToPlane) / cameraLine[i][2];
  }
  canvas.drawLine(
    Vec2(cameraLine[0][0], cameraLine[0][1]),
    Vec2(cameraLine[1][0], cameraLine[1][1]),
    rgb
  );
}

function drawPath(path, camera, canvas) {
  const { path: lines } = path;
  for (let i = 0; i < lines.length - 1; i++) {
    const line = Scene.Line.builder()
      .name(`${path.name}_${i}`)
      .start(lines[i])
      .end(lines[i + 1])
      .color(path.color)
      .build();
    drawLine(line, camera, canvas);
  }
}
