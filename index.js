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
  serializeCurve,
  deserializeCurve,
} from "./src/Utils.js";
import Vec, { Vec2, Vec3 } from "./src/Vec3.js";

//drawing variables
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
let tela = new Canvas(canvas);
const scene = new Scene();
const camera = new Camera();

// ui variables
let down = false;
let mouse = Vec2();
let isManual = false;
const isMobile =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
let isWheelUsed = false;
let isGpsMode = false;

//error correcting variables
let samples = 3;
let accelerationFifo = new Fifo(samples);
let eulerSpeedFifo = new Fifo(samples);
let eulerFifo = new Fifo(samples);
let eulerCallbackTime = new Date().getTime();
let oldEulerFromCallback = Vec3();

// calibration variables
let accelerationCalibration = Vec3();
let eulerSpeedCalibration = Vec3();
let isCalibrating = true;
let maxCalibrationTimeInSeconds = 7;
let calibrationLoadingUI;

//app variables
let isViewOnly = false;
let startTime = new Date().getTime();
let time = 0;
let curve = [];
let minCurve = Vec3(-3, -3, -3);
let maxCurve = Vec3(3, 3, 3);
const myDevice = new Device();
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

const URL_CURVE = "?curve=";

/**
 * Main program
 */

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  tela = new Canvas(canvas);
}

function reset() {
  myDevice.pos = Vec3();
  myDevice.euler = Vec3();
  curve = [];
  minCurve = Vec3(-3, -3, -3);
  minCurve = Vec3(3, 3, 3);
}

function generatePermalink() {
  const MAX_URL_SIZE = 2000;
  const VEC3_SERIAL_STR_SIZE = 15;
  const alpha = Math.ceil((curve.length * VEC3_SERIAL_STR_SIZE) / MAX_URL_SIZE);
  const url = window.location.href;
  const baseUrl = url.split(URL_CURVE)[0];
  window.location.href = `${baseUrl}${URL_CURVE}${encodeURI(
    serializeCurve(curve.filter((_, i) => i % alpha === 0))
  )}`;
}

function addIconControls() {
  const iconControls = [
    {
      title: "Github",
      id: "githubIcon",
      link: "https://github.com/pedroth/3d-route-demo",
      target: "_blank",
      onClick: () => {},
      icon: "code",
    },
    {
      title: "Curve-Permalink",
      id: "permalink",
      link: "javascript:void(0)",
      onClick: generatePermalink,
      icon: "link",
    },
    // {
    //   title: "Toggle between gps data and acceleration data",
    //   id: "gpsIcon",
    //   link: "javascript:void(0)",
    //   onClick: () => {
    //     const gpsIcon = document.getElementById("gpsIcon");
    //     isGpsMode = !isGpsMode;
    //     gpsIcon.innerHTML = isGpsMode ? "gps_off" : "gps_fixed";
    //   },
    //   icon: "gps_fixed",
    // },
    {
      title: "Toggle sensor data visibility",
      id: "sensorsIcon",
      link: "javascript:void(0)",
      onClick: () => {
        const sensorIcon = document.getElementById("sensorsIcon");
        const deviceDataUI = document.getElementById("deviceData");
        const isHidden =
          deviceDataUI.style.visibility === "" ||
          deviceDataUI.style.visibility === "hidden";
        deviceDataUI.style.visibility = isHidden ? "visible" : "hidden";
        sensorIcon.innerHTML = isHidden ? "sensors_off" : "sensors";
      },
      icon: "sensors",
    },
    {
      title: "Reset",
      id: "resetIcon",
      link: "javascript:void(0)",
      onClick: reset,
      icon: "restart_alt",
    },
  ];

  const toolsDiv = document.getElementById("tools");
  iconControls.forEach(({ title, id, link, onClick, icon, target }) => {
    const i = document.createElement("i");
    i.className = "material-icons";
    const a = document.createElement("a");
    a.title = title;
    a.id = id;
    a.href = link;
    target && (a.target = target);
    a.innerText = icon;
    a.onclick = onClick;
    i.appendChild(a);
    toolsDiv.appendChild(i);
  });
  // const googleFontLink = document.createElement("link");
  // googleFontLink.rel = "stylesheet";
  // googleFontLink.href =
  //   "https://fonts.googleapis.com/icon?family=Material+Icons";
  // googleFontLink.crossorigin = "anonymous";
  // document.head.appendChild(googleFontLink);
}

function init() {
  addIconControls();
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

  readPermalinkIfExists();
  setUpDeviceCallbacks();
}

function readPermalinkIfExists() {
  const url = window.location.href;
  const baseUrl = url.split(URL_CURVE);
  if (baseUrl.length > 1) {
    isViewOnly = true;
    const serializedCurve = baseUrl[1];
    curve = deserializeCurve(decodeURI(serializedCurve));
  }
}

function setUpDeviceCallbacks() {
  if (window.DeviceMotionEvent != undefined && isMobile && !isViewOnly) {
    addAccelerationCallback();
    addRotationCallback();
  }
}

function addRotationCallback() {
  window.addEventListener("deviceorientation", (e) => {
    const { alpha, beta, gamma } = e;

    const newTime = new Date().getTime();
    const timeInBetweenCallsInSec = (newTime - eulerCallbackTime) * 1e-3;
    eulerCallbackTime = newTime;

    const newEuler = Vec3(alpha, beta, gamma).scale(Math.PI / 180);

    eulerFifo.push(newEuler);

    // Angle interval here: https://w3c.github.io/deviceorientation/#deviceorientation
    const newEulerDual = newEuler.add(Vec3(2 * Math.PI, 2 * Math.PI, Math.PI));
    const dTheta = newEuler.sub(oldEulerFromCallback);
    const dThetaDual = newEulerDual.sub(oldEulerFromCallback);
    const finalDTheta = dTheta.op(dThetaDual, (a, b) =>
      Math.abs(a) <= Math.abs(b) ? a : b
    );

    const eulerSpeed = finalDTheta.scale(
      1 / (timeInBetweenCallsInSec === 0 ? 1e-1 : timeInBetweenCallsInSec)
    );
    eulerSpeedFifo.push(eulerSpeed);
    // retrieve corrected newEuler
    oldEulerFromCallback = finalDTheta.add(oldEulerFromCallback);

    updateRotationDataUI(newEuler.toArray());
  });
}

function addAccelerationCallback() {
  window.addEventListener(
    "devicemotion",
    (e) => {
      accelerationFifo.push(
        Vec3(-e.acceleration.y, -e.acceleration.x, -e.acceleration.z)
      );
      const lastAcceleration = accelerationFifo.getLast();
      updateAccelerationDataUI(lastAcceleration);
    },
    true
  );
}

function updateAccelerationDataUI(accelerationArray) {
  document.getElementById("accelerationData").innerHTML = `(${accelerationArray
    .map((x) => x.toFixed(2))
    .join(",")}) m/s²`;
}

function updateRotationDataUI(eulerArray) {
  const displayEuler = !eulerArray
    ? myDevice.euler.map((x) => x % (2 * Math.PI)).toArray()
    : [...eulerArray];
  document.getElementById("rotationData").innerHTML = `(${displayEuler
    .map((x) => x * (180 / Math.PI))
    .map((x) => x.toFixed(2))
    .join(",")}) deg`;
}

function keyDown(e) {
  isManual = true;
  const keySpeed = 1;
  let eulerSpeed = Vec3();
  switch (e.key) {
    case "a":
      eulerSpeed = Vec3(keySpeed, 0, 0);
      break;
    case "d":
      eulerSpeed = Vec3(-keySpeed, 0, 0);
      break;
    case "w":
      eulerSpeed = Vec3(0, keySpeed, 0);
      break;
    case "s":
      eulerSpeed = Vec3(0, -keySpeed, 0);
      break;
  }
  eulerSpeedFifo.push(eulerSpeed);
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
  const sigma = 3;
  myDevice.computeBasisFromEuler();
  let randomCoin = Math.random() < prob ? 1 : 0;
  let force = matrixTransposeProd(myDevice.basis, myDevice.pos).scale(-1);
  const newAcc = force
    .scale(randomCoin)
    .add(Vec3(0, 1, 0).scale(1 - randomCoin));
  accelerationFifo.push(newAcc);
  updateAccelerationDataUI(newAcc.toArray());

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

  // euler integration
  myDevice.eulerSpeed = myDevice.eulerSpeed.add(randomEulerAcc.scale(dt));
  eulerSpeedFifo.push(myDevice.eulerSpeed);

  updateRotationDataUI();
}

function updateCurve(dt) {
  if (curve.length == 0) {
    curve.push(Vec3(0, 0, 0));
  }
  // when running on desktop
  if (!isMobile && !isManual) {
    updateDynamicsDesktop(dt);
  }
  myDevice.computeBasisFromEuler();
  updateDeviceRotation(dt);
  updateDevicePos(dt);
  curve.push(myDevice.pos.clone());

  minCurve = minCurve.op(myDevice.pos, (a, b) => Math.min(a, b));
  maxCurve = maxCurve.op(myDevice.pos, (a, b) => Math.max(a, b));
  const center = minCurve.add(maxCurve).scale(0.5);
  const radius = maxCurve.sub(center).length();
  if (!isWheelUsed) {
    camera.param = Vec3(radius, ...camera.param.take(1, 3).toArray());
  }
}

function updateDeviceRotation(dt) {
  myDevice.eulerSpeed = averageVectorFifo(eulerSpeedFifo);
  // .sub(
  //   eulerSpeedCalibration
  // );
  myDevice.euler = myDevice.euler.add(myDevice.eulerSpeed.scale(dt));
}

function updateDevicePos(dt) {
  let averageAcceleration = averageVectorFifo(accelerationFifo);
  // .sub(
  //   accelerationCalibration
  // );
  let accelerationSpace = isMobile
    ? averageAcceleration
    : matrixProd(myDevice.basis, averageAcceleration);
  // friction
  accelerationSpace = accelerationSpace.sub(myDevice.vel);
  //euler integration
  myDevice.vel = myDevice.vel.add(accelerationSpace.scale(dt));
  myDevice.pos = myDevice.pos
    .add(myDevice.vel.scale(dt))
    .add(accelerationSpace.scale(0.5 * dt * dt));
}

function drawCalibrationUI() {
  if (isCalibrating && isMobile) {
    const pos = calibrationLoadingUI.pos.toArray();
    ctx.font = "15px";
    ctx.fillStyle = "rgba(255, 255, 255, 255)";
    ctx.fillText(
      "Get your device in a stationary position for calibration",
      pos[0] - 25,
      pos[1] - 10
    );
  } else if (!isMobile) {
    ctx.font = "15px serif";
    ctx.fillStyle = "rgba(255, 255, 255, 255)";
    ctx.fillText(
      "This app uses a smart phone. Use A,W,S,D to control.",
      canvas.width / 2 - 100,
      canvas.height - 20
    );
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
  if (calibrationLoadingUI.percentFill > 1) {
    calibrationLoadingUI.percentFill = 0;
    isCalibrating = false;
    const averageAcceleration = averageVectorFifo(accelerationFifo);
    const averageSpeedEuler = averageVectorFifo(eulerSpeedFifo);
    accelerationCalibration = averageAcceleration;
    eulerSpeedCalibration = averageSpeedEuler;
    return;
  }

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
    tela.drawLineInt(
      Vec2(x1.get(1), x1.get(0)),
      Vec2(x2.get(1), x2.get(0)),
      color
    );
  }
}

function draw() {
  const dt = Math.min(0.75, 1e-3 * (new Date().getTime() - startTime));
  startTime = new Date().getTime();
  time += dt;

  tela.fill([0, 0, 0, 255]);

  /**
   * drawing and animation
   **/

  if (isCalibrating && isMobile) {
    calibration(dt);
  } else if (isViewOnly) {
    camera.orbit();
    drawAxis();
    drawCurve();
  } else {
    camera.orbit();
    updateCurve(dt);
    drawDevice();
    drawAxis();
    drawCurve();
  }

  isManual && updateRotationDataUI();

  camera.sceneShot(scene).to(tela);

  // rapid fix for text
  drawCalibrationUI();
  requestAnimationFrame(draw);
}

init();
requestAnimationFrame(draw);
