/**
 * Setup
 */
import Camera from "./src/Camera.js";
import Canvas from "./src/Canvas.js";
import Scene from "./src/Scene.js";
import {
  Device,
  dirac,
  matrixProd,
  matrixTransposeProd,
  Fifo,
  LoadingBar,
} from "./src/Utils.js";
import Vec, { Vec2, Vec3 } from "./src/Vec3.js";

//drawing variables
let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");
let tela = new Canvas(canvas);
let scene = new Scene();
let camera = new Camera();

// ui variables
let down = false;
let mouse = Vec2();
let isManual = false;
const isMobile =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
let isWheelUsed = false;

//error correcting variables
let samples = 20;
let accelerationFifo = new Fifo(samples);
let eulerFifo = new Fifo(samples);

// calibration variables
let accelerationCalibration = Vec3();
let eulerCalibration = Vec3();
let calibrationIte = 1;
let isCalibrating = true;
let maxCalibrationTimeInSeconds = 10;
let calibrationLoadingUI;

//app variables
let startTime = new Date().getTime();
let time = 0;
const curve = [];
let minCurve = Vec3(-3, -3, -3);
let maxCurve = Vec3(3, 3, 3);
let myDevice = new Device();
let cube = [
  Vec3(0, 0, 0),
  Vec3(1, 0, 0),
  Vec3(0, 1, 0),
  Vec3(1, 1, 0),
  Vec3(0, 0, 1),
  Vec3(1, 0, 1),
  Vec3(0, 1, 1),
  Vec3(1, 1, 1),
].map((p) => p.mul(Vec3(0.618033, 1, 0.1)));
const centerCube = averageVector(...cube);
cube = cube.map((p) => p.sub(centerCube));
const linesIndexs = [
  [0, 1],
  [0, 2],
  [0, 4],
  [1, 3],
  [1, 5],
  [2, 3],
  [2, 6],
  [3, 7],
  [4, 5],
  [4, 6],
  [5, 7],
  [6, 7],
];

/**
 * Main program
 */

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  tela = new Canvas(canvas);
}

function init() {
  canvas.addEventListener("touchstart", touchStart, false);
  canvas.addEventListener("touchend", touchEnd, false);
  canvas.addEventListener("touchmove", touchMove, false);

  canvas.addEventListener("mousedown", mouseDown, false);
  canvas.addEventListener("mouseup", mouseUp, false);
  canvas.addEventListener("mousemove", mouseMove, false);
  canvas.addEventListener("wheel", mouseWheel, false);

  document.addEventListener("keydown", keyDown, false);

  window.addEventListener("resize", resize);
  resize();

  calibrationLoadingUI = new LoadingBar(
    Vec2(canvas.width / 4, canvas.height / 3),
    Vec2(canvas.width / 2, 25)
  );

  //add device accelerometer  callback ?
  if (window.DeviceMotionEvent != undefined && isMobile) {
    window.addEventListener(
      "devicemotion",
      (e) => {
        accelerationFifo.push(
          Vec3(-e.acceleration.y, -e.acceleration.x, -e.acceleration.z)
        );
        const lastAcceleration =
          accelerationFifo.buffer[accelerationFifo.buffer.length - 1].toArray();
        document.getElementById("accelerationX").innerHTML =
          lastAcceleration[0];
        document.getElementById("accelerationY").innerHTML =
          lastAcceleration[1];
        document.getElementById("accelerationZ").innerHTML =
          lastAcceleration[2];
      },
      true
    );

    window.addEventListener("deviceorientation", (e) => {
      const { alpha, beta, gamma } = e;
      let euler = Vec3(alpha, beta, gamma).map((x) => Math.round(x));
      euler = euler
        .sub(Vec3(0, -180, -90))
        .scale(Math.PI / 180)
        .add(Vec3(0, -Math.PI, -Math.PI / 2));
      eulerFifo.push(euler);
      const [x, y, z] = euler.toArray();
      document.getElementById("alpha").innerHTML = x.toFixed(2);
      document.getElementById("beta").innerHTML = y.toFixed(2);
      document.getElementById("gamma").innerHTML = z.toFixed(2);
    });
  } else {
    document.getElementById("deviceData").style.visibility = "hidden";
  }
}

function keyDown(e) {
  isManual = true;
  const keySpeed = 0.25;
  switch (e.key) {
    case "a":
      eulerFifo.push(averageVectorFifo(eulerFifo).add(Vec3(-keySpeed, 0, 0)));
      break;
    case "d":
      eulerFifo.push(averageVectorFifo(eulerFifo).add(Vec3(keySpeed, 0, 0)));
      break;
    case "w":
      eulerFifo.push(averageVectorFifo(eulerFifo).add(Vec3(0, keySpeed, 0)));
      break;
    case "s":
      eulerFifo.push(averageVectorFifo(eulerFifo).add(Vec3(0, -keySpeed, 0)));
      break;
  }
}

function touchStart(e) {
  const { top, left } = canvas.getBoundingClientRect();
  const { clientX, clientY } = e.touches[0];
  mouse = Vec2(clientY, clientX).sub(Vec2(top, left));
  down = true;
}

function touchEnd() {
  down = false;
}

function touchMove(e) {
  const { top, left } = canvas.getBoundingClientRect();
  const { clientX, clientY } = e.touches[0];
  const newMouse = Vec2(clientY, clientX).sub(Vec2(top, left));

  if (!down || newMouse.equals(mouse)) {
    return;
  }
  const [dx, dy] = newMouse.sub(mouse).toArray();
  camera.param = camera.param.add(
    Vec3(
      0,
      ...Vec2(
        -2 * Math.PI * (dy / canvas.width),
        2 * Math.PI * (dx / canvas.height)
      ).toArray()
    )
  );
  mouse = newMouse;
}

function mouseDown(e) {
  const { top, left } = canvas.getBoundingClientRect();
  const { clientX, clientY } = e;
  mouse = Vec2(clientY, clientX).sub(Vec2(top, left));
  down = true;
}

function mouseUp() {
  down = false;
}

function mouseMove(e) {
  const { top, left } = canvas.getBoundingClientRect();
  const { clientX, clientY } = e;
  const newMouse = Vec2(clientY, clientX).sub(Vec2(top, left));

  if (!down || newMouse.equals(mouse)) {
    return;
  }
  const [dx, dy] = newMouse.sub(mouse).toArray();
  camera.param = camera.param.add(
    Vec3(
      0,
      ...Vec2(
        -2 * Math.PI * (dy / canvas.width),
        2 * Math.PI * (dx / canvas.height)
      ).toArray()
    )
  );
  mouse = newMouse;
}

function mouseWheel(e) {
  camera.param = camera.param.add(Vec3(e.deltaY * 0.01, 0, 0));
  isWheelUsed = true;
}

function averageVectorFifo(fifo) {
  if (!fifo.buffer.length) return Vec3();
  return fifo.reduce((e, x) => e.add(x), Vec3()).scale(1 / fifo.buffer.length);
}

function averageVector(...vec3s) {
  if (!vec3s.length) return Vec3();
  let acc = Vec3();
  for (let i = 0; i < vec3s.length; i++) {
    acc = acc.add(vec3s[i]);
  }
  return acc.scale(1 / vec3s.length);
}

function updateDynamicsDesktop(dt) {
  const prob = 0.3;
  const sigma = 10;
  myDevice.computeBasisFromEuler();
  let randomCoin = Math.random() < prob ? 1 : 0;
  let force = matrixTransposeProd(myDevice.basis, myDevice.pos).scale(-1);
  let newAcc = force.scale(randomCoin).add(Vec3(1, 0, 0).scale(1 - randomCoin));
  accelerationFifo.push(newAcc);
  randomCoin = Math.random() < prob ? 1 : 0;
  let randomEulerAcc = Vec3(
    -1 * 2 * Math.random(),
    -1 * 2 * Math.random(),
    -1 * 2 * Math.random()
  ).scale(sigma);
  randomEulerAcc = randomEulerAcc
    .scale(randomCoin)
    .add(Vec3().scale(1 - randomCoin));
  randomEulerAcc = randomEulerAcc.sub(myDevice.eulerSpeed);

  // integration
  eulerFifo.push(myDevice.euler.add(myDevice.eulerSpeed.scale(dt)));
  myDevice.eulerSpeed = myDevice.eulerSpeed.add(randomEulerAcc.scale(dt));
}

function updateCurve(dt) {
  if (curve.length == 0) {
    curve.push(Vec3(0, 0, 0));
  }

  // when running on desktop
  if (!isMobile && !isManual) {
    updateDynamicsDesktop(dt);
  }

  let averageAcceleration = averageVectorFifo(accelerationFifo).sub(
    accelerationCalibration
  );
  let averageEuler = averageVectorFifo(eulerFifo).sub(eulerCalibration);

  myDevice.computeBasisFromEuler();
  let accelerationSpace = matrixProd(myDevice.basis, averageAcceleration);
  // friction
  accelerationSpace = accelerationSpace.sub(myDevice.vel);
  //euler integration
  myDevice.pos = myDevice.pos
    .add(myDevice.vel.scale(dt))
    .add(accelerationSpace.scale(0.5 * dt * dt));
  myDevice.vel = myDevice.vel.add(accelerationSpace.scale(dt));
  myDevice.euler = averageEuler;
  curve.push(myDevice.pos.clone());

  minCurve = minCurve.op(myDevice.pos, (a, b) => Math.min(a, b));
  maxCurve = maxCurve.op(myDevice.pos, (a, b) => Math.max(a, b));
  const center = minCurve.add(maxCurve).scale(0.5);
  const radius = maxCurve.sub(center).length();
  if (!isWheelUsed) {
    camera.param = Vec3(radius, ...camera.param.take(1, 3).toArray());
  }
}

function drawAxis() {
  const axis = "xyz";
  const e = Vec.e(3);
  for (let i = 0; i < 3; i++) {
    scene.addElement(
      Scene.Line.builder()
        .name(`${axis[i]}-axis`)
        .start(Vec3(0, 0, 0))
        .end(e(i))
        .color([dirac(0)(i) * 255, dirac(1)(i) * 255, dirac(2)(i) * 255, 255])
        .build()
    );
  }
}

function drawDevice() {
  for (let i = 0; i < linesIndexs.length; i++) {
    const edge = linesIndexs[i];
    const start = myDevice.pos.add(matrixProd(myDevice.basis, cube[edge[0]]));
    const end = myDevice.pos.add(matrixProd(myDevice.basis, cube[edge[1]]));
    scene.addElement(
      Scene.Line.builder()
        .name(`device_${edge[0]}_${edge[1]}`)
        .start(start)
        .end(end)
        .color([255, 255, 255, 255])
        .build()
    );
  }
  for (let i = 0; i < 3; i++) {
    scene.addElement(
      Scene.Line.builder()
        .name(`device_frame${i}`)
        .start(myDevice.pos)
        .end(myDevice.pos.add(myDevice.basis[i]))
        .color([dirac(0)(i) * 255, dirac(1)(i) * 255, dirac(2)(i) * 255, 255])
        .build()
    );
  }
}
function drawCurve() {
  const K = 500;
  const n = curve.length;
  scene.addElement(
    Scene.Path.builder()
      .name("devicePath")
      .path(n > K ? curve.filter((_, i) => i > n - K) : curve)
      .color([0, 255, 0, 255])
      .build()
  );
}

function calibration(dt) {
  // calibration
  let averageAcceleration = averageVectorFifo(accelerationFifo);
  let averageEulerSpeed = averageVectorFifo(eulerFifo);
  accelerationCalibration = accelerationCalibration.add(
    averageAcceleration.sub(accelerationCalibration).scale(1.0 / calibrationIte)
  );
  eulerCalibration = eulerCalibration.add(
    averageEulerSpeed.sub(eulerCalibration).scale(1 / calibrationIte)
  );
  calibrationIte++;

  // UI stuff
  const color = [255, 255, 255, 255];
  calibrationLoadingUI.percentFill =
    calibrationLoadingUI.percentFill + dt / maxCalibrationTimeInSeconds;
  const maxIndex = Math.floor(
    calibrationLoadingUI.percentFill * calibrationLoadingUI.size.get(0)
  );

  const endPoint = calibrationLoadingUI.pos;
  const endPointW = calibrationLoadingUI.pos.add(
    Vec2(calibrationLoadingUI.size.get(0), 0)
  );
  const endPointH = calibrationLoadingUI.pos.add(
    Vec2(0, calibrationLoadingUI.size.get(1))
  );
  const endPointWH = calibrationLoadingUI.pos.add(calibrationLoadingUI.size);

  // revert x with y
  tela.drawLineInt(
    Vec2(endPoint.get(1), endPoint.get(0)),
    Vec2(endPointW.get(1), endPointW.get(0)),
    color
  );
  tela.drawLineInt(
    Vec2(endPointW.get(1), endPointW.get(0)),
    Vec2(endPointWH.get(1), endPointWH.get(0)),
    color
  );
  tela.drawLineInt(
    Vec2(endPointWH.get(1), endPointWH.get(0)),
    Vec2(endPointH.get(1), endPointH.get(0)),
    color
  );
  tela.drawLineInt(
    Vec2(endPointH.get(1), endPointH.get(0)),
    Vec2(endPoint.get(1), endPoint.get(0)),
    color
  );

  for (let i = 0; i < maxIndex; i++) {
    const dir = Vec2(i, 0);
    const x1 = endPoint.add(dir);
    const x2 = endPointH.add(dir);
    drawLineInt(Vec2(x1.get(1), x1.get(0)), Vec2(x2.get(1), x2.get(0)), color);
  }

  if (calibrationLoadingUI.percentFill > 1) {
    calibrationLoadingUI.percentFill = 0;
    isCalibrating = false;
  }
}

function draw() {
  let dt = 1e-3 * (new Date().getTime() - startTime);
  startTime = new Date().getTime();
  time += dt;

  tela.fill([0, 0, 0, 255]);

  /**
   * drawing and animation
   **/

  if (isCalibrating && isMobile) {
    calibration(dt, data);
  } else {
    camera.orbit();
    updateCurve(dt);
    drawDevice();
    drawAxis();
    drawCurve();
  }

  camera.sceneShot(scene).to(tela);

  // rapid fix for text
  if (isCalibrating && isMobile) {
    const pos = calibrationLoadingUI.pos.toArray();
    ctx.font = "15px serif";
    ctx.fillStyle = "rgba(255, 255, 255, 255)";
    ctx.fillText(
      "Get your device in a stationary position for calibration",
      pos[0],
      pos[1] - 10
    );
  } else if (!isMobile) {
    ctx.font = "15px serif";
    ctx.fillStyle = "rgba(255, 255, 255, 255)";
    ctx.fillText("This App uses a smart phone", 10, 10);
  }

  requestAnimationFrame(draw);
}

init();
requestAnimationFrame(draw);
