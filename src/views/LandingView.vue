<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { TresCanvas } from '@tresjs/core'
import { BasicShadowMap, SRGBColorSpace, NoToneMapping } from 'three'

import ChristmasTree from '../components/ChristmasTree.vue'
import { FilesetResolver, GestureRecognizer } from '@mediapipe/tasks-vision'
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'
import { getDistance } from '@/Utils'

const videoElement = ref<HTMLVideoElement | null>(null)
const christmasTreeRef = ref<InstanceType<typeof ChristmasTree> | null>(null)
const cameras = ref<MediaDeviceInfo[]>([])
const selectedCameraId = ref<string | null>(null)
let gestureRecognizer: GestureRecognizer | null = null
const gestureRecognizerLoaded = ref(false)
let handLandmarkerResult: HandLandmarkerResult | null = null
const msg = ref('')
// const debugMsg = ref('')

async function getCameraDevices(): Promise<MediaDeviceInfo[]> {
  const devices = await window.navigator.mediaDevices.enumerateDevices()
  return devices.filter((device) => device.kind === 'videoinput')
}

function syncObjectLocation() {
  if (videoElement.value) {
    const videoWidth = videoElement.value.videoWidth
    const videoHeight = videoElement.value.videoHeight

    let center_x = 0
    let center_y = 0
    // 绘制手部检测结果
    if (handLandmarkerResult) {
      if (handLandmarkerResult.handedness.length === 0) {
        msg.value = '未检测到手'
        window.requestAnimationFrame(syncObjectLocation)
        return
      }
      const [landmark0, landmark5, landmark17] = [
        handLandmarkerResult.landmarks[0][0],
        handLandmarkerResult.landmarks[0][5],
        handLandmarkerResult.landmarks[0][17],
      ]
      center_x = ((landmark0.x + landmark5.x + landmark17.x) / 3) * videoWidth
      center_y = ((landmark0.y + landmark5.y + landmark17.y) / 3) * videoHeight

      // debugMsg.value = `${getDistance(landmark0, landmark5)} \n ${getDistance(landmark17, landmark5)}\n${getDistance(landmark0, landmark17)}mm`
      // 调整模型位置
      if (christmasTreeRef.value?.boxRef) {
        const boxRef = christmasTreeRef.value.boxRef
        if (boxRef) {
          boxRef.position.x = (center_x - videoWidth / 2) / 20
          boxRef.position.z = (center_y - videoHeight / 2) / 20
        }
      }

      // 调整模型缩放
      const avgDistance =
        (getDistance(landmark0, landmark5) +
          getDistance(landmark17, landmark5) +
          getDistance(landmark0, landmark17)) /
        3
      if (christmasTreeRef.value?.setScale) {
        christmasTreeRef.value.setScale(avgDistance / 0.2, avgDistance / 0.2, avgDistance / 0.2)
      }
    }
  }
  window.requestAnimationFrame(syncObjectLocation)
}
async function createGestureRecognizer() {
  gestureRecognizerLoaded.value = false
  const vision = await FilesetResolver.forVisionTasks(import.meta.env.BASE_URL + '/wasm')
  gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: new URL('../assets/gesture_recognizer.task', import.meta.url).href,
    },
    runningMode: 'VIDEO',
  })
  gestureRecognizerLoaded.value = true
}
onMounted(async () => {
  createGestureRecognizer()
  try {
    // 请求摄像头权限
    // 提示用户允许摄像头权限
    window.alert('Treer 即将向您请求摄像头权限\n摄像头数据完全在本地处理, 不会有任何信息被上传')
    checkOrientation()
    window.addEventListener('orientationchange', checkOrientation)
    const stream = await window.navigator.mediaDevices.getUserMedia({ video: true })
    if (videoElement.value) {
      videoElement.value.srcObject = stream
      await videoElement.value.play()
      cameras.value = await getCameraDevices()
      selectedCameraId.value = cameras.value[0].deviceId
    }
  } catch (error) {
    console.error('无法访问摄像头：', error)
  }
  window.requestAnimationFrame(syncObjectLocation)
})

const gl = {
  shadows: true,
  alpha: true,
  shadowMapType: BasicShadowMap,
  outputColorSpace: SRGBColorSpace,
  toneMapping: NoToneMapping,
}

function reset() {
  if (christmasTreeRef.value?.boxRef?.boxRef) {
    christmasTreeRef.value.boxRef.boxRef.rotation.x = 0
    christmasTreeRef.value.boxRef.boxRef.rotation.y = 0
    christmasTreeRef.value.boxRef.boxRef.rotation.z = 0
    christmasTreeRef.value.boxRef.boxRef.position.y = 0
    christmasTreeRef.value.boxRef.boxRef.position.x = 0
    christmasTreeRef.value.boxRef.boxRef.position.z = 0
  }
}

async function detect() {
  // 开始时间
  const start = performance.now()
  if (gestureRecognizerLoaded.value && videoElement.value) {
    // 等待视频元数据加载完成
    if (videoElement.value.readyState < 2) {
      await new Promise<void>((resolve) => {
        videoElement.value!.onloadeddata = () => resolve()
      })
    }
    try {
      handLandmarkerResult = gestureRecognizer!.recognizeForVideo(videoElement.value, Date.now())
    } catch (error) {
      console.error('检测失败：', error)
    }
  }

  // 结束时间
  const end = performance.now()
  // console.log(handLandmarkerResult, end - start + 'ms')
  msg.value = handLandmarkerResult
    ? `检测耗时：${(end - start).toFixed(0)}ms, 一共有${handLandmarkerResult.handedness.length}只手`
    : '检测失败，未检测到手'
  window.requestAnimationFrame(detect)
}
const isPortrait = ref(false)

function checkOrientation() {
  if (window.matchMedia('(orientation: portrait)').matches) {
    isPortrait.value = true
    alert('为了获得更好的体验，请使用横屏模式浏览。(微信不支持横屏模式, 建议使用系统浏览器打开)')
  } else {
    isPortrait.value = false
  }
}

// 启动摄像头流
async function startCameraStream(deviceId: string) {
  try {
    // 停止之前的摄像头流
    if (videoElement.value && videoElement.value.srcObject) {
      const stream = videoElement.value.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
    }

    // 请求新的摄像头流
    const stream = await window.navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId } },
    })

    if (videoElement.value) {
      videoElement.value.srcObject = stream
      await videoElement.value.play()
    }
  } catch (error) {
    console.error('无法访问摄像头：', error)
  }
}
watch(selectedCameraId, async (newId) => {
  if (newId) {
    await startCameraStream(newId)
  }
})
</script>
<template>
  <TresCanvas v-bind="gl" window-size style="pointer-events: none">
    <!-- 摄像头 -->
    <TresPerspectiveCamera :position="[0, 25, 0]" :look-at="[0, 0, 0]" />
    <!-- 控制器 -->
    <!-- <OrbitControls /> -->
    <!-- 模型对象 -->
    <Suspense>
      <ChristmasTree ref="christmasTreeRef" />
    </Suspense>
    <TresDirectionalLight cast-shadow :position="[0, 2, 0]" :intensity="10" />
  </TresCanvas>
  <div class="cavBar">
    <video class="cam" ref="videoElement"></video>
    <!-- <canvas class="cam" ref="canvasElement" id="output"></canvas> -->
  </div>

  <div class="toolbar">
    <div class="toolbarItem">
      <button @click="reset">重置</button>
    </div>
    <div class="toolbarItem">
      <button @click="detect">开始</button>
    </div>

    <select v-model="selectedCameraId">
      <option v-for="camera in cameras" :key="camera.deviceId" :value="camera.deviceId">
        {{ camera.label }}
      </option>
    </select>
    <div class="toolbarItem">
      <p :style="{ color: gestureRecognizerLoaded ? 'black' : 'red' }">
        {{ gestureRecognizerLoaded ? '模型加载成功' : '模型加载中' }}
      </p>
    </div>
    <div class="toolbarItem">
      <p>{{ msg }}</p>
      <!-- <p>{{ debugMsg }}</p> -->
    </div>
  </div>
</template>

<style scoped>
.cavBar {
  width: 100vw;
  height: 100vh;
}
.cam {
  width: 100vw;
  height: 100vh;
}

.toolbar {
  width: 100vw;
  display: flex;
  background-color: #f2f2f2;
}

.toolbarItem {
  padding-left: 10px;
  height: 8vh;
}
select {
  margin: 10px;
  width: 200px;
  height: 40px;
  font-size: large;
  padding: 5px 10px;
  border-radius: 5px;
  background-color: #f78b3d;
  color: #fff;
  border: none;
  cursor: pointer;
}
button {
  margin: 10px;
  width: 100px;
  height: 40px;
  font-size: large;
  padding: 5px 10px;
  border-radius: 5px;
  background-color: #f78b3d;
  color: #fff;
  border: none;
  cursor: pointer;
}
</style>
