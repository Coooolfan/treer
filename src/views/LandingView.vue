<script setup lang="ts">
import { onMounted, ref, watch, type ShallowRef } from 'vue'
import { TresCanvas, type TresInstance } from '@tresjs/core'
import { BasicShadowMap, SRGBColorSpace, NoToneMapping } from 'three'

import ChristmasTree from '../components/ChristmasTree.vue'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'

const videoElement = ref<HTMLVideoElement | null>(null)
const christmasTreeRef: ShallowRef<TresInstance | null> = ref(null)
const cameras = ref<MediaDeviceInfo[]>([])
const selectedCameraId = ref<string | null>(null)
let handLandmarker: HandLandmarker | null = null
let handLandmarkerResult: HandLandmarkerResult | null = null
const msg = ref('')

async function getCameraDevices(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices.filter((device) => device.kind === 'videoinput')
}

function syncObjectLocation() {
  if (videoElement.value) {
    const videoWidth = videoElement.value.videoWidth
    const videoHeight = videoElement.value.videoHeight

    // const videoAspectRatio = videoWidth / videoHeight

    // const offsetX = (canvasWidth - drawWidth) / 2
    // const offsetY = (canvasHeight - drawHeight) / 2
    const offsetX = 0
    const offsetY = 0

    let center_x = 0
    let center_y = 0
    // 绘制手部检测结果
    if (handLandmarkerResult) {
      if (handLandmarkerResult.handedness.length === 0) {
        msg.value = '未检测到手'
        requestAnimationFrame(syncObjectLocation)
        return
      }
      for (let i = 0; i < handLandmarkerResult.landmarks[0].length; i++) {
        if (!(i === 0 || i === 5 || i === 17)) continue
        const landmark = handLandmarkerResult.landmarks[0][i]
        center_x += landmark.x
        center_y += landmark.y
      }

      center_x = (center_x / 3) * videoWidth + offsetX
      center_y = (center_y / 3) * videoHeight + offsetY

      if (christmasTreeRef.value) {
        christmasTreeRef.value.boxRef.position.x = (center_x - videoWidth / 2) / 20
        christmasTreeRef.value.boxRef.position.z = (center_y - videoHeight / 2) / 20
      }
    }
  }
  requestAnimationFrame(syncObjectLocation)
}

onMounted(async () => {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm',
  )

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'src/assets/hand_landmarker.task',
    },
    numHands: 2,
  })
  try {
    // 请求摄像头权限
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    if (videoElement.value) {
      videoElement.value.srcObject = stream
      await videoElement.value.play()
      cameras.value = await getCameraDevices()
      selectedCameraId.value = cameras.value[0].deviceId
    }
  } catch (error) {
    console.error('无法访问摄像头：', error)
  }
  requestAnimationFrame(syncObjectLocation)
})

const gl = {
  shadows: true,
  alpha: true,
  shadowMapType: BasicShadowMap,
  outputColorSpace: SRGBColorSpace,
  toneMapping: NoToneMapping,
}

function reset() {
  if (christmasTreeRef.value) {
    christmasTreeRef.value.boxRef.rotation.x = 0
    christmasTreeRef.value.boxRef.rotation.y = 0
    christmasTreeRef.value.boxRef.rotation.z = 0
    christmasTreeRef.value.boxRef.position.y = 0
    christmasTreeRef.value.boxRef.position.x = 0
    christmasTreeRef.value.boxRef.position.z = 0
  }
}

async function captureImageFromSelectedCamera(deviceId: string): Promise<ImageBitmap> {
  // 请求特定摄像头权限
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { deviceId: { exact: deviceId } },
  })

  // 创建一个视频元素
  const video = document.createElement('video')
  video.srcObject = stream
  video.play()

  // 等待视频元素加载元数据
  await new Promise<void>((resolve) => {
    video.onloadedmetadata = () => resolve()
  })

  // 创建一个画布元素
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight

  // 将视频帧绘制到画布上
  const context = canvas.getContext('2d')
  if (context) {
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
  }

  // 停止视频流
  stream.getTracks().forEach((track) => track.stop())

  // 从画布创建 ImageBitmap
  const imageBitmap = await createImageBitmap(canvas)

  return imageBitmap
}

async function detect() {
  const image = await captureImageFromSelectedCamera(selectedCameraId.value?.toString() || '')
  // 开始时间
  const start = performance.now()
  if (handLandmarker) handLandmarkerResult = handLandmarker.detect(image)

  // 结束时间
  const end = performance.now()
  console.log(handLandmarkerResult, end - start + 'ms')
  msg.value = handLandmarkerResult
    ? `检测耗时：${end - start}ms, 一共有${handLandmarkerResult.handedness.length}只手`
    : '检测失败，未检测到手'
  detect()
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
    const stream = await navigator.mediaDevices.getUserMedia({
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
      <button @click="detect">检测</button>
    </div>

    <select v-model="selectedCameraId">
      <option v-for="camera in cameras" :key="camera.deviceId" :value="camera.deviceId">
        {{ camera.label }}
      </option>
    </select>
    <div class="toolbarItem">
      <!-- <button @click="startCameraStream">展示</button> -->
    </div>
    <span>{{ msg }}</span>
  </div>
</template>

<style scoped>
.cavBar {
  width: 100vw;
  height: 90vh;
}
.cam {
  width: 100vw;
  height: 90vh;
}

.toolbar {
  width: 100vw;
  display: flex;
}

.toolbarItem {
  height: 10vh;
  background-color: #f2f2f2;
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
